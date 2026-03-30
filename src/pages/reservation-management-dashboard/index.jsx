import React, { useEffect, useState } from 'react';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Select from '../../components/ui/Select';
import ReservationCard from './components/ReservationCard';
import ContractPreviewModal from './components/ContractPreviewModal';
import ChatPopupModal from './components/ChatPopupModal';
import ReservationAdjustmentModal from './components/ReservationAdjustmentModal';
import toast from 'react-hot-toast';
import {
  ActionCard,
  ActionEmptyState,
  ActionHero,
  ActionPageShell
} from '../../components/page/ActionPageLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import reservationService from '../../services/reservationService';
import storageService from '../../services/storageService';
import messageService from '../../services/messageService';
import inspectionService from '../../services/inspectionService';
import { normalizeTimeValue } from '../../utils/timeSlots';
import { computeOwnerNetEstimate } from '../../utils/pricingPolicy';
import { getEarliestReservationStartDate } from '../../utils/reservationDateRules';
import { isReservationPaymentConfirmed } from '../../utils/reservationStatus';
import { buildAppRedirectUrl, redirectToExternalUrl } from '../../utils/nativeRuntime';
import {
  appendAdminVerificationParamsToPath,
  isAdminVerificationScenario
} from '../../utils/adminVerificationContext';

const FALLBACK_IMAGE = '/assets/images/no_image.png';
const DEFAULT_STATUS_FILTER = 'open';
const NON_TERMINAL_RESERVATION_STATUSES = new Set(['upcoming', 'ongoing']);

const normalizeDateOnly = (value) => {
  const parsedDate = value ? new Date(value) : null;
  if (!parsedDate || Number.isNaN(parsedDate?.getTime())) return null;

  parsedDate?.setHours(0, 0, 0, 0);
  return parsedDate;
};

const normalizeStatus = (reservation) => {
  const normalizedStatus = String(reservation?.status || '')?.toLowerCase();
  const paymentConfirmed = isReservationPaymentConfirmed(reservation);
  const today = normalizeDateOnly(new Date());
  const startDate = normalizeDateOnly(reservation?.start_date);
  const endDate = normalizeDateOnly(reservation?.end_date);

  if (
    ['refused', 'rejected', 'cancelled']?.includes(normalizedStatus)
    || normalizedStatus?.startsWith('cancelled')
  ) {
    return 'cancelled';
  }
  if (normalizedStatus === 'completed') return 'completed';
  if (!paymentConfirmed) return 'pending';
  if (endDate && today && endDate < today) return 'completed';
  if (startDate && today && startDate > today) return 'upcoming';
  return 'ongoing';
};

const resolvePhotoCandidate = (candidate) => {
  if (!candidate) return null;

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const resolved = resolvePhotoCandidate(item);
      if (resolved) return resolved;
    }
    return null;
  }

  if (typeof candidate === 'object') {
    return resolvePhotoCandidate(
      candidate?.url
      || candidate?.src
      || candidate?.file_url
      || candidate?.path
      || candidate?.image_url
      || candidate?.photo_url
    );
  }

  if (typeof candidate !== 'string') return null;
  const rawValue = candidate?.trim();
  if (!rawValue) return null;

  if (rawValue?.startsWith('[') || rawValue?.startsWith('{')) {
    try {
      return resolvePhotoCandidate(JSON.parse(rawValue));
    } catch (_error) {
      return null;
    }
  }

  return storageService?.getAnnoncePhotoUrl(rawValue) || rawValue;
};

const getPhotoUrl = (annonce) => {
  const candidates = [
    annonce?.photos,
    annonce?.images,
    annonce?.image,
    annonce?.image_url,
    annonce?.photo_url
  ];

  for (const candidate of candidates) {
    const resolved = resolvePhotoCandidate(candidate);
    if (resolved) return resolved;
  }

  return FALLBACK_IMAGE;
};

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const toDateOrNull = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value?.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value?.trim();
    const dateOnlyMatch = trimmed?.match(DATE_ONLY_REGEX);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
      return Number.isNaN(localDate?.getTime()) ? null : localDate;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date?.getTime()) ? null : date;
};

const isDateReached = (date, now = new Date()) => Boolean(date && now >= date);

const isReservationPaid = (reservation) => isReservationPaymentConfirmed(reservation);

const loadApprovedIdentityUserIds = async (userIds = []) => {
  const normalizedUserIds = Array.from(
    new Set(
      (userIds || [])
        ?.map((userId) => String(userId || '')?.trim())
        ?.filter(Boolean)
    )
  );

  if (normalizedUserIds?.length === 0) {
    return new Set();
  }

  try {
    const { data, error } = await supabase
      ?.from('user_profile_documents')
      ?.select('user_id')
      ?.eq('document_type', 'identity')
      ?.eq('status', 'approved')
      ?.in('user_id', normalizedUserIds);

    if (error) {
      console.warn('Impossible de charger les validations CNI pour les réservations:', error?.message || error);
      return new Set();
    }

    return new Set(
      (data || [])
        ?.map((row) => String(row?.user_id || '')?.trim())
        ?.filter(Boolean)
    );
  } catch (error) {
    console.warn('Chargement CNI approuvées dégradé pour les réservations:', error?.message || error);
    return new Set();
  }
};

const combineDateAndTime = (dateValue, timeValue) => {
  const baseDate = toDateOrNull(dateValue);
  if (!baseDate) return null;

  const normalizedTime = normalizeTimeValue(timeValue);
  if (!normalizedTime) return baseDate;

  const [hoursString, minutesString] = normalizedTime?.split(':');
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return baseDate;

  const withTime = new Date(baseDate);
  withTime?.setHours(hours, minutes, 0, 0);
  return Number.isNaN(withTime?.getTime()) ? baseDate : withTime;
};

const normalizeAddressForComparison = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildReservationAddressLine = ({ address = '', postalCode = '', city = '' } = {}) => {
  const normalizedAddress = String(address || '')?.trim();
  const localityLine = [postalCode, city]?.filter(Boolean)?.join(' ')?.trim();

  if (!normalizedAddress) return localityLine || null;
  if (!localityLine) return normalizedAddress;

  const comparableAddress = normalizeAddressForComparison(normalizedAddress);
  const comparableLocality = normalizeAddressForComparison(localityLine);

  if (comparableLocality && comparableAddress?.includes(comparableLocality)) {
    return normalizedAddress;
  }

  return `${normalizedAddress}, ${localityLine}`;
};

