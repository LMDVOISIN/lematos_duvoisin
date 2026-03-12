import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  addAppUrlOpenListener,
  closeExternalBrowser,
  getLaunchUrl,
  isNativeApp,
  normalizeAppUrlToRoute
} from '../utils/nativeRuntime';

const NativeAppUrlHandler = () => {
  const navigate = useNavigate();
  const lastRouteRef = useRef('');

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    let cancelled = false;
    let removeListener = () => {};

    const handleUrl = async (url) => {
      const route = normalizeAppUrlToRoute(url);
      if (!route || lastRouteRef.current === route) return;

      lastRouteRef.current = route;
      await closeExternalBrowser();
      navigate(route, { replace: true });
    };

    const setup = async () => {
      const launchUrl = await getLaunchUrl();
      if (!cancelled && launchUrl) {
        await handleUrl(launchUrl);
      }

      const cleanup = await addAppUrlOpenListener((url) => {
        void handleUrl(url);
      });

      if (cancelled) {
        cleanup?.();
        return;
      }

      removeListener = cleanup;
    };

    void setup();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [navigate]);

  return null;
};

export default NativeAppUrlHandler;
