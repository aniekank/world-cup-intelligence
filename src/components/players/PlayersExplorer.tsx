'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayerChip } from '@/components/brand/PlayerPortrait';
import { cn } from '@/lib/utils';

interface PV {
  id: string;
  name: string;
  position: string;
  age: number;
  marketValueEur: number;
  team: { code: string; flag: string };
  confederation: string | null;
  stats: Record<string, number>;
  per90: Record<string, number>;
}

const POSITIONS = [
  { key: '', label: 'All' },
  { key: 'GK', label: 'Keepers' },
  { key: 'DF', label: 'Defenders' },
  { key: 'MF', label: 'Midfielders' },
  { key: 'FW', label: 'Forwards' },
];

const REGIONS = [
  { key: '', label: 'All regions' },
  { key: 'UEFA', label: '🇪🇺 Europe' },
  { key: 'CONMEBOL', label: '🌎 South America' },
  { key: 'CAF', label: '🌍 Africa' },
  { key: 'AFC', label: '🌏 Asia' },
  { key: 'CONCACAF', label: '🗺️ N. & C. America' },
  { key: 'OFC', label: '🌊 Oceania' },
];

const SORTS = [
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'xG', label: 'xG' },
  { key: 'xA', label: 'xA' },
  { key: 'shots', label: 'Shots' },
  { key: 'keyPasses', label: 'Key passes' },
  { key: 'progressivePasses', label: 'Prog. passes' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'minutes', label: 'Minutes' },
];

export function PlayersExplorer() {
  const [position, setPosition] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('goals');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PV[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(80);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort, limit: '2000' });
    if (position) params.set('position', position);
    fetch(`/api/players?${params}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .finally(() => setLoading(false));
  }, [position, sort]);

  // Reset the visible window whenever the filters change
  useEffect(() => setVisible(80), [position, region, sort, query]);

  const filtered = (data ?? []).filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) && (!region || p.confederation === region),
  );
  const shown = filtered.slice(0, visible);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-terminal-border bg-terminal-panel p-1">
          {POSITIONS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPosition(p.key)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                position === p.key ? 'bg-accent/15 text-accent' : 'text-terminal-muted hover:text-terminal-bright',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-md border border-terminal-border bg-terminal-panel px-3 py-2 text-xs text-terminal-bright focus:border-accent focus:outline-none"
        >
          {REGIONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.key ? r.label : 'Region: All'}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-md border border-terminal-border bg-terminal-panel px-3 py-2 text-xs text-terminal-bright focus:border-accent focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          className="flex-1 rounded-md border border-terminal-border bg-terminal-panel px-3 py-2 text-xs text-terminal-bright placeholder:text-terminal-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-terminal-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-terminal-panel text-[11px] uppercase tracking-wide text-terminal-muted">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-left">Pos</th>
              <th className="px-3 py-2 text-right">Age</th>
              <th className="px-3 py-2 text-right">Min</th>
              <th className="px-3 py-2 text-right">G</th>
              <th className="px-3 py-2 text-right">A</th>
              <th className="px-3 py-2 text-right">xG</th>
              <th className="px-3 py-2 text-right">xA</th>
              <th className="px-3 py-2 text-right">Form</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-terminal-muted">
                  Loading players…
                </td>
              </tr>
            )}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-terminal-muted">
                  No players match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              shown.map((p, i) => (
                <tr key={p.id} className="border-t border-terminal-border/60 hover:bg-terminal-elevated">
                  <td className="px-3 py-2 tnum text-terminal-muted">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/players/${p.id}`} className="flex items-center gap-2 hover:text-accent">
                      <PlayerChip id={p.id} name={p.name} size={26} />
                      <span className="font-medium text-terminal-bright">{p.name}</span>
                      <span className="text-xs text-terminal-muted">
                        {p.team.flag} {p.team.code}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-terminal-muted">{p.position}</td>
                  <td className="px-3 py-2 text-right tnum">{p.age}</td>
                  <td className="px-3 py-2 text-right tnum text-terminal-muted">{p.stats.minutes}</td>
                  <td className="px-3 py-2 text-right tnum font-semibold text-terminal-bright">{p.stats.goals}</td>
                  <td className="px-3 py-2 text-right tnum">{p.stats.assists}</td>
                  <td className="px-3 py-2 text-right tnum text-accent-cyan">{(p.stats.xG ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tnum text-accent-violet">{(p.stats.xA ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tnum">{p.stats.formIndex}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div className="flex items-center justify-between text-xs text-terminal-muted">
          <span>
            Showing <span className="tnum text-terminal-bright">{shown.length}</span> of{' '}
            <span className="tnum text-terminal-bright">{filtered.length}</span> players
          </span>
          {filtered.length > visible && (
            <button
              onClick={() => setVisible((v) => v + 120)}
              className="rounded-md border border-terminal-border bg-terminal-panel px-3 py-1.5 font-medium text-accent hover:border-accent/40"
            >
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
