'use client';

import { useEffect, useState } from 'react';
import { runningMinute } from '@/lib/matchClock';

/**
 * Broadcast-style running match clock.
 *
 * The server samples the minute from the feed and re-renders this component via
 * the live auto-refresh whenever a new snapshot lands. Between those samples we
 * tick locally once a second from the snapshot's generation time, so the clock
 * looks alive instead of frozen-then-jumping. It re-anchors on every fresh
 * snapshot, freezes at the break (HALFTIME), and caps drift so a stalled refresh
 * can never run the clock away from reality.
 */
export function LiveMinute({
  minute,
  status,
  generatedAt,
}: {
  minute: number;
  status: string;
  generatedAt: string;
}) {
  const anchor = Date.parse(generatedAt);
  // Seed from the anchor so the first client render matches the server (no
  // hydration mismatch); the effect swaps in the real clock and starts ticking.
  const [now, setNow] = useState(() => (Number.isFinite(anchor) ? anchor : Date.now()));

  useEffect(() => {
    if (status !== 'LIVE') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status, generatedAt]);

  return <>{runningMinute(minute, status, anchor, now)}</>;
}
