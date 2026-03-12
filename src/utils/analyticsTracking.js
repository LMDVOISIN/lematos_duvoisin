import { supabase } from '../lib/supabase';

const COOKIE_CONSENT_STORAGE_KEY = 'lmv_cookie_consent_v1';
const ANALYTICS_VISITOR_ID_STORAGE_KEY = 'lmv_analytics_visitor_id_v1';
const ANALYTICS_SESSION_ID_STORAGE_KEY = 'lmv_analytics_session_id_v1';
const INTERNAL_ANALYTICS_TABLE = 'platform_analytics_events';
const INTERNAL_ANALYTICS_BATCH_SIZE = 15;
const INTERNAL_ANALYTICS_FLUSH_DELAY_MS = 1200;
const GA_PLACEHOLDER_IDS = new Set([
  '',
  'your-google-analytics-id-here',
  'G-XXXXXXXXXX',
  'UA-XXXXXXXXX-X'
]);

let internalAnalyticsQueue = [];
let internalAnalyticsFlushTimer = null;
let internalAnalyticsFlushInFlight = false;
let internalAnalyticsDisabled = false;
let internalAnalyticsMissingTableLogged = false;
let internalAnalyticsGlobalListenersBound = false;
let internalAnalyticsLastPageLocation = '';

const getMeasurementId = () =>
  String(
    import.meta.env?.VITE_GA_MEASUREMENT_ID ||
    import.meta.env?.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    ''
  ).trim();

export const hasAnalyticsConsent = () => {
  if (typeof window === 'undefined') return false;

  try {
    const rawConsent = window.localStorage?.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!rawConsent) return false;
    const parsed = JSON.parse(rawConsent);
    return Boolean(parsed?.preferences?.analytics ?? parsed?.analytics);
  } catch (_) {
    return false;
  }
};

const sanitizeParams = (params = {}) => {
  if (!params || typeof params !== 'object') return {};

  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    if (typeof value === 'function') return acc;
    acc[key] = value;
    return acc;
  }, {});
};

const trimText = (value, maxLength = 500) => {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const parseUrlSafe = (value) => {
  if (!value) return null;
  try {
    return new URL(value, typeof window !== 'undefined' ? window.location?.origin : 'https://localhost');
  } catch (_) {
    return null;
  }
};

const getCurrentPagePath = () => {
  if (typeof window === 'undefined') return '/';
  return `${window.location?.pathname || '/'}${window.location?.search || ''}`;
};

const getCurrentPageLocation = () => {
  if (typeof window === 'undefined') return undefined;
  return trimText(window.location?.href, 1000);
};

const getPageTypeFromPath = (rawPath = '') => {
  const path = String(rawPath || '').toLowerCase();
  if (path === '/' || path.startsWith('/accueil-recherche')) return 'home_search';
  if (path.startsWith('/location/')) return 'listing_detail';
  if (path.startsWith('/creer-annonce')) return 'listing_create';
  if (path.startsWith('/creer-demande')) return 'request_create';
  if (path.startsWith('/administration-')) return 'admin';
  if (path.startsWith('/authentification') || path.startsWith('/auth-callback')) return 'auth';
  if (path.startsWith('/legal/')) return 'legal';
  return 'other';
};

const getStorageItem = (storage, key) => {
  try {
    return storage?.getItem(key) || '';
  } catch (_) {
    return '';
  }
};

const setStorageItem = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
  } catch (_) {
    // ignore storage write issues
  }
};

const createRandomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lmv_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const getOrCreateVisitorId = () => {
  if (typeof window === 'undefined') return undefined;
  const existing = getStorageItem(window.localStorage, ANALYTICS_VISITOR_ID_STORAGE_KEY);
  if (existing) return existing;
  const nextId = createRandomId();
  setStorageItem(window.localStorage, ANALYTICS_VISITOR_ID_STORAGE_KEY, nextId);
  return nextId;
};

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return undefined;
  const existing = getStorageItem(window.sessionStorage, ANALYTICS_SESSION_ID_STORAGE_KEY);
  if (existing) return existing;
  const nextId = createRandomId();
  setStorageItem(window.sessionStorage, ANALYTICS_SESSION_ID_STORAGE_KEY, nextId);
  return nextId;
};

