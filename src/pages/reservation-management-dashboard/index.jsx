import React, { useEffect, useState } from 'react';
import Header from '../../components/navigation/Header';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Select from '../../components/ui/Select';
import ReservationCard from './components/ReservationCard';
import ContractPreviewModal from './components/ContractPreviewModal';
import ChatPopupModal from './components/ChatPopupModal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import reservationService from '../../services/reservationService';
import storageService from '../../services/storageService';
import messageService from '../../services/messageService';
import inspectionService from '../../services/inspectionService';
import { normalizeTimeValue } from '../../utils/timeSlots';

const FALLBACK_IMAGE = '/assets/images/no_image.png';
const PAID_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing', 'completed']);

const normalizeStatus = (status) => {
  const normalizedStatus = String(status || '')?.toLowerCase();
  if (!normalizedStatus) return 'pending';
  if (['pending', 'accepted']?.includes(normalizedStatus)) return 'pending';
  if (['paid', 'active', 'ongoing']?.includes(normalizedStatus)) return 'ongoing';
  if (normalizedStatus === 'completed') return 'completed';
  if (
    ['refused', 'rejected', 'cancelled']?.includes(normalizedStatus)
    || normalizedStatus?.startsWith('cancelled')
  ) {
    return 'cancelled';
  }
  return 'pending';
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

const isReservationPaid = (reservation) => {
  const status = String(reservation?.status || '')?.toLowerCase();
  const paidAt = toDateOrNull(reservation?.paid_at || reservation?.tenant_payment_paid_at);
  return Boolean(paidAt) || PAID_RESERVATION_STATUSES?.has(status);
};

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

  const isCancelled = ['cancelled', 'rejected', 'refused']?.includes(status) || status?.startsWith('cancelled');
  const isCompleted = status === 'completed';
  const isPaid = Boolean(paidAt) || ['paid', 'active', 'ongoing', 'completed']?.includes(status);
  const isRentalEnded = Boolean(plannedEndAt || endAt) && (isDateReached(plannedEndAt || endAt, now) || isCompleted);

  const isRenterView = viewerRole === 'renter';
  const handoverLabel = isRenterView ? 'Matériel récupéré par le locataire' : 'Matériel remis au locataire';
  const returnLabel = isRenterView ? 'Matériel retourne au propriétaire' : 'Matériel récupéré au retour';
  const checkinLabel = isRenterView ? 'État des lieux entrée validé' : 'État des lieux de remise validé';
  const checkoutLabel = isRenterView ? 'État des lieux sortie validé' : 'État des lieux de retour validé';
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
      event: 'Paiement location confirmé',
      type: 'success',
      date: paidAt || updatedAt || createdAt,
      done: true
    });
  } else if (!isCancelled) {
    pushTimelineStep({
      id: 'payment_due',
      event: 'Paiement location à finaliser',
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
      event: 'Paiement propriétaire libéré',
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
  const reservationAddressLine = [
    reservationAddress,
    [reservationPostalCode, reservationCity]?.filter(Boolean)?.join(' ')
  ]?.filter(Boolean)?.join(', ');

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
    status: normalizeStatus(reservation?.status),
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    cautionAmount: Number.isFinite(cautionAmount) ? cautionAmount : 0,
    cautionStatus: reservation?.deposit_status || reservation?.caution_status || 'pending',
    cautionMode: reservation?.caution_mode || reservation?.mode_caution || 'cb',
    startInspectionClosedAt: reservation?.start_inspection_closed_at || reservation?.startInspectionClosedAt || null,
    pickupHandoverConfirmedAt: reservation?.pickup_handover_confirmed_at || reservation?.pickupHandoverConfirmedAt || null,
    pickupRentalStartedAt: reservation?.pickup_rental_started_at || reservation?.pickupRentalStartedAt || null,
    checkinValidatedAt: reservation?.checkin_validated_at || reservation?.inspection_checkin_validated_at || reservation?.inspection_entry_validated_at || null,
    handoverAt: reservation?.pickup_handover_confirmed_at || reservation?.handover_completed_at || reservation?.handover_at || null,
    requestDate: reservation?.created_at || reservation?.updated_at || reservation?.start_date,
    timeline: buildTimeline(reservation, viewerRole),
    contractUrl: reservation?.contract_url || null,
    rawStatus: reservation?.status,
    viewerRole
  };
};

const ReservationManagementDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [startingChatReservationId, setStartingChatReservationId] = useState(null);
  const [chatModalConversationId, setChatModalConversationId] = useState(null);
  const [chatModalReservation, setChatModalReservation] = useState(null);
  const [pickupStepInFlight, setPickupStepInFlight] = useState({ reservationId: null, step: null });
  const requestedConversationId = String(searchParams?.get('conversation') || '')?.trim();
  const requestedAnnonceIdRaw = String(searchParams?.get('annonce') || '')?.trim();
  const requestedAnnonceId = requestedAnnonceIdRaw !== '' && Number.isFinite(Number(requestedAnnonceIdRaw))
    ? Number(requestedAnnonceIdRaw)
    : null;
  const requestedOtherUserId = String(searchParams?.get('other') || '')?.trim();

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

  const loadReservations = async () => {
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
  }, [user?.id, authLoading]);

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

  const filteredReservations = statusFilter === 'all'
    ? reservations
    : reservations?.filter((reservation) => reservation?.status === statusFilter);

  const statusOptions = [
    { value: 'all', label: 'Toutes' },
    { value: 'pending', label: 'A payer' },
    { value: 'ongoing', label: 'En cours' },
    { value: 'completed', label: 'Terminées' },
    { value: 'cancelled', label: 'Annulées' }
  ];

  const stats = [
    {
      label: 'A payer',
      value: reservations?.filter((reservation) => reservation?.status === 'pending')?.length,
      icon: 'Clock',
      color: 'text-warning bg-warning/10'
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
    clearChatQueryParams();
  };

  const handleOpenInspection = (reservationId) => {
    if (!reservationId) return;
    navigate(`/photos-d-tat-des-lieux/${encodeURIComponent(reservationId)}`);
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

  const handleContactChat = async (reservation) => {
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
    } catch (error) {
      console.error('Erreur ouverture chat reservation:', error);
      window.alert(error?.message || "Impossible d'ouvrir le chat pour le moment.");
    } finally {
      setStartingChatReservationId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <a href="/tableau-bord-utilisateur" className="hover:text-[#17a2b8] transition-colors">Tableau de bord</a>
          <Icon name="ChevronRight" size={14} />
          <span className="text-foreground">Mes réservations</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gestion des réservations</h1>
          <p className="text-muted-foreground">Gérez vos réservations et suivez leur statut en temps réel</p>
        </div>

        {loadError && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6 text-sm text-foreground">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {stats?.map((stat) => (
            <div key={stat?.label} className="bg-white rounded-lg shadow-elevation-1 p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">{stat?.label}</p>
                  <p className="text-3xl font-bold text-foreground">{stat?.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat?.color}`}>
                  <Icon name={stat?.icon} size={24} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filtrer par statut" />
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-muted-foreground">Chargement des réservations...</p>
            </div>
          ) : filteredReservations?.length === 0 ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
              <Icon name="Calendar" size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucune réservation trouvée</p>
            </div>
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
          currentUserId={user?.id}
          onClose={closeChatModal}
          onOpenFullChat={(conversationId) => navigate(
            `/tableau-bord-utilisateur?tab=messages&conversation=${encodeURIComponent(conversationId)}`
          )} />
      </main>
      <Footer />
    </div>
  );
};

export default ReservationManagementDashboard;

