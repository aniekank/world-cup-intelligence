'use client';

import { useEffect, useState } from 'react';

const OPTS: Record<string, Intl.DateTimeFormatOptions> = {
  clock: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  day: { weekday: 'long', month: 'long', day: 'numeric' },
  time: { hour: 'numeric', minute: '2-digit' },
};

/**
 * Render a fixture time in the VIEWER'S local timezone. Kickoffs come from the
 * feed as UTC ISO strings; the 2026 World Cup is in North America, so showing
 * them in UTC pushed evening games onto "tomorrow". We render a deterministic
 * UTC string on the server / first paint (so hydration matches), then swap to
 * the browser's own zone after mount.
 */
export function LocalTime({ iso, variant = 'clock' }: { iso: string; variant?: keyof typeof OPTS }) {
  const opts = OPTS[variant]!;
  const [text, setText] = useState(() => new Date(iso).toLocaleString('en-US', { ...opts, timeZone: 'UTC' }));
  useEffect(() => {
    setText(new Date(iso).toLocaleString('en-US', opts)); // viewer's local zone
  }, [iso, variant]);
  return <span suppressHydrationWarning>{text}</span>;
}