const getSuggestedRebookingWindow = (reservation = {}) => {
  const currentStartDate = toDateOrNull(reservation?.startDate || reservation?.start_date);
  const currentEndDate = toDateOrNull(reservation?.endDate || reservation?.end_date);
  const fallbackStartDate = getEarliestReservationStartDate();
  const currentEndPlusOneDay = currentEndDate
    ? new Date(currentEndDate.getFullYear(), currentEndDate.getMonth(), currentEndDate.getDate() + 1, 12, 0, 0, 0)
    : null;

  const suggestedStartDate = currentEndPlusOneDay && currentEndPlusOneDay > fallbackStartDate
    ? currentEndPlusOneDay
    : fallbackStartDate;

  const reservationDurationDays = currentStartDate && currentEndDate
    ? Math.max(1, Math.round((currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24)) + 1)
    : 1;

  const suggestedEndDate = new Date(suggestedStartDate);
  suggestedEndDate?.setDate(suggestedEndDate.getDate() + reservationDurationDays - 1);

  return {
    startDate: suggestedStartDate,
    endDate: suggestedEndDate
  };
};

const buildTimelineStep = ({
  id,
  event,
  type = 'info',
  date = null,
  done = false,
  skipped = false
}) => ({
  id,
  event,
  type,
  date: date ? date?.toISOString() : null,
  state: done ? 'done' : skipped ? 'skipped' : 'upcoming'
});

