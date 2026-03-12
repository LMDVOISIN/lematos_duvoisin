import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const COOKIE_CONSENT_STORAGE_KEY = 'lmv_cookie_consent_v1';
const COOKIE_CONSENT_EVENT = 'lmv:cookie-consent-updated';

const DEFAULT_COOKIE_PREFERENCES = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false
};

const normalizePreferences = (preferences = {}) => ({
  essential: true,
  functional: Boolean(preferences?.functional),
  analytics: Boolean(preferences?.analytics),
  marketing: Boolean(preferences?.marketing)
});

const readStoredConsent = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawConsent = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!rawConsent) return null;

    const parsedConsent = JSON.parse(rawConsent);
    const parsedPreferences = normalizePreferences(
      parsedConsent?.preferences ? parsedConsent.preferences : parsedConsent
    );

    return {
      version: parsedConsent?.version || 1,
      preferences: parsedPreferences,
      updatedAt: parsedConsent?.updatedAt || new Date().toISOString(),
      source: parsedConsent?.source || 'unknown'
    };
  } catch (error) {
    console.error('Impossible de lire les preferences cookies:', error);
    return null;
  }
};

const writeStoredConsent = (preferences, source = 'app') => {
  if (typeof window === 'undefined') return null;

  const payload = {
    version: 1,
    preferences: normalizePreferences(preferences),
    updatedAt: new Date().toISOString(),
    source
  };

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: payload }));

  return payload;
};

const clearStoredConsent = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: null }));
};

const CookieConsentContext = createContext(null);

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent doit etre utilise dans CookieConsentProvider');
  }
  return context;
};

export const CookieConsentProvider = ({ children }) => {
  const [consent, setConsent] = useState(() => readStoredConsent());

  const savePreferences = useCallback((nextPreferences, source = 'app') => {
    const storedConsent = writeStoredConsent(nextPreferences, source);
    setConsent(storedConsent);
    return storedConsent;
  }, []);

  const acceptAll = useCallback(() => {
    return savePreferences(
      {
        essential: true,
        functional: true,
        analytics: true,
        marketing: true
      },
      'accept_all'
    );
  }, [savePreferences]);

  const rejectNonEssential = useCallback(() => {
    return savePreferences(
      {
        essential: true,
        functional: false,
        analytics: false,
        marketing: false
      },
      'reject_non_essential'
    );
  }, [savePreferences]);

  const resetPreferences = useCallback(() => {
    clearStoredConsent();
    setConsent(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorageChange = (event) => {
      if (event?.key === COOKIE_CONSENT_STORAGE_KEY) {
        setConsent(readStoredConsent());
      }
    };

    const handleLocalConsentUpdate = (event) => {
      if (event?.detail === null) {
        setConsent(null);
        return;
      }

      if (event?.detail) {
        setConsent(event.detail);
        return;
      }

      setConsent(readStoredConsent());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(COOKIE_CONSENT_EVENT, handleLocalConsentUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleLocalConsentUpdate);
    };
  }, []);

  const preferences = consent?.preferences || DEFAULT_COOKIE_PREFERENCES;
  const hasDecision = Boolean(consent);

  const value = useMemo(
    () => ({
      consent,
      preferences,
      hasDecision,
      savePreferences,
      acceptAll,
      rejectNonEssential,
      resetPreferences
    }),
    [acceptAll, consent, hasDecision, preferences, rejectNonEssential, resetPreferences, savePreferences]
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
};

export { COOKIE_CONSENT_STORAGE_KEY, DEFAULT_COOKIE_PREFERENCES };
