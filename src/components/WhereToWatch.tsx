'use client';

import { useState } from 'react';
import type { MatchTvCountry } from '@/domain/types';

/**
 * "Where to watch" — international broadcast listings for a fixture, grouped by
 * country. Defaults to the viewer's country (from locale), with a selector to
 * browse the rest. Data is SportMonks broadcast-rights data (live source only).
 */

function detectCountry(listings: MatchTvCountry[]): string {
  if (typeof navigator !== 'undefined') {
    const langs = [navigator.language, ...(navigator.languages ?? [])];
    for (const l of langs) {
      const code = /[-_]([A-Za-z]{2})$/.exec(l || '')?.[1]?.toUpperCase();
      if (code && listings.some((x) => x.code === code)) return code;
    }
  }
  // Fall back to the host nations / big markets, then whatever's first.
  for (const c of ['US', 'CA', 'MX', 'GB']) if (listings.some((x) => x.code === c)) return c;
  return listings[0]?.code ?? '';
}

export function WhereToWatch({ listings }: { listings: MatchTvCountry[] }) {
  const [code, setCode] = useState(() => detectCountry(listings));
  if (!listings.length) return null;
  const selected = listings.find((l) => l.code === code) ?? listings[0]!;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-terminal-muted">
          Broadcast in {listings.length} {listings.length === 1 ? 'country' : 'countries'}
        </span>
        <select
          value={selected.code}
          onChange={(e) => setCode(e.target.value)}
          className="max-w-[60%] rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-1.5 text-sm text-terminal-bright outline-none hover:border-accent/40 focus:border-accent/60"
          aria-label="Choose a country"
        >
          {listings.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.country}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-2 text-sm font-semibold text-terminal-bright">
        {selected.flag} {selected.country}
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.stations.map((s) => {
          const inner = (
            <>
              {s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo} alt="" width={18} height={18} className="rounded-sm bg-white/90 object-contain" />
              ) : null}
              <span>{s.name}</span>
            </>
          );
          return s.url ? (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright hover:border-accent/40"
            >
              {inner}
            </a>
          ) : (
            <span
              key={s.name}
              className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright"
            >
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}
