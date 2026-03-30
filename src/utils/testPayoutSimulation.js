const TEST_PAYOUT_SIMULATION_STORAGE_KEY = 'ldv_test_payout_simulation';

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeEmail = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeLast4 = (value = '') =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(-4);

const sanitizeSimulation = (payload = {}) => {
  const userId = normalizeText(payload?.userId);
  if (!userId) return null;

  return {
    userId,
    displayName: normalizeText(payload?.displayName),
    email: normalizeEmail(payload?.email),
    bankName: normalizeText(payload?.bankName) || 'Compte bancaire de test',
    last4: normalizeLast4(payload?.last4),
    createdAt: normalizeText(payload?.createdAt) || new Date().toISOString(),
  };
};

export const getStoredTestPayoutSimulation = (userId = '') => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage?.getItem(TEST_PAYOUT_SIMULATION_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = sanitizeSimulation(JSON.parse(rawValue));
    if (!parsed || parsed.userId !== normalizeText(userId)) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
};

export const setStoredTestPayoutSimulation = (payload = {}) => {
  if (typeof window === 'undefined') {
    return sanitizeSimulation(payload);
  }

  const sanitized = sanitizeSimulation(payload);

  try {
    if (!sanitized) {
      window.localStorage?.removeItem(TEST_PAYOUT_SIMULATION_STORAGE_KEY);
      return null;
    }

    window.localStorage?.setItem(
      TEST_PAYOUT_SIMULATION_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
  } catch (_error) {
    // Ignore private mode / quota issues.
  }

  return sanitized;
};

export const clearStoredTestPayoutSimulation = (userId = '') => {
  if (typeof window === 'undefined') return;

  try {
    const current = getStoredTestPayoutSimulation(userId);
    if (!current) return;
    window.localStorage?.removeItem(TEST_PAYOUT_SIMULATION_STORAGE_KEY);
  } catch (_error) {
    // Ignore storage errors.
  }
};
