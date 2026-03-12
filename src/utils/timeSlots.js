const TIME_WITH_OPTIONAL_SECONDS_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,6})?)?(?:\s?(?:Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?))?$/i;

export const normalizeTimeValue = (value) => {
  if (value == null) return null;

  const raw = String(value)?.trim();
  if (!raw) return null;

  const matched = raw?.match(TIME_WITH_OPTIONAL_SECONDS_REGEX);
  if (matched?.[1] && matched?.[2]) {
    return `${matched[1]}:${matched[2]}`;
  }

  return null;
};

export const isValidTimeValue = (value) => Boolean(normalizeTimeValue(value));

export const formatTimeRange = (startTime, endTime) => {
  const normalizedStart = normalizeTimeValue(startTime);
  const normalizedEnd = normalizeTimeValue(endTime);

  if (normalizedStart && normalizedEnd) return `${normalizedStart} - ${normalizedEnd}`;
  if (normalizedStart) return normalizedStart;
  if (normalizedEnd) return normalizedEnd;
  return null;
};
