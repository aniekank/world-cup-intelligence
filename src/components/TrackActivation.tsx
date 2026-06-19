'use client';

import { useEffect } from 'react';

type Umami = { track: (event: string, data?: Record<string, unknown>) => void };

/**
 * Fires a single "activation" event once per mount.
 *
 * The Umami script is loaded `afterInteractive`, so on a fast first paint this
 * effect can run BEFORE `window.umami` exists. A naive `umami?.track(...)` would
 * then silently no-op and the activation would never be recorded (the pageview
 * still is, since Umami sends that itself once it loads). To avoid dropping the
 * event we poll briefly for the global, fire once it is ready, then stop.
 *
 * Mounted on the predictions page: viewing a match prediction is WCI's
 * activation signal (did the visitor actually use the app, or just bounce?).
 */
export function TrackActivation({ action }: { action: string }) {
  useEffect(() => {
    let fired = false;
    const fire = (): boolean => {
      const umami = (window as unknown as { umami?: Umami }).umami;
      if (umami?.track && !fired) {
        fired = true;
        umami.track('activation', { app: 'wci', action });
        return true;
      }
      return false;
    };
    if (fire()) return;
    // Retry for a few seconds until the async Umami script is available.
    const poll = setInterval(() => { if (fire()) clearInterval(poll); }, 300);
    const stop = setTimeout(() => clearInterval(poll), 8000);
    return () => { clearInterval(poll); clearTimeout(stop); };
  }, [action]);
  return null;
}
