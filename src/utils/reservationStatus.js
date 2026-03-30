export const PREPAYMENT_RESERVATION_STATUSES = new Set(['pending', 'accepted']);
export const PAYMENT_CONFIRMED_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing', 'completed']);
export const AVAILABILITY_HOLD_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing', 'completed']);
export const CURRENT_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing']);
export const CHAT_ELIGIBLE_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing']);
export const PICKUP_READY_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing', 'completed']);

export const normalizeReservationStatusValue = (value) => String(value || '')?.trim()?.toLowerCase();

export const isReservationPaymentConfirmed = (reservation = {}) => {
  const status = normalizeReservationStatusValue(reservation?.status);
  return Boolean(
    reservation?.paid_at
    || reservation?.tenant_payment_paid_at
    || PAYMENT_CONFIRMED_RESERVATION_STATUSES?.has(status)
  );
};
