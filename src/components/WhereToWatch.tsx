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

type Station = MatchTvCountry['stations'][number];
interface NetGroup { key: string; label: string; logo: string; url: string; channels: Station[] }

// Collapse a country's channels into network families (FOX Network / FS1 / FS2 /
// FOX Deportes → one "Fox" group) so the panel reads as "which networks carry
// it", not "this game is on all of them" at once. (TV-1)
function familyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/[\s0-9]/).filter(Boolean)[0] ?? name.toLowerCase();
}
function groupByNetwork(stations: Station[]): NetGroup[] {
  const m = new Map<string, NetGroup>();
  for (const s of stations) {
    const key = familyKey(s.name);
    const g = m.get(key);
    if (g) { g.channels.push(s); if (!g.logo && s.logo) g.logo = s.logo; if (!g.url && s.url) g.url = s.url; }
    else m.set(key, { key, label: key.charAt(0).toUpperCase() + key.slice(1), logo: s.logo, url: s.url, channels: [s] });
  }
  return [...m.values()]
    .map((g) => (g.channels.length === 1 ? { ...g, label: g.channels[0]!.name } : g))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function WhereToWatch({ listings }: { listings: MatchTvCountry[] }) {
  const [code, setCode] = useState(() => detectCountry(listings));
  if (!listings.length) return null;
  const selected = listings.find((l) => l.code === code) ?? listings[0]!;
  const groups = groupByNetwork(selected.stations);

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
        Broadcasters in {selected.flag} {selected.country}
      </div>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const inner = (
            <>
              {g.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.logo} alt="" width={18} height={18} className="mt-0.5 shrink-0 rounded-sm bg-white/90 object-contain" />
              ) : null}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="font-medium text-terminal-bright">{g.label}</span>
                {g.channels.length > 1 && (
                  <span className="text-[11px] text-terminal-muted">{g.channels.map((c) => c.name).join(' · ')}</span>
                )}
              </span>
            </>
          );
          return g.url ? (
            <a
              key={g.key}
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright hover:border-accent/40"
            >
              {inner}
            </a>
          ) : (
            <span
              key={g.key}
              className="flex items-start gap-2 rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright"
            >
              {inner}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-terminal-muted">
        Networks that carry the World Cup in this country — for a specific match the exact channel is confirmed closer to kickoff.
      </p>
    </div>
  );
}
