import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
import reservationPhotoCleanupService from './reservationPhotoCleanupService';
import inspectionService from './inspectionService';
import reservationService from './reservationService';

const getAppOrigin = () => (typeof window !== 'undefined' ? (window.location?.origin || '') : '');
const appUrl = (path = '') => `${getAppOrigin()}${path}`;
const RELEASE_SETTLEMENT_STATUSES = ['released_no_dispute', 'released_after_moderation'];
const TERMINAL_REFUND_STATUSES = ['succeeded', 'not_required', 'captured'];
const IDENTITY_DOCUMENT_TYPE = 'identity';
const IDENTITY_VALID_UPLOAD_STATUSES = ['pending', 'approved'];
const MISSING_PAYMENT_DEADLINE_COLUMN_IDENTIFIER_PATTERN = /payment_deadline/i;
const MISSING_PAYMENT_DEADLINE_SCHEMA_PATTERN = /column .* does not exist|could not find the 'payment_deadline' column/i;

const uniqueReservationIds = (values = []) => (
  Array.from(new Set((Array?.isArray(values) ? values : [])?.filter(Boolean)))
);

const toDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value)?.trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
};

const getIdentityUploadDeadline = (reservation) => {
  const dateOnly = toDateOnly(reservation?.start_date);
  if (!dateOnly) return null;
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed?.getTime())) return null;
  return parsed;
};

const collectSettlementRefundCandidates = async (releasedReservationIds = []) => {
  const seedIds = uniqueReservationIds(releasedReservationIds);
  const candidateIds = new Set(seedIds);

  try {
    const { data: releasedSettlements, error: releasedSettlementsError } = await supabase
      ?.from('reservation_inspection_settlements')
      ?.select('reservation_id, status, updated_at')
      ?.in('status', RELEASE_SETTLEMENT_STATUSES)
      ?.order('updated_at', { ascending: false })
      ?.limit(400);

    if (releasedSettlementsError) throw releasedSettlementsError;

    for (const settlement of releasedSettlements || []) {
      const reservationId = settlement?.reservation_id;
      if (reservationId) candidateIds?.add(reservationId);
    }
  } catch (error) {
    // Fallback to just-released ids when settlement tables are unavailable.
    console.warn('Collect settlement refund candidates fallback:', error?.message || error);
    return seedIds;
  }

  const ids = Array.from(candidateIds);
  if (ids?.length === 0) return [];

  const { data: reservations, error: reservationsError } = await supabase
    ?.from('reservations')
    ?.select('id, status, deposit_status, deposit_refund_status')
    ?.in('id', ids);

  if (reservationsError) {
    console.warn('Reservation refund candidate filtering fallback:', reservationsError?.message || reservationsError);
    return seedIds;
  }

  const reservationById = new Map((reservations || [])?.map((row) => [row?.id, row]));
  const orderedIds = [...seedIds, ...ids?.filter((id) => !seedIds?.includes(id))];

  return orderedIds?.filter((reservationId) => {
    const reservation = reservationById?.get(reservationId);
    if (!reservation) return false;

    const refundStatus = String(reservation?.deposit_refund_status || '')?.toLowerCase();
    if (TERMINAL_REFUND_STATUSES?.includes(refundStatus)) return false;

    const depositStatus = String(reservation?.deposit_status || '')?.toLowerCase();
    if (depositStatus === 'none') return false;

    return true;
  });
};

/**
 * Deprecated in instant-booking mode.
 * Kept for backward compatibility with admin tooling and cron wiring.
 */
export const checkOwnerNoResponse = async () => ({
  success: true,
  processed: 0,
  skipped: true,
  reason: 'Validation propriétaire des réservations désactivée (réservation instantanée).',
  reminders: 0,
  strikes: 0,
  cancelled: 0,
  errors: []
});

/**
 * Enforce identity upload deadline after payment.
 * Rule:
 * - reservation paid
 * - no identity document uploaded by start day
 * => reservation cancelled, one day kept, remaining amount refunded.
 */