const buildTimeline = (reservation, viewerRole = 'owner') => {
  const status = String(reservation?.status || '')?.toLowerCase();
  const derivedStatus = normalizeStatus(reservation);
  const depositStatus = String(reservation?.deposit_status || '')?.toLowerCase();
  const depositRefundStatus = String(reservation?.deposit_refund_status || '')?.toLowerCase();
  const pickupTimeStart = reservation?.pickup_time_start || reservation?.annonce?.pickup_time_start || null;
  const pickupTimeEnd = reservation?.pickup_time_end || reservation?.annonce?.pickup_time_end || null;
  const returnTimeStart = reservation?.return_time_start || reservation?.annonce?.return_time_start || null;
  const returnTimeEnd = reservation?.return_time_end || reservation?.annonce?.return_time_end || null;

  const createdAt = toDateOrNull(reservation?.created_at);
  const paidAt = toDateOrNull(reservation?.paid_at || reservation?.tenant_payment_paid_at);
  const updatedAt = toDateOrNull(reservation?.updated_at);
  const startAt = toDateOrNull(reservation?.start_date);
  const endAt = toDateOrNull(reservation?.end_date);
  const completedAt = toDateOrNull(reservation?.completed_at);
  const cancelledAt = toDateOrNull(reservation?.cancelled_at);
  const startInspectionClosedAt = toDateOrNull(reservation?.start_inspection_closed_at || reservation?.startInspectionClosedAt);
  const pickupHandoverConfirmedAt = toDateOrNull(reservation?.pickup_handover_confirmed_at || reservation?.pickupHandoverConfirmedAt);
  const pickupRentalStartedAt = toDateOrNull(reservation?.pickup_rental_started_at || reservation?.pickupRentalStartedAt);
  const handoverAt = toDateOrNull(
    reservation?.pickup_handover_confirmed_at
    || reservation?.handover_completed_at
    || reservation?.handover_at
  );
  const checkinValidatedAt = toDateOrNull(
    reservation?.checkin_validated_at
    || reservation?.inspection_checkin_validated_at
    || reservation?.inspection_entry_validated_at
  );
  const returnDoneAt = toDateOrNull(reservation?.return_completed_at || reservation?.returned_at);
  const returnCheckValidatedAt = toDateOrNull(
    reservation?.checkout_validated_at
    || reservation?.return_check_validated_at
    || reservation?.inspection_checkout_validated_at
    || reservation?.inspection_return_validated_at
  );
  const depositReleasedAt = toDateOrNull(reservation?.deposit_released_at);
  const depositRefundedAt = toDateOrNull(reservation?.deposit_refunded_at);
  const ownerPayoutReleasedAt = toDateOrNull(reservation?.owner_payout_released_at || reservation?.payment_released_at);
  const now = new Date();
  const plannedStartAt = combineDateAndTime(reservation?.start_date, pickupTimeStart || pickupTimeEnd);
  const plannedEndAt = combineDateAndTime(reservation?.end_date, returnTimeEnd || returnTimeStart);

  const isCancelled = derivedStatus === 'cancelled';
  const isCompleted = derivedStatus === 'completed';
  const isPaid = Boolean(paidAt) || ['paid', 'active', 'ongoing', 'completed']?.includes(status);
  const isRentalEnded = Boolean(plannedEndAt || endAt) && (isDateReached(plannedEndAt || endAt, now) || isCompleted);

  const isRenterView = viewerRole === 'renter';
  const handoverLabel = isRenterView ? 'Matériel récupéré par le locataire' : 'Matériel remis au locataire';
  const returnLabel = isRenterView ? 'Matériel retourne au propriétaire' : 'Matériel récupéré au retour';
  const checkinLabel = isRenterView ? 'État des lieux entrée validé' : 'État des lieux de remise validé';
  const checkoutLabel = isRenterView ? 'État des lieux sortie validé' : 'État des lieux de retour validé';
  const paymentConfirmedLabel = isRenterView
    ? 'Paiement location confirmé'
    : 'Paiement locataire reçu et sécurisé';
  const paymentPendingLabel = isRenterView
    ? 'Paiement location à finaliser'
    : 'Paiement locataire à finaliser';
  const ownerPayoutLabel = isRenterView
    ? 'Paiement propriétaire libéré'
    : ((ownerPayoutReleasedAt || isCompleted) ? 'Versement propriétaire envoyé' : 'Versement propriétaire à venir');
  const cardDepositRecorded = isPaid || ['pending', 'held', 'authorized', 'released', 'captured']?.includes(depositStatus);
  const cautionPickupDone = Boolean(cardDepositRecorded);
  const checkinPickupDone = Boolean(checkinValidatedAt || startInspectionClosedAt);
  const handoverPickupDone = Boolean(pickupHandoverConfirmedAt || handoverAt);
  const rentalStartedDone = Boolean(pickupRentalStartedAt || ['active', 'ongoing', 'completed']?.includes(status));
  const pickupChecklistDone = cautionPickupDone && checkinPickupDone && handoverPickupDone && rentalStartedDone;
  const isRentalOngoing = !isCancelled && pickupChecklistDone && !isRentalEnded;

  const timeline = [];
  const pushTimelineStep = ({ id, event, type = 'info', date = null, done = false }) => {
    if (!date) return;
    timeline?.push(buildTimelineStep({ id, event, type, date, done }));
  };

  pushTimelineStep({
    id: 'reservation_created',
    event: 'Réservation créée',
    type: 'info',
    date: createdAt,
    done: Boolean(createdAt)
  });

  if (createdAt || updatedAt) {
    pushTimelineStep({
      id: 'slot_auto_confirmed',
      event: 'Créneau confirmé automatiquement',
      type: 'success',
      date: createdAt || updatedAt,
      done: true
    });
  }

  if (isPaid) {
    pushTimelineStep({
      id: 'payment_confirmed',
      event: paymentConfirmedLabel,
      type: 'success',
      date: paidAt || updatedAt || createdAt,
      done: true
    });
  } else if (!isCancelled) {
    pushTimelineStep({
      id: 'payment_due',
      event: paymentPendingLabel,
      type: 'warning',
      date: createdAt || updatedAt,
      done: false
    });
  }

  if (cardDepositRecorded) {
    pushTimelineStep({
      id: 'caution_cb_recorded',
      event: 'Empreinte CB enregistrée',
      type: 'info',
      date: paidAt || updatedAt || createdAt,
      done: true
    });
  }

  if ((plannedStartAt || startAt) && !rentalStartedDone && !isCancelled) {
    pushTimelineStep({
      id: 'waiting_pickup_day',
      event: 'En attente du jour de remise',
      type: 'pending',
      date: plannedStartAt || startAt,
      done: false
    });
  }

  const effectiveStartAt = pickupRentalStartedAt || pickupHandoverConfirmedAt || handoverAt || plannedStartAt || startAt;
  if (effectiveStartAt && !isCancelled) {
    pushTimelineStep({
      id: 'rental_started',
      event: 'Début de location',
      type: rentalStartedDone ? 'success' : 'pending',
      date: effectiveStartAt,
      done: rentalStartedDone
    });
  }

  const effectiveCheckinAt = checkinValidatedAt || startInspectionClosedAt || plannedStartAt || startAt;
  if (effectiveCheckinAt && !isCancelled) {
    pushTimelineStep({
      id: 'checkin_validated',
      event: checkinLabel,
      type: checkinPickupDone ? 'success' : 'pending',
      date: effectiveCheckinAt,
      done: checkinPickupDone
    });
  }

  const effectiveHandoverAt = pickupHandoverConfirmedAt || handoverAt || plannedStartAt || startAt;
  if (effectiveHandoverAt && !isCancelled) {
    pushTimelineStep({
      id: 'handover_done',
      event: handoverLabel,
      type: handoverPickupDone ? 'success' : 'pending',
      date: effectiveHandoverAt,
      done: handoverPickupDone
    });
  }

  if ((plannedStartAt || startAt || effectiveHandoverAt) && !isCancelled) {
    const rentalOngoingDone = pickupChecklistDone && (isRentalOngoing || isRentalEnded || isCompleted);
    pushTimelineStep({
      id: 'rental_ongoing',
      event: 'Location en cours',
      type: isRentalOngoing ? 'pending' : (rentalOngoingDone ? 'success' : 'pending'),
      date: plannedStartAt || startAt || effectiveHandoverAt,
      done: rentalOngoingDone
    });
  }

  const effectiveEndAt = plannedEndAt || endAt;
  if (effectiveEndAt && !isCancelled) {
    pushTimelineStep({
      id: 'rental_end',
      event: 'Fin de location prévue',
      type: isRentalEnded ? 'success' : 'pending',
      date: effectiveEndAt,
      done: isRentalEnded
    });
  }

  const returnMilestoneAt = returnDoneAt || plannedEndAt || endAt || completedAt;
  if (returnMilestoneAt && !isCancelled) {
    pushTimelineStep({
      id: 'material_returned',
      event: returnLabel,
      type: (returnDoneAt || isCompleted) ? 'success' : 'pending',
      date: returnMilestoneAt,
      done: Boolean(returnDoneAt || isCompleted)
    });
  }

  const returnInspectionAt = returnCheckValidatedAt || returnMilestoneAt;
  if (returnInspectionAt && !isCancelled) {
    pushTimelineStep({
      id: 'return_check_validated',
      event: checkoutLabel,
      type: (returnCheckValidatedAt || isCompleted) ? 'success' : 'pending',
      date: returnInspectionAt,
      done: Boolean(returnCheckValidatedAt || isCompleted)
    });
  }

  let cautionClosedAt = null;

  const isCardCaptured = depositStatus === 'captured' || depositRefundStatus === 'captured';
  const cardCapturedAt = depositRefundedAt || depositReleasedAt || updatedAt || plannedEndAt || endAt || completedAt;
  const cardReleasedAt = depositRefundedAt || depositReleasedAt || completedAt || plannedEndAt || endAt;

  if (isCardCaptured && cardCapturedAt) {
    cautionClosedAt = cardCapturedAt;
    pushTimelineStep({
      id: 'caution_cb_captured',
      event: 'Empreinte CB capturée (litige ou dégâts)',
      type: 'warning',
      date: cardCapturedAt,
      done: true
    });
  } else if (cardReleasedAt) {
    const isClosed = Boolean(depositRefundedAt || depositReleasedAt || isCompleted);
    cautionClosedAt = cardReleasedAt;
    pushTimelineStep({
      id: 'caution_cb_closed',
      event: 'Empreinte CB libérée (non débitée) / remboursée si capture préalable',
      type: isClosed ? 'success' : 'pending',
      date: cardReleasedAt,
      done: isClosed
    });
  }

  const ownerPayoutDate = ownerPayoutReleasedAt || completedAt || plannedEndAt || endAt;
  if (ownerPayoutDate && !isCancelled) {
    pushTimelineStep({
      id: 'owner_payment_released',
      event: ownerPayoutLabel,
      type: (ownerPayoutReleasedAt || isCompleted) ? 'success' : 'pending',
      date: ownerPayoutDate,
      done: Boolean(ownerPayoutReleasedAt || isCompleted)
    });
  }

  if (isCancelled) {
    pushTimelineStep({
      id: 'reservation_cancelled',
      event: 'Réservation annulée',
      type: 'error',
      date: cancelledAt || updatedAt || createdAt,
      done: true
    });
  }

  const conclusionAt = completedAt || (isCompleted ? (cautionClosedAt || ownerPayoutDate || updatedAt) : null);
  if (conclusionAt && !isCancelled) {
    pushTimelineStep({
      id: 'rental_concluded',
      event: 'Location conclue',
      type: 'success',
      date: conclusionAt,
      done: true
    });
  }

  if (!isCompleted && !isCancelled) {
    const nextStepIndex = timeline?.findIndex((step) => step?.state === 'upcoming');
    if (nextStepIndex >= 0) {
      timeline[nextStepIndex] = {
        ...timeline[nextStepIndex],
        state: 'current'
      };
    } else if (isRentalOngoing) {
      const ongoingStepIndex = timeline?.findIndex((step) => step?.id === 'rental_ongoing');
      if (ongoingStepIndex >= 0) {
        timeline[ongoingStepIndex] = {
          ...timeline[ongoingStepIndex],
          state: 'current'
        };
      }
    }
  }

  return timeline;
};

