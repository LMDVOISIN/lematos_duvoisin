import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';

const DEFAULT_SITE_URL = 'https://www.lematosduvoisin.fr';

const normalizeOrigin = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const normalizePath = (value = '/') => {
  const path = String(value || '').trim();
  if (!path) return '/';
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
};

const normalizeMobileBaseUrl = (value = '') => String(value || '').trim().replace(/\/+$/, '');

export const isNativeApp = () => Capacitor.isNativePlatform();

export const getWebAppBaseUrl = () => {
  const explicitUrl = normalizeOrigin(import.meta.env?.VITE_SITE_URL || import.meta.env?.VITE_APP_URL);
  if (explicitUrl) return explicitUrl;

  if (typeof window !== 'undefined' && window?.location?.origin) {
    return normalizeOrigin(window.location.origin);
  }

  return normalizeOrigin(DEFAULT_SITE_URL);
};

export const buildWebAppUrl = (path = '/') => {
  const normalizedPath = normalizePath(path);
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${getWebAppBaseUrl()}${normalizedPath}`;
};

export const buildAppRedirectUrl = (path = '/') => {
  const normalizedPath = normalizePath(path);
  const mobileBaseUrl = normalizeMobileBaseUrl(import.meta.env?.VITE_MOBILE_CALLBACK_URL);

  if (isNativeApp() && mobileBaseUrl) {
    if (/^[a-z][a-z0-9+\-.]*:\/\/$/i.test(mobileBaseUrl)) {
      return `${mobileBaseUrl}${normalizedPath.replace(/^\//, '')}`;
    }

    return `${mobileBaseUrl}${normalizedPath}`;
  }

  return buildWebAppUrl(normalizedPath);
};

export const redirectToExternalUrl = async (url) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return;

  if (isNativeApp() && Capacitor.isPluginAvailable('Browser')) {
    await Browser.open({ url: normalizedUrl });
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.assign(normalizedUrl);
  }
};

export const openExternalWindow = async (url, target = '_blank', features = 'noopener,noreferrer') => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return;

  if (isNativeApp() && Capacitor.isPluginAvailable('Browser')) {
    await Browser.open({ url: normalizedUrl });
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(normalizedUrl, target, features);
  }
};

export const closeExternalBrowser = async () => {
  if (!isNativeApp() || !Capacitor.isPluginAvailable('Browser')) return;

  try {
    await Browser.close();
  } catch (_error) {
    // Browser.close can be a no-op depending on platform/browser state.
  }
};

export const shareContent = async ({ title, text, url } = {}) => {
  if (isNativeApp() && Capacitor.isPluginAvailable('Share')) {
    await Share.share({ title, text, url });
    return true;
  }

  if (navigator?.share) {
    await navigator.share({ title, text, url });
    return true;
  }

  return false;
};

export const normalizeAppUrlToRoute = (url) => {
  try {
    const parsedUrl = new URL(url);
    const protocol = String(parsedUrl.protocol || '').replace(':', '').toLowerCase();
    const customHost = String(parsedUrl.host || '').toLowerCase();
    const suffix = `${parsedUrl.search || ''}${parsedUrl.hash || ''}`;

    if (protocol === 'http' || protocol === 'https') {
      return `${parsedUrl.pathname || '/'}${suffix}`;
    }

    if (customHost === 'app') {
      return `${parsedUrl.pathname || '/'}${suffix}`;
    }

    const hostSegment = parsedUrl.host ? `/${parsedUrl.host}` : '';
    const routePath = `${hostSegment}${parsedUrl.pathname || ''}`.replace(/\/{2,}/g, '/');
    return `${routePath || '/'}${suffix}`;
  } catch (_error) {
    return null;
  }
};

export const getLaunchUrl = async () => {
  if (!isNativeApp() || !Capacitor.isPluginAvailable('App')) return null;

  try {
    const launchData = await CapacitorApp.getLaunchUrl();
    return launchData?.url || null;
  } catch (_error) {
    return null;
  }
};

export const addAppUrlOpenListener = async (callback) => {
  if (!isNativeApp() || !Capacitor.isPluginAvailable('App') || typeof callback !== 'function') {
    return () => {};
  }

  const handle = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (url) {
      callback(url);
    }
  });

  return () => {
    void handle.remove();
  };
};
