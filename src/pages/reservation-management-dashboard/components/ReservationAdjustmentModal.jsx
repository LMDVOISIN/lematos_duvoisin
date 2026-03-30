import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import {
  applyMinimumChargeAmount,
  PAYMENT_FEE_FIXED,
  PAYMENT_FEE_RATE,
  PLATFORM_COMMISSION_RATE
} from '../../../utils/pricingPolicy';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const clonedDate = new Date(value);
    clonedDate?.setHours(0, 0, 0, 0);
    return Number.isNaN(clonedDate?.getTime()) ? null : clonedDate;
  }

  const rawValue = String(value || '')?.trim();
  if (!rawValue) return null;

  const dateOnlyMatch = rawValue.match(DATE_ONLY_REGEX);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    localDate?.setHours(0, 0, 0, 0);
    return Number.isNaN(localDate?.getTime()) ? null : localDate;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate?.getTime())) return null;
  parsedDate?.setHours(0, 0, 0, 0);
  return parsedDate;
};

const formatInputDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  return `${date?.getFullYear()}-${String(date?.getMonth() + 1)?.padStart(2, '0')}-${String(date?.getDate())?.padStart(2, '0')}`;
};

const formatDisplayDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '-';
  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '-';
  return `${amount.toFixed(2)} EUR`;
};

const roundMoney = (value) => Math.round((Number(value || 0) || 0) * 100) / 100;

const computeCancellationFeeCore = (cancelledRentalAmount, originalRentalAmount) => {
  const normalizedCancelledRentalAmount = roundMoney(Math.max(0, Number(cancelledRentalAmount || 0) || 0));
  const normalizedOriginalRentalAmount = roundMoney(Math.max(0, Number(originalRentalAmount || 0) || 0));
  if (normalizedCancelledRentalAmount <= 0 || normalizedOriginalRentalAmount <= 0) return 0;

  const cancellationRatio = Math.min(1, Math.max(0, normalizedCancelledRentalAmount / normalizedOriginalRentalAmount));
  const platformFeeAmount = normalizedCancelledRentalAmount * PLATFORM_COMMISSION_RATE;
  const paymentFeeAmount = (normalizedCancelledRentalAmount * PAYMENT_FEE_RATE) + (PAYMENT_FEE_FIXED * cancellationRatio);

  return roundMoney(Math.max(0, platformFeeAmount + paymentFeeAmount));
};

const computeRenterCancellationFeeAmount = (cancelledRentalAmount, originalRentalAmount) => {
  const normalizedCancelledRentalAmount = roundMoney(Math.max(0, Number(cancelledRentalAmount || 0) || 0));
  if (normalizedCancelledRentalAmount <= 0) return 0;

  return roundMoney(
    Math.min(
      normalizedCancelledRentalAmount,
      applyMinimumChargeAmount(computeCancellationFeeCore(normalizedCancelledRentalAmount, originalRentalAmount))
    )
  );
};

const computeOwnerCancellationFeeAmount = (cancelledRentalAmount, originalRentalAmount) => {
  const rawCancellationFeeAmount = computeCancellationFeeCore(cancelledRentalAmount, originalRentalAmount);
  return roundMoney(applyMinimumChargeAmount(rawCancellationFeeAmount));
};

const computeRentalDays = (startDateValue, endDateValue) => {
  const startDate = parseDateOnly(startDateValue);
  const endDate = parseDateOnly(endDateValue);
  if (!startDate || !endDate) return 0;
  const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
};

const computePartialAdjustmentPreview = ({
  reservation,
  selectedStartDate,
  selectedEndDate
}) => {
  const originalStartDate = parseDateOnly(reservation?.startDate);
  const originalEndDate = parseDateOnly(reservation?.endDate);
  const originalRentalAmount = roundMoney(reservation?.totalAmount || 0);
  const originalRentalDays = computeRentalDays(originalStartDate, originalEndDate);
  const adjustedRentalDays = computeRentalDays(selectedStartDate, selectedEndDate);

  if (!originalStartDate || !originalEndDate || originalRentalDays <= 0 || adjustedRentalDays <= 0) {
    return null;
  }

  const adjustedRentalAmount = roundMoney((originalRentalAmount / originalRentalDays) * adjustedRentalDays);
  const cancelledRentalAmount = roundMoney(Math.max(0, originalRentalAmount - adjustedRentalAmount));
  const removedDays = Math.max(0, originalRentalDays - adjustedRentalDays);

  if (!reservation?.isPaid) {
    return {
      originalRentalDays,
      adjustedRentalDays,
      removedDays,
      originalRentalAmount,
      adjustedRentalAmount,
      cancelledRentalAmount,
      cancellationFeeAmount: 0,
      refundAmount: 0
    };
  }

  const cancellationFeeAmount = computeRenterCancellationFeeAmount(cancelledRentalAmount, originalRentalAmount);
  const refundAmount = roundMoney(Math.max(0, cancelledRentalAmount - cancellationFeeAmount));

  return {
    originalRentalDays,
    adjustedRentalDays,
    removedDays,
    originalRentalAmount,
    adjustedRentalAmount,
    cancelledRentalAmount,
    cancellationFeeAmount,
    refundAmount
  };
};

