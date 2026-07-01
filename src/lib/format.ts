/** Display formatting helpers used across the UI. */

export const pct = (v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`;

export const num = (v: number, digits = 2): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(digits);

export const signed = (v: number): string => (v > 0 ? `+${v}` : `${v}`);

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
};

export const money = (millions: number): string =>
  millions >= 1000 ? `€${(millions / 1000).toFixed(1)}bn` : `€${millions}m`;

export const clock = (iso: string): string =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });

export const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

export const stageName: Record<string, string> = {
  GROUP: 'Group Stage',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  FINAL: 'Final',
  THIRD_PLACE: 'Third-place Play-off',
};

/** Knockout ties can't end level — a 90' draw goes to extra time + penalties and
 * one side advances. Fold the model's draw probability into each team's chance to
 * ADVANCE, split by their normal-time win ratio (the stronger side is likelier to
 * win over ET + pens; 50/50 on a dead heat). Sums to 1. Group games keep W/D/L. */
export const advanceProbabilities = (p: { homeWin: number; draw: number; awayWin: number }): { home: number; away: number } => {
  const decisive = p.homeWin + p.awayWin;
  const homeShare = decisive > 0 ? p.homeWin / decisive : 0.5;
  return { home: p.homeWin + p.draw * homeShare, away: p.awayWin + p.draw * (1 - homeShare) };
};

/** Map a 0..100 metric to a color along the artwork ramp: teal→lime→orange→pink. */
export const ratingColor = (v: number): string => {
  if (v >= 75) return '#1fe5c4'; // teal
  if (v >= 55) return '#a8e020'; // lime
  if (v >= 40) return '#ff8a1e'; // orange
  if (v >= 25) return '#ff6a1e'; // deep orange
  return '#ff2e6e'; // hot pink-red
};

export const formColor: Record<string, string> = {
  W: '#1fe5c4',
  D: '#ff8a1e',
  L: '#ff2e6e',
};
