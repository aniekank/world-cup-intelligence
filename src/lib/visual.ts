/**
 * Deterministic visual helpers for procedural graphics (crests, portraits).
 * Everything keys off a stable hash of the entity id so a team/player always
 * renders the same generated artwork.
 */

export const PALETTE = {
  teal: '#1fe5c4',
  magenta: '#ff2e9a',
  purple: '#9d3df0',
  indigo: '#6d4dff',
  lime: '#a8e020',
  orange: '#ff8a1e',
  cyan: '#22e0d0',
} as const;

const ACCENTS = [PALETTE.magenta, PALETTE.purple, PALETTE.indigo, PALETTE.orange, PALETTE.cyan, PALETTE.teal];

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic vivid background hue from the cover palette. */
export function accentFor(id: string): string {
  return ACCENTS[hashStr(id) % ACCENTS.length] as string;
}

/** Two-letter initials from a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

/** Lighten a hex color toward white by t (0..1). */
export function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1)}`;
}

/** Darken a hex color toward black by t (0..1). */
export function darken(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c * (1 - t));
  return `#${((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1)}`;
}
