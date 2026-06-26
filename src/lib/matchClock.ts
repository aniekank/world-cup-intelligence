/**
 * Displayed match clock for the live ticker and scoreboard.
 *
 * The feed only *samples* the minute (and our snapshot re-renders on the live
 * auto-refresh). Between samples we advance the minute locally from the
 * snapshot's generation time, so the clock looks alive instead of frozen then
 * jumping. Drift is capped at +5 so a stalled refresh can never run the clock
 * away from the last real reading; the break freezes at "HT"; anything not in
 * play shows the static sampled minute. (WC-039)
 */
export function runningMinute(minute: number, status: string, anchorMs: number, nowMs: number): string {
  if (status === 'HALFTIME') return 'HT';
  if (status !== 'LIVE' || !Number.isFinite(anchorMs)) return `${minute}′`;
  const elapsed = Math.max(0, Math.floor((nowMs - anchorMs) / 60_000));
  return `${minute + Math.min(elapsed, 5)}′`;
}