const mapReservationToCard = (reservation, viewerRole = 'owner') => {
  const isRenterView = viewerRole === 'renter';
  const participantLabel = isRenterView ? 'Propriétaire' : 'Locataire';
  const participantProfile = isRenterView ? reservation?.owner : reservation?.renter;
  const totalAmount = Number.parseFloat(reservation?.total_price ?? reservation?.totalAmount ?? 0);
  const cautionAmount = Number.parseFloat(
    reservation?.caution_amount ?? reservation?.deposit_amount ?? reservation?.annonce?.caution ?? 0
  );
  const paymentConfirmed = isReservationPaid(reservation);
  const identityApproved = Boolean(reservation?.identity_approved || reservation?.identityApproved);
  const paidAt = reservation?.paid_at || reservation?.tenant_payment_paid_at || null;
  const ownerPayoutReleasedAt = reservation?.owner_payout_released_at || reservation?.payment_released_at || null;
  const reservationAddress = String(
    reservation?.annonce?.address
    || reservation?.annonce?.adresse
    || reservation?.annonce?.location
    || ''
  )?.trim();
  const reservationPostalCode = String(
    reservation?.annonce?.postal_code
    || reservation?.annonce?.code_postal
    || ''
  )?.trim();
  const reservationCity = String(
    reservation?.annonce?.city
    || reservation?.annonce?.ville
    || ''
  )?.trim();
  const reservationAddressLine = buildReservationAddressLine({
    address: reservationAddress,
    postalCode: reservationPostalCode,
    city: reservationCity
  });
  const ownerNetAmount = computeOwnerNetEstimate({
    rentalAmount: totalAmount
  })?.ownerNetEstimate || 0;
  const ownerPayoutAmount = Number.parseFloat(reservation?.owner_payout_amount ?? reservation?.ownerPayoutAmount ?? ownerNetAmount ?? 0);
  const refundAmount = Number.parseFloat(reservation?.refund_amount ?? reservation?.refundAmount ?? 0);

  return {
    id: reservation?.id,
    annonceId: reservation?.annonce_id,
    ownerId: reservation?.owner_id,
    renterId: reservation?.renter_id,
    equipmentTitle: reservation?.annonce?.titre || 'Annonce',
    equipmentImage: getPhotoUrl(reservation?.annonce),
    equipmentImageAlt: reservation?.annonce?.titre || 'Matériel',
    renterPseudo: participantProfile?.pseudo || participantLabel,
    renterAvatar: participantProfile?.avatar_url || FALLBACK_IMAGE,
    participantLabel,
    participantPseudo: participantProfile?.pseudo || participantLabel,
    participantAvatar: participantProfile?.avatar_url || FALLBACK_IMAGE,
    startDate: reservation?.start_date,
    endDate: reservation?.end_date,
    pickupTimeStart: reservation?.pickup_time_start || reservation?.annonce?.pickup_time_start || null,
    pickupTimeEnd: reservation?.pickup_time_end || reservation?.annonce?.pickup_time_end || null,
    returnTimeStart: reservation?.return_time_start || reservation?.annonce?.return_time_start || null,
    returnTimeEnd: reservation?.return_time_end || reservation?.annonce?.return_time_end || null,
    pickupAddress: reservationAddress || null,
    pickupPostalCode: reservationPostalCode || null,
    pickupCity: reservationCity || null,
    pickupAddressLine: reservationAddressLine || null,
    canRevealPickupAddress: !isRenterView || (paymentConfirmed && identityApproved),
    identityApproved,
    isPaid: paymentConfirmed,
    status: normalizeStatus(reservation),
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    ownerNetAmount: Number.isFinite(ownerPayoutAmount) ? ownerPayoutAmount : 0,
    cautionAmount: Number.isFinite(cautionAmount) ? cautionAmount : 0,
    cautionStatus: reservation?.deposit_status || reservation?.caution_status || 'pending',
    cautionMode: reservation?.caution_mode || reservation?.mode_caution || 'cb',
    paidAt,
    ownerPayoutReleasedAt,
    ownerPayoutStatus: reservation?.owner_payout_status || reservation?.ownerPayoutStatus || null,
    ownerPayoutAmount: Number.isFinite(ownerPayoutAmount) ? ownerPayoutAmount : 0,
    ownerPayoutLastError: reservation?.owner_payout_last_error || reservation?.ownerPayoutLastError || null,
    refundStatus: reservation?.refund_status || reservation?.refundStatus || null,
    refundAmount: Number.isFinite(refundAmount) ? refundAmount : 0,
    startInspectionClosedAt: reservation?.start_inspection_closed_at || reservation?.startInspectionClosedAt || null,
    pickupHandoverConfirmedAt: reservation?.pickup_handover_confirmed_at || reservation?.pickupHandoverConfirmedAt || null,
    pickupRentalStartedAt: reservation?.pickup_rental_started_at || reservation?.pickupRentalStartedAt || null,
    checkinValidatedAt: reservation?.checkin_validated_at || reservation?.inspection_checkin_validated_at || reservation?.inspection_entry_validated_at || null,
    handoverAt: reservation?.pickup_handover_confirmed_at || reservation?.handover_completed_at || reservation?.handover_at || null,
    requestDate: reservation?.created_at || reservation?.updated_at || reservation?.start_date,
    timeline: buildTimeline(reservation, viewerRole),
    contractUrl: reservation?.contract_url || null,
    adjustmentSummary: reservation?.adjustment_summary || reservation?.adjustmentSummary || null,
    rawStatus: reservation?.status,
    viewerRole
  };
};

const ReservationManagementDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isVerificationReservationScenario = isAdminVerificationScenario('booking_manage_reservations');
  const isVerificationPickupScenario = isAdminVerificationScenario('booking_pickup_day');
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [startingChatReservationId, setStartingChatReservationId] = useState(null);
  const [chatModalConversationId, setChatModalConversationId] = useState(null);
  const [chatModalReservation, setChatModalReservation] = useState(null);
  const [chatModalDraftMessage, setChatModalDraftMessage] = useState('');
  const [adjustmentModalReservation, setAdjustmentModalReservation] = useState(null);
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const [pickupStepInFlight, setPickupStepInFlight] = useState({ reservationId: null, step: null });
  const ownerCancellationSyncRef = useRef('');
  const requestedConversationId = String(searchParams?.get('conversation') || '')?.trim();
  const requestedAnnonceIdRaw = String(searchParams?.get('annonce') || '')?.trim();
  const requestedAnnonceId = requestedAnnonceIdRaw !== '' && Number.isFinite(Number(requestedAnnonceIdRaw))
    ? Number(requestedAnnonceIdRaw)
    : null;
  const requestedOtherUserId = String(searchParams?.get('other') || '')?.trim();
  const ownerCancellationStatus = String(searchParams?.get('ownerCancellationStatus') || '')?.trim()?.toLowerCase();
  const ownerCancellationSessionId = String(searchParams?.get('ownerCancellationSessionId') || '')?.trim();
  const ownerCancellationReservationId = String(searchParams?.get('ownerCancellationReservationId') || '')?.trim();
  const ownerCancellationAction = String(searchParams?.get('ownerCancellationAction') || '')?.trim()?.toLowerCase();

  const clearChatQueryParams = () => {
    if (
      !searchParams?.get('conversation')
      && !searchParams?.get('annonce')
      && !searchParams?.get('other')
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams?.delete('conversation');
    nextParams?.delete('annonce');
    nextParams?.delete('other');
    setSearchParams(nextParams, { replace: true });
  };

  const clearOwnerCancellationQueryParams = () => {
    if (
      !searchParams?.get('ownerCancellationStatus')
      && !searchParams?.get('ownerCancellationSessionId')
      && !searchParams?.get('ownerCancellationReservationId')
      && !searchParams?.get('ownerCancellationAction')
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams?.delete('ownerCancellationStatus');
    nextParams?.delete('ownerCancellationSessionId');
    nextParams?.delete('ownerCancellationReservationId');
    nextParams?.delete('ownerCancellationAction');
    setSearchParams(nextParams, { replace: true });
  };

  const loadReservations = async () => {
    if (isVerificationReservationScenario || isVerificationPickupScenario) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(today.getDate() + 2);

      const verificationRows = isVerificationPickupScenario
        ? [
          {
            id: 'verification-pickup-reservation',
            annonce_id: 'verification-offer',
            owner_id: user?.id || 'verification-owner',
            renter_id: 'verification-renter',
            start_date: today.toISOString(),
            end_date: tomorrow.toISOString(),
            start_inspection_closed_at: null,
            pickup_handover_confirmed_at: null,
            pickup_rental_started_at: null,
            created_at: today.toISOString(),
            status: 'active',
            total_price: 38,
            caution_amount: 250,
            deposit_status: 'authorized',
            identity_approved: true,
            contract_url: '/verification/contracts/admin-check.pdf',
            annonce: {
              titre: 'Réservation jour J de vérification',
              photos: [],
              address: '12 rue de verification',
              postal_code: '75002',
              city: 'Paris',
              caution: 250,
              pickup_time_start: '09:00',
              pickup_time_end: '11:00',
              return_time_start: '18:00',
              return_time_end: '19:00'
            },
            renter: {
              pseudo: 'locataire_verification',
              avatar_url: FALLBACK_IMAGE
            },
            owner: {
              pseudo: 'proprietaire_verification',
              avatar_url: FALLBACK_IMAGE
            }
          }
        ]
        : [
          {
            id: 'verification-upcoming-reservation',
            annonce_id: 'verification-offer-1',
            owner_id: user?.id || 'verification-owner',
            renter_id: 'verification-renter-1',
            start_date: tomorrow.toISOString(),
            end_date: twoDaysLater.toISOString(),
            created_at: today.toISOString(),
            status: 'active',
            total_price: 38,
            caution_amount: 250,
            deposit_status: 'authorized',
            identity_approved: true,
            contract_url: '/verification/contracts/admin-check.pdf',
            annonce: {
              titre: 'Reservation active de verification',
              photos: [],
              address: '12 rue de verification',
              postal_code: '75002',
              city: 'Paris',
              caution: 250,
              pickup_time_start: '09:00',
              pickup_time_end: '11:00',
              return_time_start: '18:00',
              return_time_end: '19:00'
            },
            renter: {
              pseudo: 'locataire_verification',
              avatar_url: FALLBACK_IMAGE
            },
            owner: {
              pseudo: 'proprietaire_verification',
              avatar_url: FALLBACK_IMAGE
            }
          },
          {
            id: 'verification-completed-reservation',
            annonce_id: 'verification-offer-2',
            owner_id: user?.id || 'verification-owner',
            renter_id: 'verification-renter-2',
            start_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString(),
            end_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).toISOString(),
            created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8).toISOString(),
            completed_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).toISOString(),
            status: 'completed',
            total_price: 55,
            caution_amount: 150,
            deposit_status: 'released',
            identity_approved: true,
            annonce: {
              titre: 'Reservation terminee de verification',
              photos: [],
              address: '4 avenue du test',
              postal_code: '69001',
              city: 'Lyon',
              caution: 150
            },
            renter: {
              pseudo: 'locataire_termine',
              avatar_url: FALLBACK_IMAGE
            },
            owner: {
              pseudo: 'proprietaire_verification',
              avatar_url: FALLBACK_IMAGE
            }
          },
          {
            id: 'verification-cancelled-reservation',
            annonce_id: 'verification-offer-3',
            owner_id: user?.id || 'verification-owner',
            renter_id: 'verification-renter-3',
            start_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toISOString(),
            end_date: tomorrow.toISOString(),
            created_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4).toISOString(),
            status: 'cancelled',
            total_price: 27,
            caution_amount: 0,
            deposit_status: 'none',
            identity_approved: false,
            annonce: {
              titre: 'Reservation annulee de verification',
              photos: [],
              address: '8 place du scenario',
              postal_code: '33000',
              city: 'Bordeaux',
              caution: 0
            },
            renter: {
              pseudo: 'locataire_annule',
              avatar_url: FALLBACK_IMAGE
            },
            owner: {
              pseudo: 'proprietaire_verification',
              avatar_url: FALLBACK_IMAGE
            }
          }
        ];

      setReservations(verificationRows.map((row) => mapReservationToCard(row, 'owner')));
      setLoadError(null);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setReservations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [
        { data: ownerReservations, error: ownerReservationsError },
        { data: renterReservations, error: renterReservationsError }
      ] = await Promise.all([
        reservationService?.getOwnerReservations(user?.id),
        reservationService?.getUserReservations(user?.id)
      ]);

      if (ownerReservationsError) throw ownerReservationsError;
      if (renterReservationsError) throw renterReservationsError;

      const mergedRawById = new Map();

      (ownerReservations || [])?.forEach((reservation) => {
        if (!reservation?.id) return;
        mergedRawById.set(String(reservation.id), {
          reservation,
          viewerRole: 'owner'
        });
      });

      (renterReservations || [])?.forEach((reservation) => {
        if (!reservation?.id) return;
        if (!mergedRawById?.has(String(reservation.id))) {
          mergedRawById.set(String(reservation.id), {
            reservation,
            viewerRole: 'renter'
          });
        }
      });

      const mergedRawEntries = Array.from(mergedRawById.values());
      const reservationIds = mergedRawEntries
        ?.map((entry) => entry?.reservation?.id)
        ?.filter(Boolean);
      const renterIds = mergedRawEntries
        ?.map((entry) => entry?.reservation?.renter_id)
        ?.filter(Boolean);

      const [
        { data: sessionsData, error: sessionsError },
        approvedIdentityUserIds
      ] = await Promise.all([
        reservationIds?.length > 0
          ? inspectionService?.getSessionsByReservationIds(reservationIds)
          : Promise.resolve({ data: [], error: null }),
        loadApprovedIdentityUserIds(renterIds)
      ]);

      let startInspectionByReservationId = new Map();
      if (sessionsError) {
        console.warn('Impossible de charger les sessions inspection pour la timeline:', sessionsError?.message || sessionsError);
      } else {
        startInspectionByReservationId = (sessionsData || [])
          ?.filter((session) => String(session?.phase || '')?.toLowerCase() === 'start')
          ?.reduce((acc, session) => {
            const reservationId = String(session?.reservation_id || '');
            if (!reservationId) return acc;

            const previous = acc?.get(reservationId);
            const previousTime = previous ? new Date(previous)?.getTime() : 0;
            const currentTime = session?.closed_at ? new Date(session.closed_at)?.getTime() : 0;
            if (!previous || currentTime > previousTime) {
              acc?.set(reservationId, session?.closed_at || null);
            }
            return acc;
          }, new Map());
      }

      const mergedReservations = mergedRawEntries
        ?.map(({ reservation, viewerRole }) => {
          const reservationId = String(reservation?.id || '');
          const startInspectionClosedAt = startInspectionByReservationId?.get(reservationId) || null;
          return mapReservationToCard(
            {
              ...reservation,
              start_inspection_closed_at: startInspectionClosedAt,
              identity_approved: approvedIdentityUserIds?.has(String(reservation?.renter_id || '')?.trim())
            },
            viewerRole
          );
        })
        ?.sort((left, right) => {
        const leftTime = Number.isNaN(new Date(left?.requestDate)?.getTime())
          ? 0
          : new Date(left?.requestDate)?.getTime();
        const rightTime = Number.isNaN(new Date(right?.requestDate)?.getTime())
          ? 0
          : new Date(right?.requestDate)?.getTime();
        return rightTime - leftTime;
      });

      setReservations(mergedReservations || []);
    } catch (error) {
      console.error('Erreur lors du chargement des reservations:', error);
      setReservations([]);
      setLoadError('Impossible de charger les reservations pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    loadReservations();
  }, [authLoading, isVerificationPickupScenario, isVerificationReservationScenario, user?.id]);

  useEffect(() => {
    if (!ownerCancellationStatus) return;
    if (authLoading || !user?.id) return;

    if (ownerCancellationStatus === 'cancel') {
      toast?.error("Paiement des frais d'annulation annulé. La réservation reste maintenue: vous devez livrer l'objet loué et le locataire ne sera pas remboursé tant que les frais ne sont pas payés.");
      clearOwnerCancellationQueryParams();
      return;
    }

    if (ownerCancellationStatus !== 'success' || !ownerCancellationSessionId || !ownerCancellationReservationId) {
      return;
    }

    const syncKey = `${ownerCancellationStatus}:${ownerCancellationSessionId}`;
    if (ownerCancellationSyncRef?.current === syncKey) return;
    ownerCancellationSyncRef.current = syncKey;

    let isMounted = true;

    const syncOwnerCancellation = async () => {
      try {
        setAdjustmentSubmitting(true);

        const { data, error } = await reservationService?.syncOwnerReservationAdjustmentCheckout({
          reservationId: ownerCancellationReservationId,
          action: ownerCancellationAction || 'cancel_full',
          sessionId: ownerCancellationSessionId
        });

        if (error) throw error;

        if (!isMounted) return;

        const refundAmount = Math.max(0, Number(data?.refundAmount || 0) || 0);
        const ownerCancellationFeeAmount = Math.max(0, Number(data?.ownerCancellationFeeAmount || data?.cancellationFeeAmount || 0) || 0);

        toast?.success(
          String(data?.action || ownerCancellationAction || '') === 'cancel_full'
            ? `Réservation annulée. Locataire remboursé : ${refundAmount.toFixed(2)} EUR. Frais propriétaire payés : ${ownerCancellationFeeAmount.toFixed(2)} EUR.`
            : `Annulation partielle enregistrée. Locataire remboursé : ${refundAmount.toFixed(2)} EUR. Frais propriétaire payés : ${ownerCancellationFeeAmount.toFixed(2)} EUR.`
        );

        setAdjustmentModalReservation(null);
        await loadReservations();
      } catch (error) {
        console.error('Erreur synchronisation annulation proprietaire:', error);
        if (isMounted) {
          toast?.error(error?.message || "Impossible de finaliser l'annulation propriétaire pour le moment.");
        }
      } finally {
        if (isMounted) {
          setAdjustmentSubmitting(false);
          clearOwnerCancellationQueryParams();
        }
      }
    };

    syncOwnerCancellation();

    return () => {
      isMounted = false;
    };
  }, [
    ownerCancellationAction,
    ownerCancellationReservationId,
    ownerCancellationSessionId,
    ownerCancellationStatus,
    authLoading,
    user?.id
  ]);

  useEffect(() => {
    if (!requestedConversationId) return;
    if (loading || authLoading) return;

    const normalizedCurrentUserId = String(user?.id || '')?.trim();
    const normalizedOtherUserId = String(requestedOtherUserId || '')?.trim();

    const reservationFromQuery = (reservations || [])?.find((reservation) => {
      const reservationAnnonceId = Number(reservation?.annonceId);
      const annonceMatches = requestedAnnonceId === null || reservationAnnonceId === requestedAnnonceId;
      if (!annonceMatches) return false;

      if (!normalizedOtherUserId) return true;

      const ownerId = String(reservation?.ownerId || '')?.trim();
      const renterId = String(reservation?.renterId || '')?.trim();

      return (
        (ownerId === normalizedCurrentUserId && renterId === normalizedOtherUserId)
        || (renterId === normalizedCurrentUserId && ownerId === normalizedOtherUserId)
        || ownerId === normalizedOtherUserId
        || renterId === normalizedOtherUserId
      );
    }) || null;

    setChatModalConversationId(requestedConversationId);
    setChatModalReservation(reservationFromQuery);
    setChatModalDraftMessage('');
    clearChatQueryParams();
  }, [
    requestedConversationId,
    requestedAnnonceId,
    requestedOtherUserId,
    loading,
    authLoading,
    user?.id,
    reservations
  ]);

  const filteredReservations = reservations?.filter((reservation) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return NON_TERMINAL_RESERVATION_STATUSES?.has(reservation?.status);
    return reservation?.status === statusFilter;
  });

  const statusOptions = [
    { value: 'open', label: 'Non clôturées' },
    { value: 'upcoming', label: 'À venir' },
    { value: 'ongoing', label: 'En cours' },
    { value: 'completed', label: 'Terminées' },
    { value: 'cancelled', label: 'Annulées' },
    { value: 'all', label: 'Toutes' }
  ];

  const stats = [
    {
      label: 'À venir',
      value: reservations?.filter((reservation) => reservation?.status === 'upcoming')?.length,
      icon: 'Calendar',
      color: 'text-sky-700 bg-sky-100'
    },
    {
      label: 'En cours',
      value: reservations?.filter((reservation) => reservation?.status === 'ongoing')?.length,
      icon: 'PlayCircle',
      color: 'text-[#17a2b8] bg-[#17a2b8]/10'
    },
    {
      label: 'Terminées',
      value: reservations?.filter((reservation) => reservation?.status === 'completed')?.length,
      icon: 'CheckCircle',
      color: 'text-success bg-success/10'
    }
  ];

  const heroStats = stats?.map((stat, index) => ({
    label: stat?.label,
    value: stat?.value,
    icon: stat?.icon,
    tone: index === 0 ? 'warm' : index === 1 ? 'sky' : 'mint'
  }));

  const handleViewContract = (reservation) => {
    setSelectedReservation(reservation);
    setShowContractModal(true);
  };

  const closeContractModal = () => {
    setShowContractModal(false);
    setSelectedReservation(null);
  };

  const closeChatModal = () => {
    setChatModalConversationId(null);
    setChatModalReservation(null);
    setChatModalDraftMessage('');
    clearChatQueryParams();
  };

  const closeAdjustmentModal = () => {
    if (adjustmentSubmitting) return;
    setAdjustmentModalReservation(null);
  };

  const handleOpenInspection = (reservationId) => {
    if (!reservationId) return;
    navigate(
      appendAdminVerificationParamsToPath(
        `/photos-d-tat-des-lieux/${encodeURIComponent(reservationId)}`
      )
    );
  };

  const handleConfirmPickupStep = async (reservation, step) => {
    const reservationId = reservation?.id;
    if (!reservationId || !step) return;

    const stepLabels = {
      handover_completed: 'Matériel remis au locataire',
      rental_started: 'Début de location'
    };
    const stepLabel = stepLabels?.[step] || 'Cette étape';
    const confirmed = window.confirm(`Confirmer: ${stepLabel} ?`);
    if (!confirmed) return;

    try {
      setPickupStepInFlight({ reservationId: String(reservationId), step: String(step) });
      const { error } = await reservationService?.confirmPickupStep(reservationId, step);
      if (error) throw error;
      await loadReservations();
    } catch (error) {
      console.error('Erreur validation checklist demarrage:', error);
      const errorMessage = String(error?.message || '');
      const isIdentityVerificationRequired = /\[IDENTITY_REQUIRED\]/i.test(errorMessage)
        || /vérification d'identité/i.test(errorMessage);

      if (isIdentityVerificationRequired) {
        const params = new URLSearchParams();
        params.set('reservationId', String(reservationId));
        const shouldRedirect = window.confirm(
          `${errorMessage}\n\nOuvrir la page de vérification d'identité maintenant ?`
        );
        if (shouldRedirect) {
          navigate(`/verification-identite-location?${params.toString()}`);
        }
        return;
      }

      window.alert(errorMessage || 'Impossible de valider cette étape.');
    } finally {
      setPickupStepInFlight({ reservationId: null, step: null });
    }
  };

  const openReservationChat = async (reservation, options = {}) => {
    const currentUserId = String(user?.id || '');
    const ownerId = String(reservation?.ownerId || '');
    const renterId = String(reservation?.renterId || '');
    const annonceId = reservation?.annonceId;
    const otherParticipantId = currentUserId === ownerId ? renterId : ownerId;

    if (!currentUserId || !otherParticipantId || !annonceId) {
      window.alert("Impossible d'ouvrir le chat pour cette réservation.");
      return;
    }
    if (currentUserId === otherParticipantId) {
      window.alert('Chat indisponible sur une reservation liee au meme compte.');
      return;
    }

    try {
      setStartingChatReservationId(reservation?.id || null);

      const { data, error } = await messageService?.getOrCreateConversation(annonceId, [
        currentUserId,
        otherParticipantId
      ]);

      if (error) throw error;
      if (!data?.id) throw new Error('Conversation introuvable.');

      setChatModalConversationId(data?.id);
      setChatModalReservation(reservation);
      setChatModalDraftMessage(String(options?.draftMessage || '')?.trim());
    } catch (error) {
      console.error('Erreur ouverture chat reservation:', error);
      window.alert(error?.message || "Impossible d'ouvrir le chat pour le moment.");
    } finally {
      setStartingChatReservationId(null);
    }
  };

  const handleContactChat = async (reservation) => {
    await openReservationChat(reservation);
  };

  const handleRebookLater = (reservation) => {
    const annonceId = reservation?.annonceId;
    if (!annonceId) {
      toast?.error("Impossible d'ouvrir une nouvelle réservation pour cette annonce.");
      return;
    }

    const suggestedDates = getSuggestedRebookingWindow(reservation);
    navigate(`/demande-reservation/${encodeURIComponent(String(annonceId))}`, {
      state: {
        preselectedBookingDates: {
          startDate: suggestedDates?.startDate?.toISOString?.() || null,
          endDate: suggestedDates?.endDate?.toISOString?.() || null
        },
        rebookingFromReservationId: reservation?.id
      }
    });
  };

  const handleRequestReservationAdjustment = async (reservation) => {
    if (String(reservation?.status || '')?.toLowerCase() !== 'upcoming') {
      toast?.error("Seules les réservations à venir peuvent être annulées totalement ou partiellement.");
      return;
    }

    setAdjustmentModalReservation(reservation);
  };

  const handleSubmitReservationAdjustment = async ({
    reservation,
    action,
    reason,
    newStartDate,
    newEndDate
  }) => {
    if (!reservation?.id || !action) return;
    if (String(reservation?.status || '')?.toLowerCase() !== 'upcoming') {
      toast?.error("Seules les réservations à venir peuvent être annulées totalement ou partiellement.");
      return;
    }

    try {
      setAdjustmentSubmitting(true);

      if (reservation?.viewerRole === 'owner') {
        const successParams = new URLSearchParams();
        successParams.set('ownerCancellationStatus', 'success');
        successParams.set('ownerCancellationReservationId', String(reservation?.id));
        successParams.set('ownerCancellationAction', String(action));

        const cancelParams = new URLSearchParams();
        cancelParams.set('ownerCancellationStatus', 'cancel');
        cancelParams.set('ownerCancellationReservationId', String(reservation?.id));
        cancelParams.set('ownerCancellationAction', String(action));

        const successReturnBaseUrl = buildAppRedirectUrl(`/mes-reservations?${successParams.toString()}`);
        const cancelReturnBaseUrl = buildAppRedirectUrl(`/mes-reservations?${cancelParams.toString()}`);

        const { data, error } = await reservationService?.createOwnerReservationAdjustmentCheckout({
          reservationId: reservation?.id,
          action,
          reason,
          newStartDate,
          newEndDate,
          returnBaseUrl: successReturnBaseUrl,
          cancelReturnBaseUrl
        });

        if (error) throw error;

        if (data?.completed) {
          const refundAmount = Math.max(0, Number(data?.refundAmount || 0) || 0);
          const ownerCancellationFeeAmount = Math.max(0, Number(data?.ownerCancellationFeeAmount || data?.cancellationFeeAmount || 0) || 0);
          toast?.success(
            action === 'cancel_full'
              ? `Réservation annulée. Locataire remboursé : ${refundAmount.toFixed(2)} EUR. Frais propriétaire : ${ownerCancellationFeeAmount.toFixed(2)} EUR.`
              : `Annulation partielle enregistrée. Locataire remboursé : ${refundAmount.toFixed(2)} EUR. Frais propriétaire : ${ownerCancellationFeeAmount.toFixed(2)} EUR.`
          );
          setAdjustmentModalReservation(null);
          await loadReservations();
          return;
        }

        if (!data?.url) {
          throw new Error("Session de paiement d'annulation créée sans URL de redirection.");
        }

        setAdjustmentModalReservation(null);
        await redirectToExternalUrl(data.url);
        return;
      }

      const { data, error } = await reservationService?.adjustRenterReservation({
        reservationId: reservation?.id,
        action,
        reason,
        newStartDate,
        newEndDate
      });

      if (error) throw error;

      const refundAmount = Math.max(0, Number(data?.refundAmount || 0) || 0);
      const cancellationFeeAmount = Math.max(0, Number(data?.cancellationFeeAmount || 0) || 0);
      const adjustedRentalAmount = Math.max(0, Number(data?.adjustedRentalAmount || 0) || 0);

      if (action === 'cancel_full') {
        toast?.success(
          refundAmount > 0
            ? `Réservation annulée. Remboursement estimé : ${refundAmount.toFixed(2)} EUR.`
            : 'Réservation annulée.'
        );
      } else if (reservation?.isPaid) {
        toast?.success(
          `Annulation partielle enregistrée. Remboursement estimé : ${refundAmount.toFixed(2)} EUR. Frais d'annulation conservés : ${cancellationFeeAmount.toFixed(2)} EUR.`
        );
      } else {
        toast?.success(`Annulation partielle enregistrée. Nouveau montant location: ${adjustedRentalAmount.toFixed(2)} EUR.`);
      }

      setAdjustmentModalReservation(null);
      await loadReservations();
    } catch (error) {
      console.error('Erreur ajustement reservation:', error);
      toast?.error(error?.message || "Impossible d'ajuster cette reservation pour le moment.");
    } finally {
      setAdjustmentSubmitting(false);
    }
  };

  return (
    <ActionPageShell
      maxWidth="max-w-7xl"
      hero={(
        <ActionHero
          eyebrow="Mes réservations"
          title="Mes reservations"
          subtitle="Ouvrez la reservation qui demande une action."
          stats={heroStats}
          tone="sky"
        />
      )}
    >
      <div className="space-y-6">

        {(isVerificationReservationScenario || isVerificationPickupScenario) ? (
          <ActionCard className="border border-green-200 bg-green-50 p-4" data-testid="reservation-verification-banner">
            <div className="flex items-start gap-3">
              <Icon name="ShieldCheck" size={20} className="mt-0.5 text-success" />
              <div>
                <p className="font-medium text-foreground">Mode de vérification admin</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isVerificationPickupScenario
                    ? 'Une réservation de jour J est injectée pour valider checklist, remise et démarrage.'
                    : 'Un portefeuille de réservations est injecté pour valider filtres, timeline, contrat, chat et ajustements.'}
                </p>
              </div>
            </div>
          </ActionCard>
        ) : null}

        {loadError && (
          <ActionCard className="border border-warning/20 bg-warning/10 p-4 text-sm text-foreground">
            {loadError}
          </ActionCard>
        )}

        <ActionCard className="p-4">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filtrer par statut" />
        </ActionCard>

        <div className="space-y-4">
          {loading ? (
            <ActionCard className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-muted-foreground">Chargement des réservations...</p>
            </ActionCard>
          ) : filteredReservations?.length === 0 ? (
            <ActionEmptyState
              icon="CalendarX2"
              title="Aucune réservation à afficher"
              description="Changez le filtre ou revenez plus tard pour voir les réservations actives."
            />
          ) : (
            filteredReservations?.map((reservation) => {
              const currentUserId = String(user?.id || '');
              const isOwner = currentUserId && currentUserId === String(reservation?.ownerId || '');
              const contactCtaLabel = isOwner ? 'Contacter le locataire' : 'Contacter le propriétaire';

              return (
                <ReservationCard
                  key={reservation?.id}
                  reservation={reservation}
                  onViewContract={handleViewContract}
                  onOpenInspection={handleOpenInspection}
                  onConfirmPickupStep={handleConfirmPickupStep}
                  onContactChat={handleContactChat}
                  onRebookLater={handleRebookLater}
                  onRequestReservationAdjustment={handleRequestReservationAdjustment}
                  contactCtaLabel={contactCtaLabel}
                  pickupStepLoading={(
                    String(pickupStepInFlight?.reservationId || '') === String(reservation?.id || '')
                  ) ? String(pickupStepInFlight?.step || '') : null}
                  contactLoading={String(startingChatReservationId || '') === String(reservation?.id || '')} />
              );
            })
          )}
        </div>

        {showContractModal && selectedReservation?.contractUrl && (
          <ContractPreviewModal
            reservation={selectedReservation}
            contractUrl={selectedReservation?.contractUrl}
            onClose={closeContractModal} />
        )}

        <ChatPopupModal
          isOpen={Boolean(chatModalConversationId)}
          conversationId={chatModalConversationId}
          reservation={chatModalReservation}
          initialDraftMessage={chatModalDraftMessage}
          currentUserId={user?.id}
          onClose={closeChatModal}
          onOpenFullChat={(conversationId) => navigate(
            `/messages?conversation=${encodeURIComponent(conversationId)}`
          )} />

        <ReservationAdjustmentModal
          isOpen={Boolean(adjustmentModalReservation)}
          reservation={adjustmentModalReservation}
          loading={adjustmentSubmitting}
          onClose={closeAdjustmentModal}
          onSubmit={handleSubmitReservationAdjustment} />
      </div>
    </ActionPageShell>
  );
};

export default ReservationManagementDashboard;

