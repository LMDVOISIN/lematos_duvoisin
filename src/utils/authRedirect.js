const AUTH_REDIRECT_STORAGE_KEY = 'auth_redirect_after_login_v1';
const DEFAULT_AUTH_REDIRECT_PATH = '/accueil-recherche';

const canUseSessionStorage = () => typeof window !== 'undefined' && Boolean(window?.sessionStorage);

const isSafeInternalPath = (value) => {
  if (typeof value !== 'string') return false;

  const normalizedValue = value?.trim();
  if (!normalizedValue?.startsWith('/')) return false;
  if (normalizedValue?.startsWith('//')) return false;
  if (normalizedValue?.startsWith('/authentification')) return false;

  return true;
};

export const sanitizeAuthRedirectPath = (value, fallback = DEFAULT_AUTH_REDIRECT_PATH) => {
  return isSafeInternalPath(value) ? value : fallback;
};

export const storeAuthRedirectPath = (path) => {
  if (!canUseSessionStorage()) return;

  const sanitizedPath = sanitizeAuthRedirectPath(path, '');
  if (!sanitizedPath) return;

  try {
    window.sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, sanitizedPath);
  } catch (error) {
    console.warn('Impossible de sauvegarder la redirection apr?s connexion:', error);
  }
};

export const readAuthRedirectPath = () => {
  if (!canUseSessionStorage()) return null;

  try {
    const rawPath = window.sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
    return sanitizeAuthRedirectPath(rawPath, null);
  } catch (error) {
    console.warn('Impossible de lire la redirection apr?s connexion:', error);
    return null;
  }
};

export const clearAuthRedirectPath = () => {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  } catch (error) {
    console.warn('Impossible de nettoyer la redirection apr?s connexion:', error);
  }
};

export const consumeAuthRedirectPath = (fallback = DEFAULT_AUTH_REDIRECT_PATH) => {
  const redirectPath = readAuthRedirectPath();
  clearAuthRedirectPath();
  return sanitizeAuthRedirectPath(redirectPath, fallback);
};

export const resolveAuthRedirectPath = (location, fallback = DEFAULT_AUTH_REDIRECT_PATH) => {
  const fromState = sanitizeAuthRedirectPath(location?.state?.from, null);
  if (fromState) return fromState;

  const fromStorage = readAuthRedirectPath();
  if (fromStorage) return fromStorage;

  return fallback;
};
