'use client';

import { cn } from '@/lib/utils';

/** Shared confederation chips used by the regional leaderboard lenses. */
export const REGION_CHIPS = [
  { key: '', label: 'All', emoji: '🌐' },
  { key: 'UEFA', label: 'Europe', emoji: '🇪🇺' },
  { key: 'CONMEBOL', label: 'S. America', emoji: '🌎' },
  { key: 'CAF', label: 'Africa', emoji: '🌍' },
  { key: 'AFC', label: 'Asia', emoji: '🌏' },
  { key: 'CONCACAF', label: 'N. America', emoji: '🗺️' },
  { key: 'OFC', label: 'Oceania', emoji: '🌊' },
];

export function RegionFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {REGION_CHIPS.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs transition',
            value === r.key ? 'border-accent/50 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40',
          )}
        >
          <span className="mr-1">{r.emoji}</span>
          {r.label}
        </button>
      ))}
    </div>
  );
}