export const checkMissingDocuments = async () => {
  try {
    const now = new Date();
    const results = {
      success: true,
      processed: 0,
      cancelled: 0,
      refunded: 0,
      depositReleased: 0,
      skipped: 0,
      errors: []
    };

    const { data: reservations, error } = await supabase
      ?.from('reservations')
      ?.select('id, status, start_date, end_date, total_price, renter_id')
      ?.eq('status', 'paid');

    if (error) throw error;
    if (!reservations?.length) return results;

    const renterIds = uniqueReservationIds((reservations || [])?.map((reservation) => reservation?.renter_id));
    const { data: identityDocs, error: identityDocsError } = await supabase
      ?.from('user_profile_documents')
      ?.select('user_id, document_type, status')
      ?.in('user_id', renterIds)
      ?.eq('document_type', IDENTITY_DOCUMENT_TYPE)
      ?.in('status', IDENTITY_VALID_UPLOAD_STATUSES);

    if (identityDocsError) throw identityDocsError;

    const renterWithIdentity = new Set((identityDocs || [])?.map((doc) => doc?.user_id)?.filter(Boolean));

    for (const reservation of reservations || []) {
      results.processed += 1;

      const deadline = getIdentityUploadDeadline(reservation);
      if (!deadline || now <= deadline) {
        results.skipped += 1;
        continue;
      }

      if (renterWithIdentity?.has(reservation?.renter_id)) {
        results.skipped += 1;
        continue;
      }

      try {
        const { data: refundData, error: refundError } = await supabase.functions.invoke('cancel-reservation-missing-identity', {
          body: {
            reservationId: reservation?.id
          }
        });

        if (refundError) {
          throw new Error(refundError?.message || 'Remboursement partiel impossible');
        }

        const chargedAmount = Math.max(0, Number(refundData?.chargedAmountEuros || 0) || 0);
        const refundAmount = Math.max(0, Number(refundData?.refundAmountEuros || 0) || 0);
        const cancellationReason = [
          "CNI non importée dans les délais avant la remise.",
          `1 jour facturé (${chargedAmount?.toFixed(2)} EUR).`,
          `Remboursement du reste (${refundAmount?.toFixed(2)} EUR).`
        ]?.join(' ');

        const { error: cancelError } = await reservationService?.updateReservationStatus(reservation?.id, 'cancelled', {
          cancellation_reason: cancellationReason,
          cancelled_by: 'system_identity_deadline',
          cancelled_at: new Date()?.toISOString()
        });

        if (cancelError) {
          throw cancelError;
        }

        const { error: releaseError } = await supabase.functions.invoke('manage-reservation-deposit-strategy-b', {
          body: {
            action: 'settle',
            reservationId: reservation?.id,
            decision: 'release'
          }
        });

        if (!releaseError) {
          results.depositReleased += 1;
        }

        results.cancelled += 1;
        if (refundAmount > 0) {
          results.refunded += 1;
        }
      } catch (err) {
        results?.errors?.push({ reservationId: reservation?.id, error: err?.message });
      }
    }

    results.success = results?.errors?.length === 0;
    return results;
  } catch (error) {
    console.error('Erreur dans checkMissingDocuments:', error);
    throw error;
  }
};

/**
 * Cancel unpaid reservations after payment deadline
 */