const ReservationAdjustmentModal = ({
  isOpen = false,
  reservation = null,
  loading = false,
  onClose = null,
  onSubmit = null
}) => {
  const originalStartDate = useMemo(() => parseDateOnly(reservation?.startDate), [reservation?.startDate]);
  const originalEndDate = useMemo(() => parseDateOnly(reservation?.endDate), [reservation?.endDate]);
  const isOwnerView = reservation?.viewerRole === 'owner';
  const normalizedReservationStatus = String(reservation?.status || '')?.toLowerCase();
  const isUpcomingReservation = normalizedReservationStatus === 'upcoming';
  const originalRentalDays = computeRentalDays(originalStartDate, originalEndDate);
  const canShortenReservation = isUpcomingReservation && originalRentalDays > 1;
  const canFullyCancel = isUpcomingReservation;
  const ownerPaymentRequiredWarning = "Tant que les frais d'annulation ne sont pas payés, la réservation reste maintenue: vous devez livrer l'objet loué et le locataire ne sera pas remboursé.";

  const [mode, setMode] = useState(canShortenReservation ? 'partial' : 'full');
  const [reason, setReason] = useState('');
  const [newStartDate, setNewStartDate] = useState(formatInputDate(originalStartDate));
  const [newEndDate, setNewEndDate] = useState(formatInputDate(originalEndDate));
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setMode(canShortenReservation ? 'partial' : 'full');
    setReason('');
    setNewStartDate(formatInputDate(originalStartDate));
    setNewEndDate(formatInputDate(originalEndDate));
    setErrorMessage('');
  }, [isOpen, reservation?.id, canShortenReservation, originalStartDate, originalEndDate]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event?.key === 'Escape' && !loading) {
        onClose?.();
      }
    };

    window?.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window?.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, loading, onClose]);

  const startDateInputMin = formatInputDate(originalStartDate);
  const startDateInputMax = formatInputDate(originalEndDate);
  const minimumEndDate = parseDateOnly(newStartDate) || originalStartDate;
  const endDateInputMin = formatInputDate(minimumEndDate);
  const endDateInputMax = formatInputDate(originalEndDate);

  const partialPreview = useMemo(() => computePartialAdjustmentPreview({
    reservation,
    selectedStartDate: newStartDate,
    selectedEndDate: newEndDate
  }), [newEndDate, newStartDate, reservation]);

  const ownerPartialPreview = useMemo(() => {
    if (!partialPreview) return null;
    if (!reservation?.isPaid) {
      return {
        ownerCancellationFeeAmount: 0,
        renterRefundAmount: 0
      };
    }

    return {
      ownerCancellationFeeAmount: computeOwnerCancellationFeeAmount(
        partialPreview?.cancelledRentalAmount,
        partialPreview?.originalRentalAmount
      ),
      renterRefundAmount: partialPreview?.cancelledRentalAmount
    };
  }, [partialPreview, reservation?.isPaid]);

  const fullCancellationPreview = useMemo(() => {
    if (!reservation?.isPaid) {
      return {
        cancellationFeeAmount: 0,
        refundAmount: 0
      };
    }

    const cancellationFeeAmount = isOwnerView
      ? computeOwnerCancellationFeeAmount(reservation?.totalAmount || 0, reservation?.totalAmount || 0)
      : computeRenterCancellationFeeAmount(reservation?.totalAmount || 0, reservation?.totalAmount || 0);

    return {
      cancellationFeeAmount,
      refundAmount: isOwnerView
        ? roundMoney(Math.max(0, Number(reservation?.totalAmount || 0) || 0))
        : roundMoney(Math.max(0, (Number(reservation?.totalAmount || 0) || 0) - cancellationFeeAmount))
    };
  }, [isOwnerView, reservation]);

  const validateSubmission = () => {
    if (!reservation?.id) {
      return 'Réservation introuvable.';
    }

    if (!isUpcomingReservation) {
      return "Seules les réservations à venir peuvent être annulées totalement ou partiellement.";
    }

    if (mode === 'full') {
      if (!canFullyCancel) {
        return "L'annulation totale n'est disponible que pour une réservation à venir.";
      }
      return '';
    }

    if (!canShortenReservation) {
      return "Cette réservation à venir ne peut pas être réduite partiellement.";
    }

    const parsedStartDate = parseDateOnly(newStartDate);
    const parsedEndDate = parseDateOnly(newEndDate);
    if (!parsedStartDate || !parsedEndDate) {
      return 'Choisissez une nouvelle période valide.';
    }

    if (!originalStartDate || !originalEndDate) {
      return 'Période initiale introuvable.';
    }

    if (parsedStartDate < originalStartDate || parsedStartDate > originalEndDate) {
      return 'La nouvelle date de début doit rester dans la réservation initiale.';
    }

    if (parsedEndDate < parsedStartDate || parsedEndDate > originalEndDate) {
      return 'La nouvelle date de fin doit rester comprise dans la réservation initiale.';
    }

    if (
      parsedStartDate?.getTime() === originalStartDate?.getTime()
      && parsedEndDate?.getTime() === originalEndDate?.getTime()
    ) {
      return 'Choisissez une période plus courte ou annulez totalement la réservation.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    const nextErrorMessage = validateSubmission();
    setErrorMessage(nextErrorMessage);
    if (nextErrorMessage) return;

    await onSubmit?.({
      reservation,
      action: mode === 'full' ? 'cancel_full' : 'shorten_period',
      reason: String(reason || '')?.trim(),
      newStartDate: mode === 'partial' ? newStartDate : null,
      newEndDate: mode === 'partial' ? newEndDate : null,
      preview: partialPreview
    });
  };

  if (!isOpen || !reservation || typeof document === 'undefined') return null;

  const modal = (
    <div
      className="fixed inset-0 z-[2300] overflow-y-auto bg-black/60"
      onClick={(event) => {
        if (event?.target === event?.currentTarget && !loading) {
          onClose?.();
        }
      }}
    >
      <div className="min-h-full w-full flex items-start justify-center px-4 py-6">
        <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] rounded-2xl border border-border bg-white shadow-elevation-4 overflow-hidden flex flex-col">
        <div className="sticky top-0 z-10 shrink-0 border-b border-border px-5 py-4 flex items-start justify-between gap-3 bg-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0f6070]">Annulation de la réservation</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {reservation?.equipmentTitle || 'Réservation'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Réservation à venir du {formatDisplayDate(originalStartDate)} au {formatDisplayDate(originalEndDate)}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => !loading && onClose?.()}
            className="h-9 w-9 rounded-md hover:bg-surface transition-colors inline-flex items-center justify-center"
            aria-label="Fermer la fenêtre d'ajustement"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="rounded-xl border border-[#17a2b8]/25 bg-[#17a2b8]/5 p-4">
            <p className="text-sm font-medium text-foreground">
              {isOwnerView
                ? `Seules les réservations à venir peuvent être annulées. Le locataire sera remboursé intégralement sur la partie annulée et vous réglerez les frais d'annulation nécessaires pour confirmer l'opération. ${ownerPaymentRequiredWarning}`
                : (
                  reservation?.isPaid
                    ? "Seules les réservations à venir peuvent être annulées. Si vous retirez des jours, seuls les jours conservés restent dus et les jours supprimés deviennent une annulation partielle."
                    : "Seules les réservations à venir peuvent être annulées. La période conservée sera mise à jour avant paiement."
                )}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => canShortenReservation && setMode('partial')}
              disabled={!canShortenReservation || loading}
              className={`rounded-xl border p-4 text-left transition-colors ${
                mode === 'partial'
                  ? 'border-[#17a2b8] bg-[#17a2b8]/5'
                  : 'border-border bg-white'
              } ${(!canShortenReservation || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#17a2b8]/60'}`}
            >
              <div className="flex items-center gap-2">
                <Icon name="CalendarRange" size={18} className="text-[#17a2b8]" />
                <p className="font-semibold text-foreground">Conserver une partie seulement</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {isOwnerView
                  ? "Garder une sous-période, rembourser intégralement les jours retirés au locataire et payer les frais correspondants."
                  : 'Garder une sous-période et annuler les jours retirés.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => canFullyCancel && setMode('full')}
              disabled={!canFullyCancel || loading}
              className={`rounded-xl border p-4 text-left transition-colors ${
                mode === 'full'
                  ? 'border-error bg-error/5'
                  : 'border-border bg-white'
              } ${(!canFullyCancel || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:border-error/60'}`}
            >
              <div className="flex items-center gap-2">
                <Icon name="XCircle" size={18} className="text-error" />
                <p className="font-semibold text-foreground">Annuler toute la réservation</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {isOwnerView
                  ? "Le locataire sera remboursé intégralement et vous réglerez les frais d'annulation nécessaires."
                  : 'Disponible uniquement tant que la réservation reste à venir.'}
              </p>
            </button>
          </div>

          {mode === 'partial' && (
            <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  type="date"
                  label="Nouvelle date de début"
                  value={newStartDate}
                  onChange={(event) => setNewStartDate(event?.target?.value || '')}
                  min={startDateInputMin}
                  max={startDateInputMax}
                  disabled={loading}
                  description="Le nouveau début doit rester dans la réservation actuelle."
                />

                <Input
                  type="date"
                  label="Nouvelle date de fin"
                  value={newEndDate}
                  onChange={(event) => setNewEndDate(event?.target?.value || '')}
                  min={endDateInputMin}
                  max={endDateInputMax}
                  disabled={loading}
                  description="La nouvelle fin doit être plus tôt que la fin actuelle."
                />
              </div>

              {partialPreview && (
                <div className={`grid gap-3 ${isOwnerView ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                  <div className="rounded-lg border border-border bg-white px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">Période conservée</p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatDisplayDate(newStartDate)} - {formatDisplayDate(newEndDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {partialPreview?.adjustedRentalDays} jour{partialPreview?.adjustedRentalDays > 1 ? 's' : ''} conservés
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-white px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">Jours retirés</p>
                    <p className="text-sm font-semibold text-foreground">
                      {partialPreview?.removedDays} jour{partialPreview?.removedDays > 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nouveau montant de location: {formatCurrency(partialPreview?.adjustedRentalAmount)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-white px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {isOwnerView
                        ? 'Remboursement locataire'
                        : (reservation?.isPaid ? 'Remboursement estimé' : 'Impact paiement')}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {isOwnerView
                        ? formatCurrency(ownerPartialPreview?.renterRefundAmount)
                        : (reservation?.isPaid
                          ? formatCurrency(partialPreview?.refundAmount)
                          : formatCurrency(partialPreview?.adjustedRentalAmount))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isOwnerView
                        ? 'Remboursement intégral de la partie annulée.'
                        : (reservation?.isPaid
                          ? `Frais d'annulation conservés : ${formatCurrency(partialPreview?.cancellationFeeAmount)}`
                          : "Aucun remboursement tant que le paiement n'est pas finalisé.")}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-white px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {isOwnerView ? "Frais d'annulation propriétaire" : "Frais d'annulation conservés"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {isOwnerView
                        ? formatCurrency(ownerPartialPreview?.ownerCancellationFeeAmount)
                        : formatCurrency(partialPreview?.cancellationFeeAmount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isOwnerView
                        ? 'Ces frais doivent être réglés pour valider la modification. Sans paiement, la réservation reste active.'
                        : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'full' && (
            <div className="rounded-xl border border-error/20 bg-error/5 p-4">
              <p className="text-sm font-medium text-foreground">
                {isOwnerView
                  ? `Le locataire sera remboursé intégralement de ${formatCurrency(fullCancellationPreview?.refundAmount)}. Vous réglerez ${formatCurrency(fullCancellationPreview?.cancellationFeeAmount)} de frais d'annulation pour confirmer l'annulation totale. ${ownerPaymentRequiredWarning}`
                  : (
                    reservation?.isPaid
                      ? `Le paiement locataire sera annulé. Le locataire récupérera ${formatCurrency(fullCancellationPreview?.refundAmount)} après déduction des frais d'annulation de ${formatCurrency(fullCancellationPreview?.cancellationFeeAmount)}.`
                      : "La réservation sera annulée avant paiement."
                  )}
              </p>
            </div>
          )}

          <Input
            label="Motif (optionnel)"
            value={reason}
            onChange={(event) => setReason(event?.target?.value || '')}
            placeholder="Ex: je n'ai plus besoin du matériel sur toute la période"
            disabled={loading}
          />

          {errorMessage && (
            <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {errorMessage}
            </div>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-white/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose?.()}
              disabled={loading}
            >
              Fermer
            </Button>
            <Button
              type="submit"
              variant={mode === 'full' ? 'danger' : 'default'}
              loading={loading}
              iconName={mode === 'full' ? 'XCircle' : 'CalendarRange'}
              className={mode === 'partial' ? 'bg-[#17a2b8] hover:bg-[#138496] text-white' : ''}
            >
              {isOwnerView
                ? (mode === 'full' ? "Payer puis confirmer l'annulation totale" : "Payer puis confirmer l'annulation partielle")
                : (mode === 'full' ? "Confirmer l'annulation totale" : "Confirmer l'annulation partielle")}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ReservationAdjustmentModal;


