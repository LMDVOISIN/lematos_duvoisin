import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const updateVerificationMarker = ({ routeId, pathname, search }) => {
  if (typeof window === 'undefined' || !routeId) return;

  const body = window.document?.body;
  const fullPath = `${String(pathname || '')}${String(search || '')}`;
  if (body) {
    body.dataset.ldvVerificationReady = '1';
    body.dataset.ldvVerificationRoute = String(routeId);
    body.dataset.ldvVerificationPath = fullPath;
  }

  window.__ldvVerification = {
    ready: true,
    routeId: String(routeId),
    pathname: fullPath,
    updatedAt: new Date().toISOString()
  };
};

const clearVerificationMarker = (routeId) => {
  if (typeof window === 'undefined') return;

  const body = window.document?.body;
  if (body && body.dataset?.ldvVerificationRoute === String(routeId)) {
    delete body.dataset.ldvVerificationReady;
    delete body.dataset.ldvVerificationRoute;
    delete body.dataset.ldvVerificationPath;
  }

  if (window.__ldvVerification?.routeId === String(routeId)) {
    delete window.__ldvVerification;
  }
};

const RouteVerificationMarker = ({ routeId, children }) => {
  const location = useLocation();

  useEffect(() => {
    updateVerificationMarker({
      routeId,
      pathname: location?.pathname || '',
      search: location?.search || ''
    });

    return () => {
      clearVerificationMarker(routeId);
    };
  }, [location?.pathname, location?.search, routeId]);

  return children;
};

export default RouteVerificationMarker;
