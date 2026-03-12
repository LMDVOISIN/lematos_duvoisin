const CITY_PREFILL_STORAGE_KEY = 'preferred_city';

const normalizeCity = (value = '') =>
  String(value || '')
    ?.trim()
    ?.replace(/\s+/g, ' ');

export const getStoredCity = () => {
  if (typeof window === 'undefined') return '';

  try {
    return normalizeCity(window.localStorage?.getItem(CITY_PREFILL_STORAGE_KEY) || '');
  } catch (error) {
    return '';
  }
};

export const setStoredCity = (value) => {
  if (typeof window === 'undefined') return;

  const normalizedCity = normalizeCity(value);

  try {
    if (!normalizedCity) {
      window.localStorage?.removeItem(CITY_PREFILL_STORAGE_KEY);
      return;
    }

    window.localStorage?.setItem(CITY_PREFILL_STORAGE_KEY, normalizedCity);
  } catch (error) {
    // Ignore storage errors (private mode/quota)
  }
};

export const getBestKnownCity = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeCity(candidate);
    if (normalized) return normalized;
  }

  return '';
};

