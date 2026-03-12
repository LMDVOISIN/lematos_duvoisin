import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCookieConsent } from '../../contexts/CookieConsentContext';
import { trackInternalAnalyticsEvent } from '../../utils/analyticsTracking';

const ANALYTICS_SCRIPT_ID = 'lmv-ga4-script';
const GA_PLACEHOLDER_IDS = new Set([
  '',
  'your-google-analytics-id-here',
  'G-XXXXXXXXXX',
  'UA-XXXXXXXXX-X'
]);

const listGoogleAnalyticsCookies = () => {
  if (typeof document === 'undefined') return [];

  return document.cookie
    .split(';')
    .map((cookie) => cookie?.trim()?.split('=')?.[0])
    .filter(Boolean)
    .filter((cookieName) => cookieName === '_ga' || cookieName === '_gid' || cookieName === '_gat' || cookieName?.startsWith('_ga_'));
};

const clearCookieAcrossDomains = (cookieName) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const hostname = window.location?.hostname || '';
  const domains = [''];

  if (hostname) {
    domains.push(hostname);
    const hostnameParts = hostname.split('.');
    if (hostnameParts.length > 1) {
      domains.push(`.${hostnameParts.slice(-2).join('.')}`);
    }
  }

  domains.forEach((domain) => {
    const domainPart = domain ? `; domain=${domain}` : '';
    document.cookie = `${cookieName}=; Max-Age=0; path=/${domainPart}`;
  });
};

const clearGoogleAnalyticsCookies = () => {
  const cookieNames = listGoogleAnalyticsCookies();
  cookieNames.forEach((cookieName) => clearCookieAcrossDomains(cookieName));
};

const removeAnalyticsScript = () => {
  if (typeof document === 'undefined') return;
  const existingScript = document.getElementById(ANALYTICS_SCRIPT_ID);
  if (existingScript) {
    existingScript.remove();
  }
};

const ensureGtagStub = () => {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
};

const CookieAwareAnalytics = () => {
  const location = useLocation();
  const { preferences } = useCookieConsent();
  const rawMeasurementId =
    import.meta.env?.VITE_GA_MEASUREMENT_ID ||
    import.meta.env?.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    '';
  const measurementId = String(rawMeasurementId || '').trim();
  const isMeasurementIdConfigured = !GA_PLACEHOLDER_IDS.has(measurementId);
  const analyticsEnabled = Boolean(preferences?.analytics) && isMeasurementIdConfigured;
  const debugMode = String(import.meta.env?.VITE_GA_DEBUG_MODE || '').toLowerCase() === 'true';
  const lastTrackedPathRef = useRef('');
  const pagePath = useMemo(
    () => `${location?.pathname || '/'}${location?.search || ''}`,
    [location?.pathname, location?.search]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !isMeasurementIdConfigured) return undefined;

    const disableKey = `ga-disable-${measurementId}`;

    if (!preferences?.analytics) {
      window[disableKey] = true;
      ensureGtagStub();
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      removeAnalyticsScript();
      clearGoogleAnalyticsCookies();
      lastTrackedPathRef.current = '';
      return undefined;
    }

    window[disableKey] = false;
    ensureGtagStub();

    window.gtag('js', new Date());
    window.gtag('consent', 'default', { analytics_storage: 'denied' });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('config', measurementId, {
      anonymize_ip: true,
      send_page_view: false,
      ...(debugMode ? { debug_mode: true } : {})
    });

    if (!document.getElementById(ANALYTICS_SCRIPT_ID)) {
      const analyticsScript = document.createElement('script');
      analyticsScript.id = ANALYTICS_SCRIPT_ID;
      analyticsScript.async = true;
      analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(analyticsScript);
    }

    return undefined;
  }, [debugMode, isMeasurementIdConfigured, measurementId, preferences?.analytics]);

  useEffect(() => {
    if (typeof window === 'undefined' || !analyticsEnabled) return undefined;

    ensureGtagStub();
    const pageLocation = window.location?.href;
    const nextTrackedPath = pagePath || '/';

    if (lastTrackedPathRef.current === nextTrackedPath) {
      return undefined;
    }

    lastTrackedPathRef.current = nextTrackedPath;
    window.gtag?.('event', 'page_view', {
      send_to: measurementId,
      page_path: nextTrackedPath,
      page_location: pageLocation,
      page_title: typeof document !== 'undefined' ? document.title : undefined,
      ...(debugMode ? { debug_mode: true } : {})
    });

    trackInternalAnalyticsEvent('page_view', {
      page_path: nextTrackedPath,
      page_location: pageLocation,
      page_title: typeof document !== 'undefined' ? document.title : undefined,
      debug_mode: debugMode || undefined
    }, {
      eventCategory: 'navigation'
    });

    return undefined;
  }, [analyticsEnabled, debugMode, measurementId, pagePath]);

  useEffect(() => {
    if (typeof window === 'undefined' || !analyticsEnabled) return undefined;

    const pageStartMs = Date.now();
    const milestones = [25, 50, 90];
    const trackedMilestones = new Set();
    const pageLocation = window.location?.href;
    let maxScrollPercent = 0;
    let isActive = true;

    const getScrollPercent = () => {
      const scrollY = Number(window.scrollY || window.pageYOffset || 0);
      const viewportHeight = Number(window.innerHeight || 0);
      const docHeight = Number(
        Math.max(
          document.documentElement?.scrollHeight || 0,
          document.body?.scrollHeight || 0,
          viewportHeight
        )
      );
      const scrollableHeight = Math.max(0, docHeight - viewportHeight);
      if (scrollableHeight <= 0) return 100;
      const percent = Math.round(Math.min(100, Math.max(0, (scrollY / scrollableHeight) * 100)));
      return percent;
    };

    const handleScroll = () => {
      const percent = getScrollPercent();
      if (percent > maxScrollPercent) {
        maxScrollPercent = percent;
      }

      milestones.forEach((milestone) => {
        if (percent < milestone || trackedMilestones.has(milestone)) return;
        trackedMilestones.add(milestone);
        trackInternalAnalyticsEvent('scroll_depth', {
          page_path: pagePath,
          page_location: pageLocation,
          percent_scrolled: milestone
        }, {
          eventCategory: 'engagement'
        });
      });
    };

    const engagedTimer = window.setTimeout(() => {
      if (!isActive) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      trackInternalAnalyticsEvent('page_engaged_15s', {
        page_path: pagePath,
        page_location: pageLocation,
        engaged_seconds: 15
      }, {
        eventCategory: 'engagement'
      });
    }, 15000);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isActive = false;
      window.clearTimeout(engagedTimer);
      window.removeEventListener('scroll', handleScroll);

      const dwellMs = Math.max(0, Date.now() - pageStartMs);
      trackInternalAnalyticsEvent('page_exit', {
        page_path: pagePath,
        page_location: pageLocation,
        dwell_time_ms: dwellMs,
        max_scroll_percent: maxScrollPercent
      }, {
        eventCategory: 'engagement'
      });
    };
  }, [analyticsEnabled, pagePath]);

  return null;
};

export default CookieAwareAnalytics;
