import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import { getCautionModeLabel } from '../../../utils/cautionMode';
import { formatTimeRange } from '../../../utils/timeSlots';

const ReservationCard = ({
  reservation,
  onViewContract,
  onOpenInspection,
  onConfirmPickupStep,
  onContactChat,
  onRebookLater,
  onRequestReservationAdjustment,
  contactCtaLabel = 'Contacter par chat',
  contactLoading = false,
  pickupStepLoading = null
}) => {
  const parseReservationDate = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value?.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
      return Number.isNaN(localDate?.getTime()) ? null : localDate;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed?.getTime()) ? null : parsed;
  };

  const formatDate = (dateString) => {
    const date = parseReservationDate(dateString);
    if (!date) return '-';
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    const date = parseReservationDate(dateString);
    if (!date) return '-';
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return '-';
    return `${amount.toFixed(2)} EUR`;
  };

  const toLocalDateOnly = (value) => {
    const parsed = parseReservationDate(value);
    if (!parsed) return null;
    const normalized = new Date(parsed);
    normalized?.setHours(0, 0, 0, 0);
    return Number.isNaN(normalized?.getTime()) ? null : normalized;
  };

  const isSameLocalDay = (left, right) => {
    const leftDate = toLocalDateOnly(left);
    const rightDate = toLocalDateOnly(right);
    if (!leftDate || !rightDate) return false;
    return leftDate?.getTime() === rightDate?.getTime();
  };

  const computeRentalDays = (startDateValue, endDateValue) => {
    const startDate = toLocalDateOnly(startDateValue);
    const endDate = toLocalDateOnly(endDateValue);
    if (!startDate || !endDate) return 0;
    const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  };

  const getCautionStatusConfig = (status, mode) => {
    const noneLabel = 'Aucune caution';

    const configs = {
      pending: { label: 'Préautorisée', color: 'text-muted-foreground' },
      held: { label: 'Préautorisée', color: 'text-muted-foreground' },
      authorized: { label: 'Préautorisée', color: 'text-muted-foreground' },
      none: { label: noneLabel, color: 'text-primary' },
      released: { label: 'Liberee', color: 'text-success' },
      captured: { label: 'Débitée / retenue', color: 'text-warning' }
    };
    return configs?.[status] || configs?.pending;
  };

  const getStatusConfig = (status, viewerRole = 'owner') => {
    const isRenterView = viewerRole === 'renter';
    const configs = {
      pending: {
        label: 'Réservation non finalisée',
        color: 'bg-warning/10 text-warning',
        icon: 'Clock'
      },
      accepted: {
        label: 'Réservation non finalisée',
        color: 'bg-warning/10 text-warning',
        icon: 'Clock'
      },
      upcoming: { label: 'À venir', color: 'bg-sky-100 text-sky-700', icon: 'Calendar' },
      rejected: { label: 'Annulée', color: 'bg-danger/10 text-danger', icon: 'XCircle' },
      ongoing: { label: 'En cours', color: 'bg-primary/10 text-primary', icon: 'Activity' },
      completed: { label: 'Terminée', color: 'bg-success/10 text-success', icon: 'CheckCircle' },
      cancelled: { label: 'Annulée', color: 'bg-muted/10 text-muted-foreground', icon: 'XCircle' }
    };
    return configs?.[status] || configs?.pending;
  };

  const getTimelineIcon = (type) => {
    const icons = {
      info: 'Info',
      success: 'CheckCircle',
      error: 'AlertCircle',
      warning: 'AlertTriangle',
      pending: 'Clock'
    };
    return icons?.[type] || 'Circle';
  };

  const getTimelineColor = (type) => {
    const colors = {
      info: 'text-[#17a2b8] bg-[#17a2b8]/10 border-[#17a2b8]/20',
      success: 'text-success bg-success/10 border-success/20',
      error: 'text-error bg-error/10 border-error/20',
      warning: 'text-warning bg-warning/10 border-warning/20',
      pending: 'text-warning bg-warning/10 border-warning/20'
    };
    return colors?.[type] || 'text-muted-foreground bg-muted border-border';
  };

  const getCautionCaption = (status) => {
    const normalizedStatus = String(status || '')?.toLowerCase();
    if (normalizedStatus === 'captured') {
      return "Montant débité uniquement en cas de retenue, dégât ou litige.";
    }
    if (normalizedStatus === 'released') {
      return "Empreinte bancaire libérée, sans débit de caution.";
    }
    if (normalizedStatus === 'none') {
      return 'Aucune caution demandée pour cette réservation.';
    }
    return "Empreinte bancaire du locataire enregistrée, non débitée à ce stade.";
  };

  const getOwnerPaymentSummary = (item) => {
    const paymentReceived = Boolean(item?.isPaid);
    const payoutReleased = Boolean(item?.ownerPayoutReleasedAt);
    const isCancelled = item?.status === 'cancelled';
    const adjustmentMode = String(item?.adjustmentSummary?.mode || '')?.toLowerCase();
    const adjustmentInitiatorRole = String(item?.adjustmentSummary?.initiatedByRole || '')?.toLowerCase();
    const ownerPayoutStatus = String(item?.ownerPayoutStatus || item?.adjustmentSummary?.ownerPayoutStatus || '')?.toLowerCase();
    const ownerCompensationGrossAmount = Number(item?.adjustmentSummary?.ownerCompensationGrossAmount || 0) || 0;
    const refundAmount = Number(item?.refundAmount || item?.adjustmentSummary?.refundAmount || 0) || 0;
    const cancellationFeeAmount = Number(item?.adjustmentSummary?.cancellationFeeAmount || 0) || 0;
    const paymentDateLabel = formatDateTime(item?.paidAt);
    const payoutDateLabel = formatDateTime(item?.ownerPayoutReleasedAt);

    if (isCancelled && adjustmentMode === 'auto_cancel_no_handover_after_end') {
      const payoutPendingOwnerAccount = ownerPayoutStatus === 'pending_owner_account';
      const payoutFailed = ownerPayoutStatus === 'failed';

      return {
        badgeLabel: payoutReleased
          ? '1er jour reversé au propriétaire'
          : payoutPendingOwnerAccount
            ? 'Reversement propriétaire en attente'
            : payoutFailed
              ? 'Reversement propriétaire à vérifier'
              : 'Réservation annulée et régularisée',
        badgeColor: payoutReleased
          ? 'bg-success/10 text-success'
          : payoutPendingOwnerAccount
            ? 'bg-warning/10 text-warning'
            : payoutFailed
              ? 'bg-danger/10 text-danger'
              : 'bg-primary/10 text-primary',
        badgeIcon: payoutReleased ? 'CheckCircle' : payoutPendingOwnerAccount ? 'Clock' : payoutFailed ? 'AlertTriangle' : 'Info',
        rentalCaption: `Le premier jour (${formatCurrency(ownerCompensationGrossAmount)}) reste affecté au propriétaire.`,
        fundsLabel: refundAmount > 0 ? 'Le reste est remboursé au locataire' : 'Aucun remboursement locataire à effectuer',
        fundsCaption: refundAmount > 0
          ? `${formatCurrency(refundAmount)} remboursés au locataire après ${formatCurrency(cancellationFeeAmount)} de frais conservés.`
          : 'Aucun montant supplémentaire à rembourser au locataire.',
        payoutCaption: payoutReleased
          ? `Reversement propriétaire de ${formatCurrency(item?.ownerPayoutAmount || item?.ownerNetAmount)} envoyé.`
          : payoutPendingOwnerAccount
            ? `Reversement propriétaire de ${formatCurrency(item?.ownerPayoutAmount || item?.ownerNetAmount)} en attente : coordonnées de versement du propriétaire non finalisées.`
            : payoutFailed
              ? `Reversement propriétaire de ${formatCurrency(item?.ownerPayoutAmount || item?.ownerNetAmount)} à vérifier.`
              : `Reversement propriétaire visé : ${formatCurrency(item?.ownerPayoutAmount || item?.ownerNetAmount)}.`
      };
    }

    if (isCancelled) {
      if (adjustmentInitiatorRole === 'owner') {
        return {
          badgeLabel: 'Annulation propriétaire confirmée',
          badgeColor: 'bg-danger/10 text-danger',
          badgeIcon: 'XCircle',
          rentalCaption: refundAmount > 0
            ? `${formatCurrency(refundAmount)} ont été remboursés intégralement au locataire.`
            : 'Le locataire a été remboursé intégralement sur la partie annulée.',
          fundsLabel: "Frais d'annulation payés par le propriétaire",
          fundsCaption: cancellationFeeAmount > 0
            ? `${formatCurrency(cancellationFeeAmount)} ont été réglés pour valider l'annulation.`
            : "Aucun frais d'annulation supplémentaire n'était nécessaire.",
          payoutCaption: 'Aucun versement propriétaire actif sur la partie annulée.'
        };
      }

      return {
        badgeLabel: 'Réservation annulée',
        badgeColor: 'bg-muted/10 text-muted-foreground',
        badgeIcon: 'XCircle',
        rentalCaption: paymentReceived
          ? 'Un paiement avait été enregistré avant annulation.'
          : "Aucun paiement locataire confirmé sur cette réservation.",
        fundsLabel: paymentReceived ? 'Traitement à vérifier après annulation' : 'Aucun fonds encaissés',
        fundsCaption: paymentReceived
          ? "Le traitement dépend des conditions d'annulation et du prestataire de paiement."
          : "Tant que le locataire n'a pas payé, la plateforme ne retient aucun fonds.",
        payoutCaption: 'Aucun versement propriétaire actif sur une réservation annulée.'
      };
    }

    if (!paymentReceived) {
      return {
        badgeLabel: 'Paiement locataire en attente',
        badgeColor: 'bg-warning/10 text-warning',
        badgeIcon: 'Clock',
        rentalCaption: "Le locataire doit encore finaliser son paiement pour confirmer la réservation.",
        fundsLabel: 'Aucun fonds encaissés pour le moment',
        fundsCaption: "La plateforme ne retient encore aucun montant pour cette réservation.",
        payoutCaption: "Le versement propriétaire ne pourra démarrer qu'après paiement du locataire puis fin de location."
      };
    }

    if (payoutReleased) {
      return {
        badgeLabel: 'Versement propriétaire envoyé',
        badgeColor: 'bg-success/10 text-success',
        badgeIcon: 'CheckCircle',
        rentalCaption: paymentDateLabel !== '-' ? `Paiement locataire reçu le ${paymentDateLabel}.` : 'Paiement locataire bien reçu.',
        fundsLabel: 'Les fonds ne sont plus retenus par la plateforme',
        fundsCaption: payoutDateLabel !== '-'
          ? `Le versement vers le propriétaire a été libéré le ${payoutDateLabel}.`
          : 'Le versement vers le propriétaire a été libéré.',
        payoutCaption: payoutDateLabel !== '-'
          ? `Versement propriétaire libéré le ${payoutDateLabel}.`
          : 'Versement propriétaire libéré.'
      };
    }

    return {
      badgeLabel: 'Paiement locataire reçu',
      badgeColor: 'bg-primary/10 text-primary',
      badgeIcon: 'Info',
      rentalCaption: paymentDateLabel !== '-' ? `Paiement locataire reçu le ${paymentDateLabel}.` : 'Paiement locataire bien reçu.',
      fundsLabel: 'Fonds actuellement sécurisés par la plateforme',
      fundsCaption: "Le locataire a payé. Les fonds sont conservés temporairement par la plateforme jusqu'à la fin de location et la validation du retour.",
      payoutCaption: 'Versement propriétaire prévu après la fin de location.'
    };
  };

  const getTimelineNodeIcon = (step) => {
    const state = String(step?.state || '')?.toLowerCase();
    if (state === 'upcoming' || state === 'skipped') return 'Circle';
    if (state === 'current') return 'CircleDot';
    return getTimelineIcon(step?.type);
  };

  const getTimelineNodeColor = (step) => {
    const state = String(step?.state || '')?.toLowerCase();
    if (state === 'current') return 'text-[#17a2b8] bg-[#17a2b8]/15 border-[#17a2b8]/40';
    if (state === 'upcoming') return 'text-muted-foreground bg-muted/40 border-border';
    if (state === 'skipped') return 'text-muted-foreground bg-muted/20 border-border/70';
    return getTimelineColor(step?.type);
  };

  const getTimelineCaption = (point) => {
    const state = String(point?.state || '')?.toLowerCase();
    if (point?.date) return formatDateTime(point?.date);
    if (state === 'current') return 'Étape en cours';
    if (state === 'skipped') return 'Non applicable';
    return 'En attente';
  };

  const getTimelineEventIcon = (step) => {
    const state = String(step?.state || '')?.toLowerCase();
    if (state === 'upcoming' || state === 'skipped') return 'Circle';
    if (state === 'current') return 'CircleDot';
    return getTimelineIcon(step?.type);
  };

  const getTimelineEventTextColor = (step) => {
    const state = String(step?.state || '')?.toLowerCase();
    if (state === 'upcoming' || state === 'skipped') return 'text-muted-foreground';
    return 'text-foreground';
  };

  const normalizeTimelineMomentKey = (dateValue) => {
    const parsedDate = parseReservationDate(dateValue);
    if (!parsedDate) return null;
    const roundedDate = new Date(parsedDate);
    roundedDate?.setSeconds(0, 0);
    const roundedTime = roundedDate?.getTime();
    return Number.isFinite(roundedTime) ? String(roundedTime) : null;
  };

  const getTimelinePointState = (steps = []) => {
    const states = steps?.map((step) => String(step?.state || '')?.toLowerCase());
    if (states?.includes('current')) return 'current';
    if (states?.includes('done')) return 'done';
    if (states?.length > 0 && states?.every((state) => state === 'skipped')) return 'skipped';
    if (states?.includes('upcoming')) return 'upcoming';
    return states?.[0] || 'upcoming';
  };

  const getTimelinePointType = (steps = [], pointState = 'upcoming') => {
    if (pointState === 'upcoming' || pointState === 'skipped') return 'pending';
    const typePriority = ['error', 'warning', 'success', 'info', 'pending'];
    for (const type of typePriority) {
      if (steps?.some((step) => String(step?.type || '')?.toLowerCase() === type)) {
        return type;
      }
    }
    return 'info';
  };

  const buildTimelinePoints = (steps = []) => {
    const groupedPoints = new Map();

    steps?.forEach((step, index) => {
      const momentKey = normalizeTimelineMomentKey(step?.date);
      const pointKey = momentKey ? `time:${momentKey}` : `step:${step?.id || index}`;

      if (!groupedPoints?.has(pointKey)) {
        groupedPoints?.set(pointKey, {
          id: pointKey,
          date: step?.date || null,
          firstIndex: index,
          steps: [step]
        });
        return;
      }

      const existingPoint = groupedPoints?.get(pointKey);
      existingPoint?.steps?.push(step);
      if (!existingPoint?.date && step?.date) {
        existingPoint.date = step?.date;
      }
    });

    return Array.from(groupedPoints.values())
      ?.sort((left, right) => (left?.firstIndex || 0) - (right?.firstIndex || 0))
      ?.map((point) => {
        const pointState = getTimelinePointState(point?.steps || []);
        const pointType = getTimelinePointType(point?.steps || [], pointState);
        return {
          ...point,
          state: pointState,
          type: pointType
        };
      });
  };

  const isOwnerView = reservation?.viewerRole !== 'renter';
  const cautionConfig = getCautionStatusConfig(reservation?.cautionStatus, reservation?.cautionMode);
  const cautionCaption = getCautionCaption(reservation?.cautionStatus);
  const statusConfig = getStatusConfig(reservation?.status, reservation?.viewerRole);
  const ownerPaymentSummary = isOwnerView ? getOwnerPaymentSummary(reservation) : null;
  const timelineSteps = Array?.isArray(reservation?.timeline) ? reservation?.timeline : [];
  const timelinePoints = buildTimelinePoints(timelineSteps);
  const adjustmentSummary = reservation?.adjustmentSummary && typeof reservation?.adjustmentSummary === 'object'
    ? reservation?.adjustmentSummary
    : null;
  const adjustmentMode = String(adjustmentSummary?.mode || '')?.toLowerCase();
  const adjustmentInitiatorRole = String(adjustmentSummary?.initiatedByRole || '')?.toLowerCase();
  const canRevealPickupAddress = Boolean(reservation?.canRevealPickupAddress);
  const pickupAddressLine = canRevealPickupAddress ? String(reservation?.pickupAddressLine || '')?.trim() : '';
  const pickupAddressMapsUrl = pickupAddressLine
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddressLine)}`
    : null;
  const [timelinePage, setTimelinePage] = React.useState(0);
  const [stepsPerPage, setStepsPerPage] = React.useState(5);
  const cautionModeLabel = getCautionModeLabel(reservation?.cautionMode);
  const canContactByChat = Boolean(reservation?.isPaid) || reservation?.status === 'completed';
  const normalizedRawStatus = String(reservation?.rawStatus || '')?.toLowerCase();
  const originalRentalDays = computeRentalDays(reservation?.startDate, reservation?.endDate);
  const canAdjustUpcomingReservation = reservation?.status === 'upcoming';
  const canFullyCancelFromAdjustment = canAdjustUpcomingReservation;
  const canShortenReservation = canAdjustUpcomingReservation && originalRentalDays > 1;
  const canRebookLater = !isOwnerView && Boolean(reservation?.annonceId);
  const canRequestReservationAdjustment = canAdjustUpcomingReservation
    && (canShortenReservation || canFullyCancelFromAdjustment);
  const isPickupFlowVisible = Boolean(reservation?.isPaid) && !['completed', 'cancelled']?.includes(reservation?.status);
  const isPickupDay = isSameLocalDay(reservation?.startDate, new Date());
  const checkinStepDone = Boolean(reservation?.startInspectionClosedAt || reservation?.checkinValidatedAt);
  const handoverStepDone = Boolean(reservation?.pickupHandoverConfirmedAt || reservation?.handoverAt);
  const rentalStartedStepDone = Boolean(
    reservation?.pickupRentalStartedAt || ['active', 'ongoing', 'completed']?.includes(normalizedRawStatus)
  );
  const rentalOngoingStepDone = checkinStepDone && handoverStepDone && rentalStartedStepDone;
  const canMarkHandoverStep = Boolean(reservation?.isPaid) && isPickupDay && checkinStepDone && !handoverStepDone;
  const canMarkRentalStartStep = Boolean(reservation?.isPaid) && isPickupDay && checkinStepDone && handoverStepDone && !rentalStartedStepDone;
  const isHandoverStepLoading = pickupStepLoading === 'handover_completed';
  const isRentalStartStepLoading = pickupStepLoading === 'rental_started';

  React.useEffect(() => {
    const syncStepsPerPage = () => {
      const viewportWidth = window?.innerWidth || 1280;
      if (viewportWidth < 640) {
        setStepsPerPage(2);
        return;
      }
      if (viewportWidth < 1024) {
        setStepsPerPage(3);
        return;
      }
      if (viewportWidth < 1536) {
        setStepsPerPage(4);
        return;
      }
      setStepsPerPage(5);
    };

    syncStepsPerPage();
    window?.addEventListener('resize', syncStepsPerPage);
    return () => window?.removeEventListener('resize', syncStepsPerPage);
  }, []);

  const totalTimelinePages = Math.max(1, Math.ceil((timelinePoints?.length || 0) / stepsPerPage));
  const safeTimelinePage = Math.min(timelinePage, totalTimelinePages - 1);
  const timelineStartIndex = safeTimelinePage * stepsPerPage;
  const visibleTimelinePoints = timelinePoints?.slice(timelineStartIndex, timelineStartIndex + stepsPerPage);
  const canGoToPreviousTimelinePage = safeTimelinePage > 0;
  const canGoToNextTimelinePage = safeTimelinePage < (totalTimelinePages - 1);

  React.useEffect(() => {
    if (timelinePage !== safeTimelinePage) {
      setTimelinePage(safeTimelinePage);
    }
  }, [timelinePage, safeTimelinePage]);

  React.useEffect(() => {
    setTimelinePage(0);
  }, [reservation?.id]);

  const changeTimelinePage = (direction = 'next') => {
    setTimelinePage((currentPage) => {
      if (direction === 'prev') return Math.max(0, currentPage - 1);
      return Math.min(totalTimelinePages - 1, currentPage + 1);
    });
  };

  return (
    <div className="bg-white rounded-lg border border-border p-6 hover:shadow-elevation-2 transition-shadow">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-foreground mb-1">{reservation?.equipmentTitle}</h3>
            <p className="text-sm text-muted-foreground">Référence: {reservation?.id}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig?.color} whitespace-nowrap`}>
            <Icon name={statusConfig?.icon} size={14} />
            {statusConfig?.label}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-8 xl:items-start">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="w-full max-w-[13rem] mx-auto md:mx-0 md:w-44 md:flex-shrink-0">
              <Image
                src={reservation?.equipmentImage}
                alt={reservation?.equipmentImageAlt}
                className="w-full aspect-square object-cover rounded-lg"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <img
                      src={reservation?.participantAvatar}
                      alt={`Avatar de ${reservation?.participantPseudo}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{reservation?.participantLabel || 'Participant'}</p>
                    <p className="font-medium text-foreground">{reservation?.participantPseudo || 'Participant'}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {isOwnerView ? 'Montant de la location' : 'Montant total'}
                </p>
                <p className="font-semibold text-foreground text-lg">{formatCurrency(reservation?.totalAmount)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Période de location</p>
              <p className="font-medium text-foreground">
                {formatDate(reservation?.startDate)} - {formatDate(reservation?.endDate)}
              </p>
              {formatTimeRange(reservation?.pickupTimeStart, reservation?.pickupTimeEnd) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Prise: {formatTimeRange(reservation?.pickupTimeStart, reservation?.pickupTimeEnd)}
                </p>
              )}
              {formatTimeRange(reservation?.returnTimeStart, reservation?.returnTimeEnd) && (
                <p className="text-xs text-muted-foreground">
                  Restitution: {formatTimeRange(reservation?.returnTimeStart, reservation?.returnTimeEnd)}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Caution</p>
              <p className="font-medium text-foreground">
                {formatCurrency(reservation?.cautionAmount)}
                <span className={`ml-2 text-xs ${cautionConfig?.color}`}>({cautionConfig?.label} - {cautionModeLabel})</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{cautionCaption}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
            {canRequestReservationAdjustment && (
              <Button
                variant="default"
                size="sm"
                iconName="CalendarRange"
                onClick={() => onRequestReservationAdjustment?.(reservation)}
                disabled={contactLoading}
                className="bg-[#17a2b8] hover:bg-[#138496] text-white"
              >
                Annuler totalement ou partiellement
              </Button>
            )}

            {canRebookLater && (
              <Button
                variant="outline"
                size="sm"
                iconName="CalendarPlus"
                onClick={() => onRebookLater?.(reservation)}
              >
                Réserver plus tard
              </Button>
            )}

            {canContactByChat && (
              <Button
                variant="outline"
                iconName="MessageCircle"
                onClick={() => onContactChat?.(reservation)}
                loading={contactLoading}
                disabled={contactLoading}
              >
                {contactCtaLabel}
              </Button>
            )}

            {reservation?.contractUrl && (
              <Button
                variant="outline"
                size="sm"
                iconName="FileText"
                onClick={() => onViewContract?.(reservation)}
              >
                Voir le contrat
              </Button>
            )}
          </div>

          {adjustmentMode === 'shorten_period' && (
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8a5a00]">
                {adjustmentInitiatorRole === 'owner' ? 'Dernier ajustement propriétaire' : 'Dernier ajustement locataire'}
              </p>
              <p className="mt-1 text-sm text-foreground">
                Période conservée du {formatDate(adjustmentSummary?.adjustedStartDate)} au {formatDate(adjustmentSummary?.adjustedEndDate)}.
                {' '} {Number(adjustmentSummary?.removedDays || 0)} jour{Number(adjustmentSummary?.removedDays || 0) > 1 ? 's' : ''} retiré{Number(adjustmentSummary?.removedDays || 0) > 1 ? 's' : ''}.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Montant de location conservé</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(adjustmentSummary?.adjustedRentalAmount)}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {adjustmentInitiatorRole === 'owner'
                      ? 'Remboursement locataire'
                      : (reservation?.isPaid ? 'Remboursement locataire' : 'Paiement mis à jour')}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {(adjustmentInitiatorRole === 'owner' || reservation?.isPaid)
                      ? formatCurrency(adjustmentSummary?.refundAmount)
                      : formatCurrency(adjustmentSummary?.adjustedRentalAmount)}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {adjustmentInitiatorRole === 'owner' ? "Frais d'annulation propriétaire" : "Frais d'annulation conservés"}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(adjustmentSummary?.cancellationFeeAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {adjustmentMode === 'auto_cancel_no_handover_after_end' && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                Annulation automatique après non-démarrage
              </p>
              <p className="mt-1 text-sm text-foreground">
                La remise n'a jamais commencé et la date de fin est dépassée. La réservation est annulée, le premier jour reste affecté au propriétaire et le solde est remboursé au locataire.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Part conservée</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(adjustmentSummary?.ownerCompensationGrossAmount)}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Versement propriétaire</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(reservation?.ownerPayoutAmount || adjustmentSummary?.ownerPayoutAmount)}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Remboursement locataire</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(reservation?.refundAmount || adjustmentSummary?.refundAmount)}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Frais conservés</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(adjustmentSummary?.cancellationFeeAmount)}
                  </p>
                </div>
              </div>

              {reservation?.ownerPayoutStatus === 'pending_owner_account' && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Les coordonnées de versement du propriétaire ne sont pas encore finalisées. Le versement reste en attente jusqu'à régularisation.
                </p>
              )}
            </div>
          )}

          {isOwnerView && ownerPaymentSummary && (
            <div className="rounded-lg border border-[#17a2b8]/30 bg-[#17a2b8]/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0f6070]">
                    Situation du paiement
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Le paiement du locataire, la retenue temporaire des fonds et votre versement sont distingués ici.
                  </p>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${ownerPaymentSummary?.badgeColor}`}>
                  <Icon name={ownerPaymentSummary?.badgeIcon} size={14} />
                  {ownerPaymentSummary?.badgeLabel}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Paiement locataire</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(reservation?.totalAmount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ownerPaymentSummary?.rentalCaption}</p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Ou est l'argent ?</p>
                  <p className="text-sm font-semibold text-foreground">{ownerPaymentSummary?.fundsLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ownerPaymentSummary?.fundsCaption}</p>
                </div>

                <div className="rounded-lg border border-border bg-white px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Versement propriétaire estimé</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(reservation?.ownerNetAmount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ownerPaymentSummary?.payoutCaption}</p>
                </div>
              </div>
            </div>
          )}

          {pickupAddressLine && (
            <div className="rounded-lg border-2 border-[#17a2b8]/40 bg-[#17a2b8]/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0f6070]">
                    Adresse de remise du matériel
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground break-words">
                    {pickupAddressLine}
                  </p>
                </div>
                <Icon name="MapPin" size={20} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
              </div>
              {pickupAddressMapsUrl && (
                <div className="mt-3">
                  <a
                    href={pickupAddressMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#0f6070] hover:text-[#0b4b57]"
                  >
                    <Icon name="Navigation" size={14} />
                    Ouvrir dans Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {timelineSteps?.length > 0 && (
            <div className="bg-surface rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-sm font-semibold text-foreground">Historique de la réservation</h4>
                {totalTimelinePages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      Étapes {timelineStartIndex + 1}-{timelineStartIndex + visibleTimelinePoints?.length} / {timelinePoints?.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeTimelinePage('prev')}
                      disabled={!canGoToPreviousTimelinePage}
                      className="w-8 h-8 rounded-full border border-border bg-white text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-surface transition-colors"
                      aria-label="Afficher les étapes précédentes"
                    >
                      <Icon name="ChevronLeft" size={16} />
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums min-w-[38px] text-center">
                      {safeTimelinePage + 1}/{totalTimelinePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeTimelinePage('next')}
                      disabled={!canGoToNextTimelinePage}
                      className="w-8 h-8 rounded-full border border-border bg-white text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center hover:bg-surface transition-colors"
                      aria-label="Afficher les étapes suivantes"
                    >
                      <Icon name="ChevronRight" size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="relative px-1 overflow-hidden">
                <div className="absolute left-6 right-6 top-5 h-0.5 bg-border" />

                <div
                  className="relative grid items-start gap-4"
                  style={{ gridTemplateColumns: `repeat(${visibleTimelinePoints?.length || 1}, minmax(0, 1fr))` }}
                >
                  {visibleTimelinePoints?.map((point, pageIndex) => {
                    const absoluteIndex = timelineStartIndex + pageIndex;
                    return (
                      <div key={`${reservation?.id}-timeline-point-${point?.id || absoluteIndex}`} className="w-full min-w-0">
                        <div className="relative w-fit mx-auto">
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${getTimelineNodeColor(point)} relative z-10`}>
                            <Icon name={getTimelineNodeIcon(point)} size={18} />
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          {(point?.steps || [])?.map((step, stackedIndex) => (
                            <div key={`${reservation?.id}-timeline-event-${point?.id || absoluteIndex}-${step?.id || stackedIndex}`} className="flex items-start gap-1.5">
                              <Icon
                                name={getTimelineEventIcon(step)}
                                size={14}
                                className={getTimelineEventTextColor(step)}
                              />
                              <p className={`text-sm font-medium leading-snug ${getTimelineEventTextColor(step)}`}>
                                {step?.event}
                              </p>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground pt-1">{getTimelineCaption(point)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {totalTimelinePages > 1 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Événements empilés par timestamp identique. Total : {timelineSteps?.length} événements, {timelinePoints?.length} points.
                </div>
              )}
            </div>
          )}

          {isPickupFlowVisible && (
            <div className="rounded-lg border border-[#17a2b8]/30 bg-[#17a2b8]/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Démarrage location (jour J)</p>
                  <p className="text-xs text-muted-foreground">
                    Validation possible uniquement le {formatDate(reservation?.startDate)}.
                  </p>
                </div>
                {!isPickupDay && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900">
                    <Icon name="Calendar" size={12} />
                    Hors jour J
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded border border-border bg-white px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={checkinStepDone ? 'CheckCircle' : 'Circle'} size={16} className={checkinStepDone ? 'text-success' : 'text-muted-foreground'} />
                  <span className="text-sm text-foreground">État des lieux de remise validé (module officiel)</span>
                </div>
                {!checkinStepDone && (
                  <Button
                    size="sm"
                    variant="outline"
                    iconName="Camera"
                    onClick={() => onOpenInspection?.(reservation?.id)}
                  >
                    Ouvrir état des lieux
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded border border-border bg-white px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={handoverStepDone ? 'CheckCircle' : 'Circle'} size={16} className={handoverStepDone ? 'text-success' : 'text-muted-foreground'} />
                  <span className="text-sm text-foreground">{reservation?.viewerRole === 'renter' ? 'Matériel récupéré par le locataire' : 'Matériel remis au locataire'}</span>
                </div>
                {!handoverStepDone && (
                  <Button
                    size="sm"
                    variant="outline"
                    iconName={isHandoverStepLoading ? 'Loader2' : 'Check'}
                    disabled={!canMarkHandoverStep || isHandoverStepLoading}
                    onClick={() => onConfirmPickupStep?.(reservation, 'handover_completed')}
                  >
                    {isHandoverStepLoading ? 'Validation...' : 'Valider'}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded border border-border bg-white px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={rentalStartedStepDone ? 'CheckCircle' : 'Circle'} size={16} className={rentalStartedStepDone ? 'text-success' : 'text-muted-foreground'} />
                  <span className="text-sm text-foreground">Début de location</span>
                </div>
                {!rentalStartedStepDone && (
                  <Button
                    size="sm"
                    variant="outline"
                    iconName={isRentalStartStepLoading ? 'Loader2' : 'Check'}
                    disabled={!canMarkRentalStartStep || isRentalStartStepLoading}
                    onClick={() => onConfirmPickupStep?.(reservation, 'rental_started')}
                  >
                    {isRentalStartStepLoading ? 'Validation...' : 'Valider'}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded border border-border bg-white px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={rentalOngoingStepDone ? 'CheckCircle' : 'Circle'} size={16} className={rentalOngoingStepDone ? 'text-success' : 'text-muted-foreground'} />
                  <span className="text-sm text-foreground">Location en cours (auto)</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {rentalOngoingStepDone ? 'Auto-validée' : 'En attente des 3 préalables'}
                </span>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default ReservationCard;


