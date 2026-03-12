import { supabase } from '../lib/supabase';

const DEFAULT_ATTESTATION =
  "Je certifie etre physiquement present avec l'autre partie au moment de la prise des photos. Toute fausse declaration engage ma responsabilite.";

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    return [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /schema cache/i,
      /Could not find the function/i
    ]?.some((pattern) => pattern?.test(error?.message));
  }
  return false;
}

function normalizePhase(phase) {
  const value = String(phase || '')?.toLowerCase();
  return value === 'end' ? 'end' : 'start';
}

function detectDeviceType() {
  const ua = String(navigator?.userAgent || '')?.toLowerCase();
  const width = Number(window?.innerWidth || 0);

  if (/ipad|tablet/.test(ua) || (width >= 768 && width <= 1024)) return 'tablet';
  if (/mobi|android|iphone/.test(ua) || (width > 0 && width < 768)) return 'mobile';
  return 'desktop';
}

async function sha256Hex(value) {
  if (!value || !window?.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const input = new TextEncoder().encode(String(value));
  const digest = await window.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildFingerprintHash() {
  try {
    const payload = {
      ua: navigator?.userAgent || null,
      lang: navigator?.language || null,
      platform: navigator?.platform || null,
      screen: typeof window !== 'undefined'
        ? `${window?.screen?.width || 0}x${window?.screen?.height || 0}`
        : null,
      tz: (() => {
        try {
          return Intl.DateTimeFormat()?.resolvedOptions?.()?.timeZone || null;
        } catch {
          return null;
        }
      })()
    };
    return await sha256Hex(JSON.stringify(payload));
  } catch {
    return null;
  }
}

const inspectionService = {
  PHASES: {
    START: 'start',
    END: 'end'
  },

  ROLES: {
    OWNER: 'owner',
    RENTER: 'renter'
  },

  ATTESTATION_TEXT: DEFAULT_ATTESTATION,
  INTERNAL_ARBITRATION_SCOPE_NOTE:
    "Pour l'arbitrage interne de la plateforme, seules les photos d'etat des lieux prises via le module officiel et les traces techniques associees sont prises en compte. Cela n'exclut pas les droits legaux de chaque partie en dehors de cet arbitrage interne.",

  SETTLEMENT_STATUSES: {
    PENDING_END_INSPECTION: 'pending_end_inspection',
    HOLD_24H: 'hold_24h',
    DISPUTED_PENDING_MODERATION: 'disputed_pending_moderation',
    RELEASED_NO_DISPUTE: 'released_no_dispute',
    RELEASED_AFTER_MODERATION: 'released_after_moderation',
    CAPTURED_AFTER_MODERATION: 'captured_after_moderation'
  },

  DISPUTE_STATUSES: {
    OPENED: 'opened',
    UNDER_REVIEW: 'under_review',
    PENDING_INFORMATION: 'pending_information',
    RESOLVED_RELEASE: 'resolved_release',
    RESOLVED_CAPTURE: 'resolved_capture',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn'
  },

  getSessionsByReservation: async (reservationId) => {
    try {
      const { data, error } = await supabase
        ?.from('reservation_inspection_sessions')
        ?.select('*')
        ?.eq('reservation_id', reservationId)
        ?.in('phase', ['start', 'end']);

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getSessionsByReservation:', error?.message);
        }
        return { data: null, error };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get inspection sessions error:', error);
      throw error;
    }
  },

  getSessionsByReservationIds: async (reservationIds = []) => {
    try {
      const ids = Array.from(new Set((reservationIds || [])?.filter(Boolean)));
      if (ids?.length === 0) return { data: [], error: null };

      const { data, error } = await supabase
        ?.from('reservation_inspection_sessions')
        ?.select('*')
        ?.in('reservation_id', ids)
        ?.in('phase', ['start', 'end']);

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.warn('Schema inspection sessions absent (bulk):', error?.message);
          return { data: [], error: null };
        }
        return { data: null, error };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get inspection sessions by reservation ids error:', error);
      throw error;
    }
  },

  getSettlementByReservation: async (reservationId) => {
    try {
      const { data, error } = await supabase
        ?.from('reservation_inspection_settlements')
        ?.select('*')
        ?.eq('reservation_id', reservationId)
        ?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.warn('Schema inspection settlement absent:', error?.message);
          return { data: null, error: null };
        }
        return { data: null, error };
      }

      return { data: data || null, error: null };
    } catch (error) {
      console.error('Get inspection settlement error:', error);
      throw error;
    }
  },

  getDisputesByReservation: async (reservationId) => {
    try {
      const { data, error } = await supabase
        ?.from('reservation_inspection_disputes')
        ?.select('*')
        ?.eq('reservation_id', reservationId)
        ?.order('opened_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.warn('Schema inspection disputes absent:', error?.message);
          return { data: [], error: null };
        }
        return { data: null, error };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get inspection disputes error:', error);
      throw error;
    }
  },

  getDisputePhotoSelectionsByDisputeIds: async (disputeIds = []) => {
    try {
      const ids = Array.from(new Set((disputeIds || [])?.filter(Boolean)));
      if (ids?.length === 0) return { data: [], error: null };

      const { data, error } = await supabase
        ?.from('reservation_inspection_dispute_photos')
        ?.select('*')
        ?.in('dispute_id', ids)
        ?.order('id', { ascending: true });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.warn('Schema dispute photo selections absent:', error?.message);
          return { data: [], error: null };
        }
        return { data: null, error };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get dispute photo selections error:', error);
      throw error;
    }
  },

  openDispute: async ({ reservationId, selectedPhotoIds, description, title = null } = {}) => {
    try {
      const cleanedPhotoIds = Array.from(
        new Set((selectedPhotoIds || [])?.map((id) => String(id || '')?.trim())?.filter(Boolean))
      );

      const { data, error } = await supabase?.rpc('open_reservation_inspection_dispute', {
        p_reservation_id: reservationId,
        p_selected_photo_ids: cleanedPhotoIds,
        p_description: description || '',
        p_title: title || null
      });

      if (error) {
        if (isSchemaError(error)) {
          return { data: null, error: { message: "Le module de litige officiel n'est pas encore activé sur la base de données." } };
        }
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error('Open inspection dispute error:', error);
      throw error;
    }
  },

  processDueSettlements: async ({ limit = 100 } = {}) => {
    try {
      const { data, error } = await supabase?.rpc('process_due_reservation_inspection_settlements', {
        p_limit: Number(limit || 100)
      });
      if (error) {
        if (isSchemaError(error)) return { data: { processed: 0, released_reservation_ids: [], frozen_reservation_ids: [] }, error: null };
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error('Process due inspection settlements error:', error);
      throw error;
    }
  },

  getDisputesForModeration: async ({
    statuses = ['opened', 'under_review', 'pending_information'],
    limit = 100
  } = {}) => {
    try {
      const normalizedStatuses = Array.isArray(statuses)
        ? Array.from(
          new Set(
            statuses
              ?.map((status) => String(status || '')?.trim()?.toLowerCase())
              ?.filter(Boolean)
          )
        )
        : [];

      let query = supabase
        ?.from('reservation_inspection_disputes')
        ?.select('*')
        ?.order('opened_at', { ascending: false })
        ?.limit(Math.max(Number(limit || 100), 1));

      if (normalizedStatuses?.length > 0) {
        query = query?.in('status', normalizedStatuses);
      }

      const { data, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.warn('Schema inspection disputes absent (moderation list):', error?.message);
          return { data: [], error: null };
        }
        return { data: null, error };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get disputes for moderation error:', error);
      throw error;
    }
  },

  getSettlementsByReservationIds: async (reservationIds = []) => {
    try {
      const ids = Array.from(new Set((reservationIds || [])?.filter(Boolean)));
      if (ids?.length === 0) return { data: [], error: null };

      const { data, error } = await supabase
        ?.from('reservation_inspection_settlements')
        ?.select('*')
        ?.in('reservation_id', ids);

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.warn('Schema inspection settlements absent (bulk):', error?.message);
          return { data: [], error: null };
        }
        return { data: null, error };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get settlements by reservation ids error:', error);
      throw error;
    }
  },

  getReservationsByIds: async (reservationIds = []) => {
    try {
      const ids = Array.from(new Set((reservationIds || [])?.filter(Boolean)));
      if (ids?.length === 0) return { data: [], error: null };

      const { data, error } = await supabase
        ?.from('reservations')
        ?.select('*')
        ?.in('id', ids);

      if (error) return { data: null, error };
      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Get reservations by ids error:', error);
      throw error;
    }
  },

  moderateDispute: async ({ disputeId, decision, moderatorNote = null } = {}) => {
    try {
      const { data, error } = await supabase?.rpc('moderate_reservation_inspection_dispute', {
        p_dispute_id: Number(disputeId),
        p_decision: String(decision || ''),
        p_moderator_note: moderatorNote || null
      });

      if (error) {
        if (isSchemaError(error)) {
          return { data: null, error: { message: "Le module de modération des litiges n'est pas encore actif sur la base de données." } };
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Moderate inspection dispute error:', error);
      throw error;
    }
  },

  confirmPresence: async ({ reservationId, phase, coordinates = null } = {}) => {
    try {
      const normalizedPhase = normalizePhase(phase);
      const fingerprintHash = await buildFingerprintHash();
      const deviceType = detectDeviceType();
      const userAgent = navigator?.userAgent || null;
      const metadata = {
        timezone: (() => {
          try {
            return Intl.DateTimeFormat()?.resolvedOptions?.()?.timeZone || null;
          } catch {
            return null;
          }
        })(),
        language: navigator?.language || null
      };

      const edgeBody = {
        reservationId,
        phase: normalizedPhase,
        attestationText: DEFAULT_ATTESTATION,
        deviceType,
        deviceFingerprintHash: fingerprintHash,
        userAgent,
        clientReportedCoordinates: coordinates,
        metadata
      };

      try {
        const { data, error } = await supabase?.functions?.invoke('confirm-inspection-presence', {
          body: edgeBody
        });

        if (!error && data?.session) {
          return { data: data?.session, error: null };
        }

        if (error && !isSchemaError(error)) {
          console.warn('Edge Function confirm-inspection-presence indisponible, fallback RPC:', error);
        }
      } catch (edgeError) {
        console.warn('Erreur Edge Function confirm-inspection-presence, fallback RPC:', edgeError);
      }

      const { data, error } = await supabase?.rpc('confirm_reservation_inspection_presence', {
        p_reservation_id: reservationId,
        p_phase: normalizedPhase,
        p_attestation_text: DEFAULT_ATTESTATION,
        p_ip_address: null,
        p_user_agent: userAgent,
        p_device_fingerprint_hash: fingerprintHash,
        p_device_type: deviceType,
        p_client_reported_coordinates: coordinates,
        p_metadata: metadata
      });

      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      console.error('Confirm inspection presence error:', error);
      throw error;
    }
  },

  finalizePhotos: async ({ reservationId, phase } = {}) => {
    try {
      const { data, error } = await supabase?.rpc('finalize_reservation_inspection_photos', {
        p_reservation_id: reservationId,
        p_phase: normalizePhase(phase)
      });

      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      console.error('Finalize inspection photos error:', error);
      throw error;
    }
  }
};

export default inspectionService;

