const PRE_ADMIN_SESSION_STORAGE_KEY = 'admin_access_previous_user_session';
const DEDICATED_ADMIN_SESSION_STORAGE_KEY = 'admin_access_dedicated_session_active';

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function normalizeSessionPayload(session) {
  const accessToken = String(session?.access_token || session?.accessToken || '').trim();
  const refreshToken = String(session?.refresh_token || session?.refreshToken || '').trim();

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken
  };
}

export function rememberPreAdminSession(session) {
  const storage = getSessionStorage();
  const normalizedSession = normalizeSessionPayload(session);

  if (!storage || !normalizedSession) {
    return;
  }

  storage.setItem(
    PRE_ADMIN_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...normalizedSession,
      savedAt: Date.now()
    })
  );
}

export function readRememberedPreAdminSession() {
  const storage = getSessionStorage();
  if (!storage) return null;

  const rawValue = storage.getItem(PRE_ADMIN_SESSION_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsedValue = JSON.parse(rawValue);
    return normalizeSessionPayload(parsedValue);
  } catch {
    storage.removeItem(PRE_ADMIN_SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearRememberedPreAdminSession() {
  getSessionStorage()?.removeItem(PRE_ADMIN_SESSION_STORAGE_KEY);
}

export function markDedicatedAdminSessionActive() {
  getSessionStorage()?.setItem(DEDICATED_ADMIN_SESSION_STORAGE_KEY, '1');
}

export function clearDedicatedAdminSessionMarker() {
  getSessionStorage()?.removeItem(DEDICATED_ADMIN_SESSION_STORAGE_KEY);
}

export function isDedicatedAdminSessionActive() {
  return getSessionStorage()?.getItem(DEDICATED_ADMIN_SESSION_STORAGE_KEY) === '1';
}