const inferDeviceType = () => {
  if (typeof window === 'undefined') return undefined;
  const width = Number(window.innerWidth || window.screen?.width || 0);
  if (width && width < 768) return 'mobile';
  if (width && width < 1024) return 'tablet';
  return 'desktop';
};

const getUtmContext = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location?.search || '');
  return {
    utm_source: trimText(params.get('utm_source'), 120),
    utm_medium: trimText(params.get('utm_medium'), 120),
    utm_campaign: trimText(params.get('utm_campaign'), 160),
    utm_term: trimText(params.get('utm_term'), 160),
    utm_content: trimText(params.get('utm_content'), 160),
  };
};

const shouldLogMissingTable = (error) => {
  const message = String(error?.message || '');
  return (
    error?.code === 'PGRST205'
    || (message.includes('platform_analytics_events') && /schema cache|does not exist/i.test(message))
  );
};

const bindInternalAnalyticsGlobalListeners = () => {
  if (internalAnalyticsGlobalListenersBound || typeof window === 'undefined') return;
  internalAnalyticsGlobalListenersBound = true;

  const flushSoon = () => {
    if (internalAnalyticsDisabled) return;
    if (internalAnalyticsFlushTimer) return;
    internalAnalyticsFlushTimer = window.setTimeout(() => {
      internalAnalyticsFlushTimer = null;
      void flushInternalAnalyticsQueue();
    }, 50);
  };

  window.addEventListener('pagehide', flushSoon);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSoon();
  });
};

const scheduleInternalAnalyticsFlush = (immediate = false) => {
  if (typeof window === 'undefined' || internalAnalyticsDisabled) return;
  bindInternalAnalyticsGlobalListeners();

  if (internalAnalyticsFlushTimer) {
    window.clearTimeout(internalAnalyticsFlushTimer);
    internalAnalyticsFlushTimer = null;
  }

  internalAnalyticsFlushTimer = window.setTimeout(() => {
    internalAnalyticsFlushTimer = null;
    void flushInternalAnalyticsQueue();
  }, immediate ? 50 : INTERNAL_ANALYTICS_FLUSH_DELAY_MS);
};

const flushInternalAnalyticsQueue = async () => {
  if (internalAnalyticsFlushInFlight || internalAnalyticsDisabled) return false;
  if (!Array.isArray(internalAnalyticsQueue) || internalAnalyticsQueue.length === 0) return false;

  internalAnalyticsFlushInFlight = true;
  const batch = internalAnalyticsQueue.slice(0, INTERNAL_ANALYTICS_BATCH_SIZE);

  try {
    const { error } = await supabase?.from(INTERNAL_ANALYTICS_TABLE)?.insert(batch);
    if (error) {
      if (shouldLogMissingTable(error)) {
        internalAnalyticsDisabled = true;
        if (!internalAnalyticsMissingTableLogged) {
          internalAnalyticsMissingTableLogged = true;
          console.warn('[analytics] Table platform_analytics_events absente. Appliquez les migrations analytics.');
        }
        internalAnalyticsQueue = [];
        return false;
      }
      console.error('[analytics] Echec insertion analytics interne:', error);
      return false;
    }

    internalAnalyticsQueue = internalAnalyticsQueue.slice(batch.length);
    if (internalAnalyticsQueue.length > 0) {
      scheduleInternalAnalyticsFlush(true);
    }
    return true;
  } catch (error) {
    console.error('[analytics] Exception insertion analytics interne:', error);
    return false;
  } finally {
    internalAnalyticsFlushInFlight = false;
  }
};

