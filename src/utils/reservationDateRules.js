import { addDays, isBefore, startOfDay } from 'date-fns';

export const SAME_DAY_RESERVATION_BLOCKED_MESSAGE = "La reservation le jour meme n'est pas autorisée. Merci de choisir une date a partir de demain.";
const YYYY_MM_DD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeReservationDay = (value) => {
  if (!value) return null;
  let parsed = value instanceof Date ? value : null;

  if (!parsed && typeof value === 'string' && YYYY_MM_DD_PATTERN.test(value.trim())) {
    const [year, month, day] = value.trim().split('-').map(Number);
    parsed = new Date(year, month - 1, day);
  }

  if (!parsed) {
    parsed = new Date(value);
  }

  if (Number.isNaN(parsed?.getTime())) return null;
  return startOfDay(parsed);
};

export const toReservationDateOnly = (value) => {
  const day = normalizeReservationDay(value);
  if (!day) return null;
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export const getEarliestReservationStartDate = (referenceDate = new Date()) => {
  const referenceDay = normalizeReservationDay(referenceDate) || startOfDay(new Date());
  return addDays(referenceDay, 1);
};

export const isReservationStartDateAllowed = (startDateValue, referenceDate = new Date()) => {
  const startDay = normalizeReservationDay(startDateValue);
  if (!startDay) return false;
  const minAllowedDate = getEarliestReservationStartDate(referenceDate);
  return !isBefore(startDay, minAllowedDate);
};
