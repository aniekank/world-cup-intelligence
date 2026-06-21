'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LabTeam } from '@/server/lab';

interface StageProbs { reachR32: number; reachR16: number; reachQF: number; reachSF: number; reachFinal: number; winTitle: number; expectedFinish: number }
interface SimResponse {
  teamId: string;
  applied: { attack: number; defense: number; elo: number };
  before: StageProbs | null;
  after: StageProbs | null;
  leaderboard: { id: string; name: string; code: string; flag: string; color: string; winTitle: number; baseWinTitle: number }[];
  runs: number;
}

const STAGES: { key: keyof StageProbs; label: string }[] = [
  { key: 'reachR32', label: 'Round of 32' },
  { key: 'reachR16', label: 'Round of 16' },
  { key: 'reachQF', label: 'Quarter-final' },
  { key: 'reachSF', label: 'Semi-final' },
  { key: 'reachFinal', label: 'Final' },
  { key: 'winTitle', label: 'Champions' },
];
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function Slider({ label, value, base, min, max, step, onChange }: {
  label: string; value: number; base: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const delta = value - base;
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-terminal-muted">{label}</span>
        <span className="tnum font-semibold text-terminal-bright">
          {Math.round(value)}
          {Math.abs(delta) >= 1 && <span className={delta > 0 ? 'ml-1 text-accent' : 'ml-1 text-accent-red'}>{delta > 0 ? '+' : ''}{Math.round(delta)}</span>}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="lab-range w-full" />
    </label>
  );
}

export function MonteCarloSimulator({ teams, defaultTeamId }: { teams: LabTeam[]; defaultTeamId: string }) {
  const initial = teams.find((t) => t.id === defaultTeamId) ?? teams[0];
  const [teamId, setTeamId] = useState(initial?.id ?? '');
  const team = teams.find((t) => t.id === teamId) ?? initial;
  const [attack, setAttack] = useState(initial?.attack ?? 75);
  const [defense, setDefense] = useState(initial?.defense ?? 75);
  const [elo, setElo] = useState(initial?.elo ?? 1700);
  const [data, setData] = useState<SimResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const run = useCallback(async (id: string, a: number, d: number, e: number) => {
    const my = ++reqId.current;
    setBusy(true);
    try {
      const r = await fetch('/api/lab/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: id, attack: a, defense: d, elo: e }) });
      const j: SimResponse = await r.json();
      if (my === reqId.current) setData(j);
    } catch { /* keep last good */ }
    finally { if (my === reqId.current) setBusy(false); }
  }, []);

  // Debounced re-sim whenever the inputs change.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(teamId, attack, defense, elo), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [teamId, attack, defense, elo, run]);

  const onTeam = (id: string) => {
    const t = teams.find((x) => x.id === id);
    if (!t) return;
    setTeamId(id); setAttack(t.attack); setDefense(t.defense); setElo(t.elo);
  };
  const reset = () => { if (team) { setAttack(team.attack); setDefense(team.defense); setElo(team.elo); } };
  const dirty = team ? (attack !== team.attack || defense !== team.defense || elo !== team.elo) : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Controls */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-terminal-muted">Team</label>
          <select value={teamId} onChange={(e) => onTeam(e.target.value)}
            className="w-full rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright outline-none hover:border-accent/40 focus:border-accent/60">
            {teams.map((t) => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
          </select>
        </div>
        <Slider label="Attack rating" value={attack} base={team?.attack ?? 75} min={40} max={99} step={1} onChange={setAttack} />
        <Slider label="Defense rating" value={defense} base={team?.defense ?? 75} min={40} max={99} step={1} onChange={setDefense} />
        <Slider label="ELO strength" value={elo} base={team?.elo ?? 1700} min={1400} max={2100} step={5} onChange={setElo} />
        <div className="flex items-center gap-2">
          <button onClick={reset} disabled={!dirty}
            className="rounded-lg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text transition enabled:hover:border-accent/40 disabled:opacity-40">
            Reset to actual
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-terminal-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-pulse bg-accent' : 'bg-terminal-border'}`} />
            {busy ? 'Simulating 3,000 runs…' : `${data?.runs?.toLocaleString() ?? '3,000'} runs`}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
            {team?.flag} {team?.name} — survival path {dirty && <span className="text-accent">(what-if)</span>}
          </p>
          <div className="space-y-2">
            {STAGES.map((s) => {
              const after = data?.after?.[s.key] ?? 0;
              const before = data?.before?.[s.key] ?? 0;
              const d = after - before;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-terminal-muted">{s.label}</span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-terminal-panel/60">
                    {/* baseline ghost */}
                    <div className="absolute inset-y-0 left-0 rounded bg-terminal-border/70" style={{ width: `${before * 100}%` }} />
                    {/* after */}
                    <div className="absolute inset-y-0 left-0 rounded transition-[width] duration-500"
                      style={{ width: `${after * 100}%`, background: team?.color ?? '#22e0d0', opacity: 0.85 }} />
                  </div>
                  <span className="tnum w-14 shrink-0 text-right text-xs font-semibold text-terminal-bright">{pct(after)}</span>
                  <span className={`tnum w-12 shrink-0 text-right text-[11px] ${Math.abs(d) < 0.005 ? 'text-terminal-muted' : d > 0 ? 'text-accent' : 'text-accent-red'}`}>
                    {Math.abs(d) < 0.005 ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">Title-odds leaderboard</p>
          <div className="space-y-1.5">
            {(data?.leaderboard ?? []).map((t, i) => {
              const d = t.winTitle - t.baseWinTitle;
              return (
                <div key={t.id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${t.id === teamId ? 'bg-accent/[0.07] ring-1 ring-accent/30' : ''}`}>
                  <span className="tnum w-5 text-xs font-bold text-terminal-muted">{i + 1}</span>
                  <span className="text-base">{t.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-terminal-bright">{t.name}</span>
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-terminal-panel/60 sm:block">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.winTitle * 100 * 2.2)}%`, background: t.color }} />
                  </div>
                  <span className="tnum w-12 text-right text-sm font-semibold text-terminal-bright">{pct(t.winTitle)}</span>
                  <span className={`tnum w-12 text-right text-[11px] ${Math.abs(d) < 0.005 ? 'text-terminal-muted' : d > 0 ? 'text-accent' : 'text-accent-red'}`}>
                    {Math.abs(d) < 0.005 ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}`}
                  </span>
                </div>
              );
            })}
            {!data && <p className="py-6 text-center text-sm text-terminal-muted">Running the first simulation…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
