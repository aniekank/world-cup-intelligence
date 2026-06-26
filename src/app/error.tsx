'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Route-level error boundary. Converts an unexpected render/runtime error into a
 * recoverable UI instead of a raw "server-side exception" page — so a transient
 * data hiccup on one view never looks like the whole app is down.
 *
 * These crashes are almost always a data edge in the *current* live snapshot, so
 * a plain `reset()` (re-render against the same snapshot) just crashes again. We
 * instead watch the freshness probe and re-render the moment the snapshot
 * actually changes (new data swapped in), and also retry periodically — so the
 * view comes back on its own without the user doing anything. (WC-043)
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);

  useEffect(() => {
    let gen: string | null = null;
    let ticks = 0;
    const id = setInterval(async () => {
      ticks += 1;
      try {
        const s = await (await fetch('/api/live-status', { cache: 'no-store' })).json();
        if (gen === null) gen = s.generatedAt;
        // Recover as soon as fresh data swaps in (the usual cause clears then)…
        if (s.generatedAt !== gen) {
          setRetrying(true);
          router.refresh();
          reset();
          return;
        }
      } catch {
        /* keep trying */
      }
      // …and, as a fallback, take a periodic shot anyway in case it was a one-off.
      if (ticks % 4 === 0) {
        setRetrying(true);
        reset();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [reset, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-3xl">⚠️</div>
      <h2 className="text-xl font-semibold text-terminal-bright">Something went wrong loading this view</h2>
      <p className="max-w-md text-sm text-terminal-muted">
        {retrying ? 'Reconnecting to the live feed…' : 'Usually a transient hiccup while live data refreshes — this view will come back on its own, or retry now.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
        >
          Retry
        </button>
        <a
          href="/"
          className="rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-text hover:bg-terminal-elevated"
        >
          Back to home
        </a>
      </div>
      {error.digest && <p className="text-[11px] text-terminal-muted/60">ref: {error.digest}</p>}
    </div>
  );
}
