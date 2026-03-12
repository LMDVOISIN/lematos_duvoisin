const ADMIN_ACCESS_SESSION_STORAGE_KEY = "admin_access_session_granted_at";
const ADMIN_ACCESS_PERSISTENT_STORAGE_KEY = "admin_access_persistent_granted_at";
const ADMIN_ACCESS_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ADMIN_ACCESS_PERSISTENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 an

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readGrantTimestamp(storage, key) {
  if (!storage) return null;

  const rawValue = storage.getItem(key);
  if (!rawValue) return null;

  const grantedAt = Number(rawValue);
  return Number.isFinite(grantedAt) ? grantedAt : null;
}

function isGrantValid(grantedAt, ttlMs) {
  if (!Number.isFinite(grantedAt)) return false;
  return Date.now() - grantedAt <= ttlMs;
}

export function grantAdminAccess(options = {}) {
  const persistent = options?.persistent !== false;
  const storage = persistent ? getLocalStorage() : getSessionStorage();
  if (!storage) return;

  const now = String(Date.now());

  if (persistent) {
    storage.setItem(ADMIN_ACCESS_PERSISTENT_STORAGE_KEY, now);
    getSessionStorage()?.removeItem(ADMIN_ACCESS_SESSION_STORAGE_KEY);
    return;
  }

  storage.setItem(ADMIN_ACCESS_SESSION_STORAGE_KEY, now);
  getLocalStorage()?.removeItem(ADMIN_ACCESS_PERSISTENT_STORAGE_KEY);
}

export function clearAdminAccess() {
  getSessionStorage()?.removeItem(ADMIN_ACCESS_SESSION_STORAGE_KEY);
  getLocalStorage()?.removeItem(ADMIN_ACCESS_PERSISTENT_STORAGE_KEY);
}

export function isAdminAccessGranted() {
  const localStorage = getLocalStorage();
  const sessionStorage = getSessionStorage();

  const persistentGrantedAt = readGrantTimestamp(localStorage, ADMIN_ACCESS_PERSISTENT_STORAGE_KEY);
  if (persistentGrantedAt !== null) {
    if (isGrantValid(persistentGrantedAt, ADMIN_ACCESS_PERSISTENT_TTL_MS)) {
      return true;
    }
    localStorage?.removeItem(ADMIN_ACCESS_PERSISTENT_STORAGE_KEY);
  }

  const sessionGrantedAt = readGrantTimestamp(sessionStorage, ADMIN_ACCESS_SESSION_STORAGE_KEY);
  if (sessionGrantedAt !== null) {
    if (isGrantValid(sessionGrantedAt, ADMIN_ACCESS_SESSION_TTL_MS)) {
      return true;
    }
    sessionStorage?.removeItem(ADMIN_ACCESS_SESSION_STORAGE_KEY);
  }

  return false;
}
