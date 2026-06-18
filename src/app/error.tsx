'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary. Converts an unexpected render/runtime error into a
 * recoverable UI instead of a raw "server-side exception" page — so a transient
 * data hiccup on one view never looks like the whole app is down. `reset()`
 * re-renders the segment (a fresh server render), which clears transient errors.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-3xl">⚠️</div>
      <h2 className="text-xl font-semibold text-terminal-bright">Something went wrong loading this view</h2>
      <p className="max-w-md text-sm text-terminal-muted">
        Usually a transient hiccup while live data refreshes. Retry and it should come right back.
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
