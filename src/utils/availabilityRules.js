import { startOfDay } from 'date-fns';

const WEEKDAY_MAP = {
  dimanche: 0,
  dim: 0,
  sunday: 0,
  lundi: 1,
  lun: 1,
  monday: 1,
  mardi: 2,
  mar: 2,
  tuesday: 2,
  mercredi: 3,
  mer: 3,
  wednesday: 3,
  jeudi: 4,
  jeu: 4,
  thursday: 4,
  vendredi: 5,
  ven: 5,
  friday: 5,
  samedi: 6,
  sam: 6,
  saturday: 6
};

const YYYY_MM_DD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const parseMaybeJsonArray = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (value instanceof Set) return Array.from(value.values());

  if (typeof value === 'string') {
    const parsedJsonArray = parseMaybeJsonArray(value);
    if (parsedJsonArray) return parsedJsonArray;

    return value
      .split(/[;,|]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [value];
};

const normalizeWeekday = (value) => {
  if (Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }

  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    const asNumber = Number(normalized);
    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 6) {
      return asNumber;
    }
  }

  return Object.prototype.hasOwnProperty.call(WEEKDAY_MAP, normalized)
    ? WEEKDAY_MAP[normalized]
    : null;
};

export const normalizeScheduleWeekdays = (value) => {
  const weekdays = toList(value)
    .map((entry) => normalizeWeekday(entry))
    .filter((entry) => Number.isInteger(entry));

  return Array.from(new Set(weekdays));
};

export const normalizeDateToLocalDay = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value?.getTime()) ? null : startOfDay(value);
  }

  if (typeof value === 'string' && YYYY_MM_DD_PATTERN.test(value.trim())) {
    const [year, month, day] = value.trim().split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed?.getTime()) ? null : startOfDay(parsed);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed?.getTime())) return null;
  return startOfDay(parsed);
};

export const toDateOnlyString = (value) => {
  const day = normalizeDateToLocalDay(value);
  if (!day) return null;

  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export const buildBlockedDateSet = (values = []) => {
  const set = new Set();

  toList(values).forEach((entry) => {
    const normalized = toDateOnlyString(entry);
    if (normalized) set.add(normalized);
  });

  return set;
};

export const isDateBlocked = (date, blockedDateSet = new Set()) => {
  const normalized = toDateOnlyString(date);
  if (!normalized) return false;
  return blockedDateSet.has(normalized);
};

export const isDateAllowedByWeekdays = (date, allowedWeekdays = []) => {
  const day = normalizeDateToLocalDay(date);
  if (!day) return false;

  const normalized = normalizeScheduleWeekdays(allowedWeekdays);
  if (normalized.length === 0) return true;
  return normalized.includes(day.getDay());
};

export const rangeContainsBlockedDate = (startDate, endDate, blockedDateSet = new Set()) => {
  const start = normalizeDateToLocalDay(startDate);
  const end = normalizeDateToLocalDay(endDate);
  if (!start || !end) return false;

  const left = start <= end ? new Date(start) : new Date(end);
  const right = start <= end ? end : start;

  while (left <= right) {
    const dateOnly = toDateOnlyString(left);
    if (dateOnly && blockedDateSet.has(dateOnly)) {
      return true;
    }
    left.setDate(left.getDate() + 1);
  }

  return false;
};