const buildInternalAnalyticsRow = (eventName, params = {}, options = {}) => {
  if (typeof window === 'undefined' || !eventName) return null;

  const safeParams = sanitizeParams(params);
  const pagePath = trimText(safeParams.page_path || options.pagePath || getCurrentPagePath(), 500);
  const pageLocation = trimText(safeParams.page_location || options.pageLocation || getCurrentPageLocation(), 1000);
  const pageTitle = trimText(safeParams.page_title || options.pageTitle || (typeof document !== 'undefined' ? document.title : ''), 300);
  const explicitReferrer = trimText(safeParams.page_referrer || safeParams.referrer || options.referrer, 1000);
  const virtualReferrer = eventName === 'page_view' ? trimText(internalAnalyticsLastPageLocation, 1000) : undefined;
  const referrer = explicitReferrer || virtualReferrer || trimText(document?.referrer, 1000);
  const referrerHost = trimText(parseUrlSafe(referrer)?.hostname, 255);
  const pageType = trimText(options.pageType || safeParams.page_type || getPageTypeFromPath(pagePath), 80);

  const metadata = sanitizeParams({
    ...safeParams,
    page_path: undefined,
    page_title: undefined,
    page_location: undefined,
    page_type: undefined,
    page_referrer: undefined,
    referrer: undefined,
  });

  const row = {
    event_name: trimText(eventName, 120),
    event_category: trimText(options.eventCategory || safeParams.event_category || '', 80),
    event_source: trimText(options.eventSource || 'web_client', 80),
    page_path: pagePath,
    page_type: pageType,
    page_title: pageTitle,
    page_location: pageLocation,
    referrer,
    referrer_host: referrerHost,
    session_id: trimText(getOrCreateSessionId(), 120),
    visitor_id: trimText(getOrCreateVisitorId(), 120),
    device_type: inferDeviceType(),
    viewport_width: Number.isFinite(Number(window.innerWidth)) ? Number(window.innerWidth) : null,
    viewport_height: Number.isFinite(Number(window.innerHeight)) ? Number(window.innerHeight) : null,
    screen_width: Number.isFinite(Number(window.screen?.width)) ? Number(window.screen.width) : null,
    screen_height: Number.isFinite(Number(window.screen?.height)) ? Number(window.screen.height) : null,
    language: trimText(navigator?.language, 40),
    timezone: trimText(Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone, 80),
    ...getUtmContext(),
    metadata,
    occurred_at: new Date()?.toISOString(),
  };

  if (eventName === 'page_view' && pageLocation) {
    internalAnalyticsLastPageLocation = pageLocation;
  }

  return Object.entries(row).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
};

export const trackInternalAnalyticsEvent = (eventName, params = {}, options = {}) => {
  if (typeof window === 'undefined' || !eventName) return false;
  if (!hasAnalyticsConsent()) return false;
  if (internalAnalyticsDisabled) return false;

  const row = buildInternalAnalyticsRow(eventName, params, options);
  if (!row) return false;

  internalAnalyticsQueue.push(row);
  scheduleInternalAnalyticsFlush(internalAnalyticsQueue.length >= INTERNAL_ANALYTICS_BATCH_SIZE);
  return true;
};

export const buildListingAnalyticsItem = (listing = {}) => {
  if (!listing?.id) return null;

  const price = Number(listing?.dailyPrice ?? listing?.prix_jour ?? listing?.price ?? 0);
  return {
    item_id: String(listing?.id),
    item_name: listing?.title || listing?.titre || 'Annonce',
    item_category: listing?.category || listing?.categorie || undefined,
    location_id: listing?.city || listing?.ville || listing?.location || undefined,
    price: Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : undefined,
    currency: 'EUR'
  };
};

export const trackAnalyticsEvent = (eventName, params = {}) => {
  if (typeof window === 'undefined' || !eventName) return false;

  const sentInternal = trackInternalAnalyticsEvent(eventName, params, { eventCategory: 'engagement' });
  const measurementId = getMeasurementId();
  if (GA_PLACEHOLDER_IDS.has(measurementId)) return sentInternal;
  if (!hasAnalyticsConsent()) return false;
  if (window?.[`ga-disable-${measurementId}`] === true) return sentInternal;
  if (typeof window.gtag !== 'function') return sentInternal;

  try {
    window.gtag('event', eventName, sanitizeParams(params));
    return true;
  } catch (error) {
    console.error('Erreur de tracking analytics:', error);
    return sentInternal;
  }
};

export default trackAnalyticsEvent;
