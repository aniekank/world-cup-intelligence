'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps every page current without a manual reload. Polls a tiny no-store
 * freshness probe (`/api/live-status`, which only reads the cached snapshot — no
 * provider call), and when the server snapshot has actually changed it calls
 * `router.refresh()` to re-render the server components in place (preserving
 * scroll + client-widget state). Polls faster while a match is live, pauses
 * while the tab is hidden, and catches up immediately on refocus. Also renders
 * the "updated Ns ago" freshness pill.
 */
interface Status {
  generatedAt: string;
  tournamentId: string;
  source: string;
  isLive: boolean;
  liveCount: number;
}

const LIVE_MS = 15_000; // poll cadence while a match is in play
const IDLE_MS = 60_000; // poll cadence otherwise (catches a kickoff flipping live)

export function LiveRefresh() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The snapshot generation we've already pulled into the current page, so we
  // only re-render when the server genuinely has newer data.
  const renderedGen = useRef<string | null>(null);

  const tick = useCallback(async () => {
    let nextDelay = IDLE_MS;
    try {
      const res = await fetch('/api/live-status', { cache: 'no-store' });
      if (res.ok) {
        const s: Status = await res.json();
        setStatus(s);
        nextDelay = s.isLive ? LIVE_MS : IDLE_MS;
        if (s.tournamentId === 'live-2026') {
          if (renderedGen.current === null) {
            // First observation: the page was just server-rendered, so adopt the
            // current generation without a redundant immediate refresh.
            renderedGen.current = s.generatedAt;
          } else if (s.generatedAt !== renderedGen.current) {
            renderedGen.current = s.generatedAt;
            router.refresh(); // free: re-renders from the in-memory snapshot
          }
        }
      }
    } catch {
      // Network hiccup — keep the last status and try again next tick.
    }
    if (typeof document === 'undefined' || !document.hidden) {
      timer.current = setTimeout(tick, nextDelay);
    }
  }, [router]);

  useEffect(() => {
    void tick();
    const onVisibility = () => {
      if (timer.current) clearTimeout(timer.current);
      if (!document.hidden) void tick(); // catch up the moment the tab is refocused
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tick]);

  // Tick the relative-time label every second so "updated Ns ago" stays honest
  // between polls (a single tiny span re-render — negligible; the browser throttles
  // it while the tab is hidden anyway).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!status || status.tournamentId !== 'live-2026') return null;

  const ageMs = Math.max(0, now - new Date(status.generatedAt).getTime());
  // When live, show the ticking age — it reassures users the scores are moving.
  // When idle, nothing is changing, so a growing "updated 3h ago" reads as
  // broken even though the data is current; show a calm "Live" instead and keep
  // the precise snapshot time in the tooltip for anyone who looks.
  const title = `Live data · auto-updating · last update ${new Date(status.generatedAt).toLocaleTimeString()}`;

  return (
    <span
      title={title}
      className="hidden items-center gap-1.5 rounded-full border border-terminal-border px-2 py-1 text-[11px] sm:inline-flex"
    >
      <span
        className={
          status.isLive
            ? 'h-1.5 w-1.5 animate-pulse rounded-full bg-accent'
            : 'h-1.5 w-1.5 rounded-full bg-terminal-muted'
        }
      />
      {status.isLive ? (
        <span className="text-terminal-muted">
          <span className="font-semibold text-accent">{status.liveCount} live</span> · updated{' '}
          {relAge(ageMs)}
        </span>
      ) : (
        <span className="text-terminal-muted">Live</span>
      )}
    </span>
  );
}

function relAge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
