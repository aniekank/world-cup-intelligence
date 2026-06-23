'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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
  loading?: boolean; // live snapshot still loading at boot (serving the placeholder sim)
}

const LIVE_MS = 15_000; // poll cadence while a match is in play
const IDLE_MS = 60_000; // poll cadence otherwise (catches a kickoff flipping live)
const BOOT_MS = 2_500; // poll cadence while the live snapshot loads at boot

export function LiveRefresh() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The snapshot generation we've already pulled into the current page, so we
  // only re-render when the server genuinely has newer data.
  const renderedGen = useRef<string | null>(null);
  // Whether the *previous* poll already saw the live edition. Starts true so a
  // normal first load (page server-rendered with live data) doesn't refresh
  // redundantly — but a boot that starts on the sim placeholder flips this to
  // false, so when live swaps in we force one refresh to replace the placeholder.
  const prevLive2026 = useRef(true);

  const tick = useCallback(async () => {
    let nextDelay = IDLE_MS;
    try {
      const res = await fetch('/api/live-status', { cache: 'no-store' });
      if (res.ok) {
        const s: Status = await res.json();
        setStatus(s);
        const isLive2026 = s.tournamentId === 'live-2026';
        if (isLive2026) {
          nextDelay = s.isLive ? LIVE_MS : IDLE_MS;
          if (!prevLive2026.current) {
            // Just swapped from the boot/sim placeholder to live → replace the
            // page's stale (simulation) content.
            renderedGen.current = s.generatedAt;
            router.refresh();
          } else if (renderedGen.current === null) {
            renderedGen.current = s.generatedAt; // adopt on first load, no refresh
          } else if (s.generatedAt !== renderedGen.current) {
            renderedGen.current = s.generatedAt;
            router.refresh(); // free: re-renders from the in-memory snapshot
          }
        } else if (s.loading) {
          nextDelay = BOOT_MS; // live snapshot still loading → poll fast until it swaps
        }
        prevLive2026.current = isLive2026;
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

  if (!status) return null;

  // Boot window: the live snapshot is still loading, so the app is serving the
  // placeholder simulation. Tell the user rather than passing it off as live.
  if (status.tournamentId !== 'live-2026') {
    if (status.loading) {
      return (
        <span
          title="Connecting to the live data feed — showing a placeholder until it loads."
          className="hidden items-center gap-1.5 rounded-full border border-terminal-border px-2 py-1 text-[11px] text-terminal-muted sm:inline-flex"
        >
          <Loader2 className="h-3 w-3 animate-spin text-accent" /> Loading live data…
        </span>
      );
    }
    return null;
  }

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
