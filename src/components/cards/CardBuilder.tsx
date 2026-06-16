'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, X, Link2, Check } from 'lucide-react';
import { Radar2 } from '@/components/charts/Recharts';
import { PlayerPortrait } from '@/components/brand/PlayerPortrait';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { cn } from '@/lib/utils';

type Mode = 'players' | 'teams';

interface PV {
  id: string; name: string; position: string;
  team: { code: string; flag: string };
  stats: Record<string, number>;
  percentiles: Record<string, number>;
}
interface TV {
  id: string; name: string; code: string; flag: string; primaryColor: string;
  elo: number; fifaRanking: number;
  forecast: { winTitle: number; reachFinal: number; reachSF: number; groupWin: number } | null;
  powerRanking: { powerRating: number; offenseRating: number; defenseRating: number; momentum: number; rank: number } | null;
}

const PLAYER_METRICS = [
  { key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' },
  { key: 'xG', label: 'xG', dec: 1 }, { key: 'xA', label: 'xA', dec: 1 },
  { key: 'shots', label: 'Shots' }, { key: 'shotsOnTarget', label: 'Shots on target' },
  { key: 'keyPasses', label: 'Key passes' }, { key: 'progressivePasses', label: 'Prog. passes' },
  { key: 'progressiveCarries', label: 'Prog. carries' }, { key: 'tackles', label: 'Tackles' },
  { key: 'interceptions', label: 'Interceptions' }, { key: 'minutes', label: 'Minutes' },
  { key: 'formIndex', label: 'Form' },
];
const TEAM_METRICS = [
  { key: 'winTitle', label: 'Win title', pct: true, dec: 1 }, { key: 'reachFinal', label: 'Reach final', pct: true },
  { key: 'reachSF', label: 'Reach SF', pct: true }, { key: 'groupWin', label: 'Win group', pct: true },
  { key: 'powerRating', label: 'Power rating' }, { key: 'offenseRating', label: 'Offense' },
  { key: 'defenseRating', label: 'Defense' }, { key: 'momentum', label: 'Momentum' },
  { key: 'elo', label: 'ELO' }, { key: 'fifaRanking', label: 'FIFA rank', lowerBetter: true },
];
const DEFAULT_PLAYER = ['goals', 'assists', 'xG', 'xA', 'keyPasses', 'formIndex'];
const DEFAULT_TEAM = ['winTitle', 'powerRating', 'offenseRating', 'defenseRating', 'elo'];
const RADAR = [
  { key: 'xG', label: 'xG' }, { key: 'xA', label: 'xA' }, { key: 'shots', label: 'Shots' },
  { key: 'keyPasses', label: 'Key passes' }, { key: 'progressivePasses', label: 'Prog. passes' }, { key: 'tackles', label: 'Tackles' },
];
const SERIES_COLORS = ['#1fe5c4', '#ff2e9a', '#a8e020', '#6d4dff'];

function teamVal(t: TV, key: string): number {
  if (t.forecast && key in t.forecast) return (t.forecast as unknown as Record<string, number>)[key] ?? 0;
  if (t.powerRanking && key in t.powerRanking) return (t.powerRanking as unknown as Record<string, number>)[key] ?? 0;
  return (t as unknown as Record<string, number>)[key] ?? 0;
}

export function CardBuilder() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || 'players');
  const [pool, setPool] = useState<(PV | TV)[]>([]);
  const [selected, setSelected] = useState<(PV | TV)[]>([]);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const initRef = useRef(false);

  // Load pool on mode change
  useEffect(() => {
    const url = mode === 'players' ? '/api/players?limit=2000&sort=goals' : '/api/teams';
    fetch(url).then((r) => r.json()).then((j) => setPool(j.data ?? []));
    setMetrics(mode === 'players' ? DEFAULT_PLAYER : DEFAULT_TEAM);
    if (initRef.current) setSelected([]);
  }, [mode]);

  // Initial selection from URL (?ids=a,b&metrics=goals,xG) once the pool loads
  useEffect(() => {
    if (initRef.current || pool.length === 0) return;
    const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
    if (ids.length) {
      const picks = ids.map((id) => pool.find((p) => p.id === id)).filter(Boolean) as (PV | TV)[];
      if (picks.length) setSelected(picks);
    }
    const m = (params.get('metrics') ?? '').split(',').filter(Boolean);
    if (m.length) setMetrics(m);
    initRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return pool.filter((p) => p.name.toLowerCase().includes(q) && !selected.find((s) => s.id === p.id)).slice(0, 6);
  }, [query, pool, selected]);

  const metricDefs = mode === 'players' ? PLAYER_METRICS : TEAM_METRICS;
  const add = (e: PV | TV) => { if (selected.length < 4) setSelected((s) => [...s, e]); setQuery(''); };
  const remove = (id: string) => setSelected((s) => s.filter((x) => x.id !== id));
  const toggleMetric = (k: string) => setMetrics((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));

  const value = (e: PV | TV, key: string): number =>
    mode === 'players' ? ((e as PV).stats[key] ?? 0) : teamVal(e as TV, key);
  const fmt = (v: number, def?: { pct?: boolean; dec?: number }) =>
    def?.pct ? `${(v * 100).toFixed(def.dec ?? 0)}%` : Number.isInteger(v) ? String(v) : v.toFixed(def?.dec ?? 1);

  const copyLink = () => {
    const u = new URL(window.location.href);
    u.searchParams.set('mode', mode);
    u.searchParams.set('ids', selected.map((s) => s.id).join(','));
    u.searchParams.set('metrics', metrics.join(','));
    navigator.clipboard?.writeText(u.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-terminal-border bg-terminal-panel p-1">
          {(['players', 'teams'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn('rounded px-3 py-1.5 text-xs font-medium capitalize', mode === m ? 'bg-accent/15 text-accent' : 'text-terminal-muted hover:text-terminal-bright')}>
              {m}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Add ${mode} to compare (up to 4)…`} disabled={selected.length >= 4}
            className="w-full rounded-md border border-terminal-border bg-terminal-panel px-3 py-2 text-sm text-terminal-bright placeholder:text-terminal-muted focus:border-accent focus:outline-none disabled:opacity-50" />
          {suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-terminal-border bg-terminal-elevated shadow-glow">
              {suggestions.map((s) => (
                <button key={s.id} onClick={() => add(s)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-terminal-panel">
                  <span>{mode === 'players' ? (s as PV).team.flag : (s as TV).flag}</span>
                  <span className="text-terminal-bright">{s.name}</span>
                  <span className="ml-auto text-xs text-terminal-muted">{mode === 'players' ? (s as PV).team.code : (s as TV).code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected.length >= 2 && (
          <button onClick={copyLink} className="flex items-center gap-1.5 rounded-md border border-terminal-border bg-terminal-panel px-3 py-2 text-xs text-accent hover:border-accent/40">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Share'}
          </button>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="rounded-xl border border-dashed border-terminal-border px-6 py-12 text-center text-sm text-terminal-muted">
          Search above to add {mode} and build a comparison card.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Comparison card */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel">
              {/* Headers */}
              <div className="grid border-b border-terminal-border" style={{ gridTemplateColumns: `minmax(120px,1.4fr) repeat(${selected.length}, 1fr)` }}>
                <div className="p-3 text-[11px] font-semibold uppercase text-terminal-muted">Metric</div>
                {selected.map((e) => (
                  <div key={e.id} className="relative border-l border-terminal-border p-3 text-center">
                    <button onClick={() => remove(e.id)} className="absolute right-1 top-1 text-terminal-muted hover:text-accent-red"><X className="h-3.5 w-3.5" /></button>
                    <div className="flex flex-col items-center gap-1">
                      {mode === 'players' ? (
                        <PlayerPortrait id={e.id} name={e.name} size={40} rounded="full" />
                      ) : (
                        <TeamCrest code={(e as TV).code} color={(e as TV).primaryColor} size={36} />
                      )}
                      <Link href={`/${mode === 'players' ? 'players' : 'teams'}/${e.id}`} className="line-clamp-2 text-xs font-semibold text-terminal-bright hover:text-accent">{e.name}</Link>
                    </div>
                  </div>
                ))}
              </div>
              {/* Rows */}
              {metrics.map((mk) => {
                const def = metricDefs.find((d) => d.key === mk);
                if (!def) return null;
                const vals = selected.map((e) => value(e, mk));
                const lowerBetter = 'lowerBetter' in def && def.lowerBetter;
                const best = lowerBetter ? Math.min(...vals) : Math.max(...vals);
                const max = Math.max(...vals.map((v) => Math.abs(v))) || 1;
                return (
                  <div key={mk} className="grid items-center border-t border-terminal-border/50" style={{ gridTemplateColumns: `minmax(120px,1.4fr) repeat(${selected.length}, 1fr)` }}>
                    <div className="px-3 py-2 text-sm text-terminal-muted">{def.label}</div>
                    {selected.map((e, i) => {
                      const v = vals[i]!;
                      const isBest = v === best && vals.filter((x) => x === best).length < selected.length;
                      return (
                        <div key={e.id} className="border-l border-terminal-border/50 px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <span className="h-1 rounded-full" style={{ width: `${(Math.abs(v) / max) * 40}px`, backgroundColor: isBest ? '#1fe5c4' : '#3a2a55' }} />
                            <span className={cn('tnum text-sm', isBest ? 'font-bold text-accent' : 'text-terminal-text')}>
                              {fmt(v, def as { pct?: boolean; dec?: number })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Radar for 2 players */}
            {mode === 'players' && selected.length >= 2 && (
              <div className="mt-5 rounded-xl border border-terminal-border bg-terminal-panel p-4">
                <p className="mb-2 text-sm font-semibold text-terminal-bright">Percentile profile <span className="font-normal text-terminal-muted">· vs positional peers</span></p>
                <Radar2
                  metrics={RADAR.map((r) => r.label)}
                  seriesA={{ name: (selected[0] as PV).name.split(' ').slice(-1)[0]!, values: RADAR.map((r) => (selected[0] as PV).percentiles[r.key] ?? 0), color: SERIES_COLORS[0] }}
                  seriesB={selected[1] ? { name: (selected[1] as PV).name.split(' ').slice(-1)[0]!, values: RADAR.map((r) => (selected[1] as PV).percentiles[r.key] ?? 0), color: SERIES_COLORS[1] } : undefined}
                />
              </div>
            )}
          </div>

          {/* Metric picker */}
          <div className="rounded-xl border border-terminal-border bg-terminal-panel p-4">
            <p className="mb-3 text-sm font-semibold text-terminal-bright">Metrics</p>
            <div className="flex flex-wrap gap-1.5">
              {metricDefs.map((d) => (
                <button key={d.key} onClick={() => toggleMetric(d.key)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs', metrics.includes(d.key) ? 'border-accent/40 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:text-terminal-bright')}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
