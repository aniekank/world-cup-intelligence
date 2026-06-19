'use client';

import { useEffect } from 'react';

/**
 * Fires a single "activation" event once per mount via the Umami global (if the
 * analytics script loaded). Optional chaining means it is a safe no-op when
 * analytics is unconfigured or still loading, so it can never break a page.
 *
 * Mounted on the predictions page: viewing a match prediction is WCI's
 * activation signal (did the visitor actually use the app, or just bounce?).
 */
export function TrackActivation({ action }: { action: string }) {
  useEffect(() => {
    (window as unknown as { umami?: { track: (e: string, d?: Record<string, unknown>) => void } })
      .umami?.track('activation', { app: 'wci', action });
  }, [action]);
  return null;
}