export const cancelUnpaidReservations = async () => {
  try {
    const now = new Date();
    const results = {
      cancelled: 0,
      skipped: false,
      reason: null,
      errors: []
    };

    const { data: reservations, error } = await supabase?.from('reservations')?.select('*')?.eq('status', 'accepted')?.is('paid_at', null)?.lt('payment_deadline', now?.toISOString());

    if (error) {
      const message = String(error?.message || '');
      const missingPaymentDeadline = MISSING_PAYMENT_DEADLINE_COLUMN_IDENTIFIER_PATTERN?.test(message)
        && MISSING_PAYMENT_DEADLINE_SCHEMA_PATTERN?.test(message);

      if (missingPaymentDeadline) {
        return {
          ...results,
          skipped: true,
          reason: "Champ payment_deadline absent: annulation automatique impayee non active dans cette base."
        };
      }

      throw error;
    }

    for (const reservation of reservations || []) {
      try {
        await supabase?.from('reservations')?.update({
            status: 'cancelled_tenant_no_payment',
            cancelled_at: now?.toISOString(),
            cancellation_reason: 'Paiement non effectué dans les délais'
          })?.eq('id', reservation?.id);

        results.cancelled++;
      } catch (err) {
        results?.errors?.push({ reservationId: reservation?.id, error: err?.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans cancelUnpaidReservations:', error);
    throw error;
  }
};

/**
 * Release deposit authorizations after rental completion + 7 days
 */
export const releaseDeposits = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo?.setDate(sevenDaysAgo?.getDate() - 7);
    const results = { released: 0, errors: [] };

    const { data: reservations, error } = await supabase?.from('reservations')?.select('*')?.eq('status', 'completed')?.eq('deposit_status', 'authorized')?.lt('end_date', sevenDaysAgo?.toISOString());

    if (error) throw error;

    for (const reservation of reservations || []) {
      try {
        // In production, call Stripe API to release authorization
        // For now, just update status
        await supabase?.from('reservations')?.update({
            deposit_status: 'released',
            deposit_released_at: new Date()?.toISOString()
          })?.eq('id', reservation?.id);

        await reservationPhotoCleanupService?.purgeReservationPhotosAfterPayment(reservation?.id, {
          suppressErrors: true
        });

        results.released++;
      } catch (err) {
        results?.errors?.push({ reservationId: reservation?.id, error: err?.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans releaseDeposits:', error);
    throw error;
  }
};

/**
 * Rotate Strategy B deposit authorizations before Stripe capture deadline.
 * Keeps a valid manual-capture hold for long rentals (>30 days included).
 */
export const rotateStrategyBDepositAuthorizations = async ({ limit = 100, safetyHours = 12 } = {}) => {
  try {
    const { data, error } = await supabase.functions.invoke('manage-reservation-deposit-strategy-b', {
      body: {
        action: 'rotate_due',
        limit,
        safetyHours
      }
    });

    if (error) throw error;
    return data || { ok: true, processed: 0, rotated: 0, reauthRequired: 0, failed: 0, expired: 0, skipped: 0, reservations: [] };
  } catch (error) {
    console.error('Erreur dans rotateStrategyBDepositAuthorizations:', error);
    throw error;
  }
};

/**
 * Process 24h dispute windows for inspection-based final settlement.
 * - no dispute: marks internal settlement as released
 * - dispute opened: freezes for moderation
 */
export const processInspectionSettlementWindows = async () => {
  try {
    const results = {
      processed: 0,
      released: 0,
      frozen: 0,
      refundCandidates: 0,
      refunded: 0,
      cleanupErrors: [],
      refundErrors: []
    };

    const { data, error } = await inspectionService?.processDueSettlements({ limit: 200 });
    if (error) throw error;

    const releasedReservationIds = Array?.isArray(data?.released_reservation_ids) ? data?.released_reservation_ids : [];
    const frozenReservationIds = Array?.isArray(data?.frozen_reservation_ids) ? data?.frozen_reservation_ids : [];

    results.processed = Number(data?.processed || 0) || 0;
    results.released = releasedReservationIds?.length;
    results.frozen = frozenReservationIds?.length;

    const refundCandidates = await collectSettlementRefundCandidates(releasedReservationIds);
    results.refundCandidates = refundCandidates?.length;

    for (const reservationId of refundCandidates) {
      try {
        const { data: refundData, error: refundError } = await supabase.functions.invoke('manage-reservation-deposit-strategy-b', {
          body: {
            action: 'settle',
            reservationId,
            decision: 'release'
          }
        });

        if (refundError) {
          results?.refundErrors?.push({
            reservationId,
            error: refundError?.message || 'refund invoke failed'
          });
        } else {
          const refundStatus = String(refundData?.refundStatus || '').toLowerCase();
          if (refundStatus === 'succeeded' || refundStatus === 'pending' || refundStatus === 'not_required') {
            results.refunded += 1;
          }
        }
      } catch (refundInvokeError) {
        results?.refundErrors?.push({
          reservationId,
          error: refundInvokeError?.message || 'refund invoke failed'
        });
      }
    }

    for (const reservationId of releasedReservationIds) {
      const cleanupResult = await reservationPhotoCleanupService?.purgeReservationPhotosAfterPayment(reservationId, {
        suppressErrors: true
      });
      if (!cleanupResult?.ok) {
        results.cleanupErrors?.push({
          reservationId,
          error: cleanupResult?.warning || 'photo cleanup failed'
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans processInspectionSettlementWindows:', error);
    throw error;
  }
};

/**
 * Send return reminders 2 days before end date
 */
export const sendReturnReminders = async () => {
  try {
    const twoDaysFromNow = new Date();
    twoDaysFromNow?.setDate(twoDaysFromNow?.getDate() + 2);
    const results = { sent: 0, errors: [] };

    const { data: reservations, error } = await supabase?.from('reservations')?.select('*, renter:renter_id(email, pseudo), annonce:annonce_id(titre)')?.eq('status', 'active')?.gte('end_date', twoDaysFromNow?.toISOString())?.lt('end_date', new Date(twoDaysFromNow.getTime() + 24 * 60 * 60 * 1000)?.toISOString());

    if (error) throw error;

    for (const reservation of reservations || []) {
      try {
        await sendEmail({
          to: reservation?.renter?.email,
          templateKey: 'reminder_return',
          variables: {
            item_title: reservation?.annonce?.titre || 'votre équipement',
            return_date: new Date(reservation.end_date)?.toLocaleDateString('fr-FR')
          }
        });

        results.sent++;
      } catch (err) {
        results?.errors?.push({ reservationId: reservation?.id, error: err?.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans sendReturnReminders:', error);
    throw error;
  }
};

/**
 * Process strikes and auto-ban users with 3+ strikes
 */
export const processStrikes = async () => {
  try {
    const results = { banned: 0, errors: [] };

    // Get users with 3+ strikes
    const { data: users, error } = await supabase?.from('profiles')?.select('id, email, pseudo, no_reply_strikes')?.gte('no_reply_strikes', 3)?.is('banned_at', null);

    if (error) throw error;

    const { data: admins } = await supabase?.from('profiles')?.select('email')?.eq('is_admin', true);

    for (const user of users || []) {
      try {
        await supabase?.from('profiles')?.update({
            banned_at: new Date()?.toISOString(),
            ban_reason: 'Récidive non-réponse (3 strikes ou plus)'
          })?.eq('id', user?.id);

        if (user?.email) {
          await sendEmail({
            to: user?.email,
            templateKey: 'strike_notification',
            variables: {
              strike_reason: 'Compte suspendu automatiquement (3 strikes ou plus)',
              total_strikes: user?.no_reply_strikes || 3
            }
          });
        }

        for (const admin of admins || []) {
          if (!admin?.email) continue;
          await sendEmail({
            to: admin?.email,
            templateKey: 'owner_auto_banned_alert',
            variables: {
              owner_name: user?.pseudo || 'Utilisateur',
              owner_email: user?.email || '-',
              penalty_count: user?.no_reply_strikes || 3,
              admin_url: appUrl('/administration-moderation')
            }
          });
        }

        results.banned++;
      } catch (err) {
        results?.errors?.push({ userId: user?.id, error: err?.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans processStrikes:', error);
    throw error;
  }
};

/**
 * Clean expired deposit holds (7+ days old)
 */
export const cleanExpiredHolds = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo?.setDate(sevenDaysAgo?.getDate() - 7);
    const results = { cleaned: 0, errors: [] };

    const { data: payments, error } = await supabase?.from('payments')?.select('*')?.eq('type', 'deposit_hold')?.eq('status', 'requires_capture')?.lt('created_at', sevenDaysAgo?.toISOString());

    if (error) throw error;

    for (const payment of payments || []) {
      try {
        // In production, call Stripe API to cancel hold
        await supabase?.from('payments')?.update({ status: 'cancelled' })?.eq('id', payment?.id);

        results.cleaned++;
      } catch (err) {
        results?.errors?.push({ paymentId: payment?.id, error: err?.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans cleanExpiredHolds:', error);
    throw error;
  }
};

/**
 * Send daily digest of unread notifications
 */
export const sendDailyDigest = async () => {
  try {
    const results = { sent: 0, errors: [] };

    // Get users with unread notifications
    const { data: notifications, error } = await supabase
      ?.from('notifications')
      ?.select('user_id, user:user_id(email, pseudo)')
      ?.eq('is_read', false)
      ?.eq('is_archived', false)
      ?.gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000)?.toISOString());

    if (error) throw error;

    // Group by user
    const userNotifications = {};
    notifications?.forEach(notif => {
      if (!userNotifications?.[notif?.user_id]) {
        userNotifications[notif.user_id] = {
          user: notif?.user,
          count: 0
        };
      }
      userNotifications[notif.user_id].count++;
    });

    for (const [userId, data] of Object.entries(userNotifications)) {
      try {
        await sendEmail({
          to: data?.user?.email,
          templateKey: 'notifications_digest',
          variables: {
            user_name: data?.user?.pseudo || 'Utilisateur',
            unread_count: data?.count || 0,
            notifications_url: appUrl('/notifications')
          }
        });

        results.sent++;
      } catch (err) {
        results?.errors?.push({ userId, error: err?.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur dans sendDailyDigest:', error);
    throw error;
  }
};

/**
 * Exécuter toutes les automatisations
 */
export const logRun = async (action, status = 'unknown', result = null, errorMessage = null) => {
  try {
    const { error } = await supabase?.from('job_runs')?.insert({
      action,
      status,
      result: result || null,
      error_message: errorMessage || null,
      executed_at: new Date()?.toISOString()
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("?chec de journalisation d'exécution d'automatisation :", error);
    return { success: false, error: error?.message };
  }
};

export const runAllAutomations = async () => {
  const results = {};

  try {
    results.ownerNoResponse = await checkOwnerNoResponse();
  } catch (error) {
    results.ownerNoResponse = { error: error?.message };
  }

  try {
    results.missingDocuments = await checkMissingDocuments();
  } catch (error) {
    results.missingDocuments = { error: error?.message };
  }

  try {
    results.unpaidReservations = await cancelUnpaidReservations();
  } catch (error) {
    results.unpaidReservations = { error: error?.message };
  }

  try {
    results.depositRelease = await releaseDeposits();
  } catch (error) {
    results.depositRelease = { error: error?.message };
  }

  try {
    results.inspectionSettlementWindows = await processInspectionSettlementWindows();
  } catch (error) {
    results.inspectionSettlementWindows = { error: error?.message };
  }

  try {
    results.returnReminders = await sendReturnReminders();
  } catch (error) {
    results.returnReminders = { error: error?.message };
  }

  try {
    results.strikes = await processStrikes();
  } catch (error) {
    results.strikes = { error: error?.message };
  }

  try {
    results.expiredHolds = await cleanExpiredHolds();
  } catch (error) {
    results.expiredHolds = { error: error?.message };
  }

  try {
    results.dailyDigest = await sendDailyDigest();
  } catch (error) {
    results.dailyDigest = { error: error?.message };
  }

  // Log to job_runs table
  try {
    await logRun('run_all_automations', 'completed', results, null);
  } catch (logError) {
    console.error("?chec de journalisation d'exécution d'automatisation :", logError);
  }

  return results;
};

const automationService = {
  checkOwnerNoResponse,
  checkMissingDocuments,
  cancelUnpaidReservations,
  releaseDeposits,
  rotateStrategyBDepositAuthorizations,
  processInspectionSettlementWindows,
  sendReturnReminders,
  processStrikes,
  cleanExpiredHolds,
  sendDailyDigest,
  runAllAutomations,
  logRun
};

export default automationService;



