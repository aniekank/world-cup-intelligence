'use client';

import { useMemo, useState } from 'react';
import { bivariatePoissonGrid, shapleyContributions } from '@/lib/labMath';
import type { LabMatch } from '@/server/lab';

const LEAGUE_AVG = 1.35;
const NEUTRAL = 75;

/**
 * Decompose P(home win) into the model's drivers via exact Shapley values.
 * Each factor toggles one input between its real value and a neutral baseline;
 * the value function is the bivariate-Poisson home-win probability. Contributions
 * sum exactly to (model prob − neutral baseline).
 */
function explain(m: LabMatch) {
  const f = {
    home: 'Home-field advantage',
    homeAtk: `${m.home.code} attack`,
    awayDef: `${m.away.code} defense`,
    awayAtk: `${m.away.code} attack`,
    homeDef: `${m.home.code} defense`,
  } as const;
  const keys = Object.keys(f);
  const v = (S: Set<string>) => {
    const homeAtk = S.has('homeAtk') ? m.home.attack : NEUTRAL;
    const awayDef = S.has('awayDef') ? m.away.defense : NEUTRAL;
    const awayAtk = S.has('awayAtk') ? m.away.attack : NEUTRAL;
    const homeDef = S.has('homeDef') ? m.home.defense : NEUTRAL;
    const hm = S.has('home') ? 1.12 : 1.0;
    const am = S.has('home') ? 0.94 : 1.0;
    const lh = Math.max(0.18, LEAGUE_AVG * (homeAtk / 75) * (2 - awayDef / 75) * hm);
    const la = Math.max(0.18, LEAGUE_AVG * (awayAtk / 75) * (2 - homeDef / 75) * am);
    return bivariatePoissonGrid(lh, la).homeWin;
  };
  const base = v(new Set());
  const final = v(new Set(keys));
  const contribs = shapleyContributions(keys, v);
  const steps = keys
    .map((k) => ({ key: k, label: f[k as keyof typeof f], delta: contribs[k]! }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { base, final, steps };
}

const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;

export function PredictionExplainer({ matches }: { matches: LabMatch[] }) {
  const [id, setId] = useState(matches[0]?.id ?? '');
  const m = matches.find((x) => x.id === id) ?? matches[0];
  const model = useMemo(() => (m ? explain(m) : null), [m]);
  if (!m || !model) return null;

  const axisMax = Math.max(0.6, model.final, model.base, ...cumulatives(model));
  const scale = (p: number) => (p / axisMax) * 100;
  let cum = model.base;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-terminal-muted">Match</label>
          <select value={id} onChange={(e) => setId(e.target.value)}
            className="w-full rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright outline-none hover:border-accent/40 focus:border-accent/60">
            {matches.map((x) => <option key={x.id} value={x.id}>{x.home.code} v {x.away.code}</option>)}
          </select>
        </div>
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/40 p-4 text-center">
          <div className="text-sm text-terminal-muted">{m.home.flag} {m.home.name} to beat {m.away.name}</div>
          <div className="tnum mt-1 text-4xl font-extrabold text-accent">{fmt(model.final)}</div>
          <div className="mt-1 text-[11px] text-terminal-muted">from a {fmt(model.base)} neutral baseline</div>
        </div>
        <p className="rounded-lg border border-terminal-border bg-terminal-panel/30 p-3 text-[11px] leading-relaxed text-terminal-muted">
          Each bar is a factor&rsquo;s exact <span className="text-terminal-bright">Shapley contribution</span> to the home-win probability — its average marginal effect over every ordering of the inputs. Green pushes the home win up, red pulls it down. They sum to the model output.
        </p>
      </div>

      {/* Waterfall */}
      <div className="space-y-2">
        <WaterRow label="Neutral baseline" left={0} width={scale(model.base)} color="#4b4b5e" value={fmt(model.base)} bold />
        {model.steps.map((s) => {
          const start = cum;
          cum += s.delta;
          const lo = Math.min(start, cum), hi = Math.max(start, cum);
          const up = s.delta >= 0;
          return (
            <WaterRow key={s.key} label={s.label} left={scale(lo)} width={Math.max(0.6, scale(hi - lo))}
              color={up ? '#22e0d0' : '#ff2e9a'} value={`${up ? '+' : ''}${(s.delta * 100).toFixed(1)}`} />
          );
        })}
        <WaterRow label="Model P(home win)" left={0} width={scale(model.final)} color={m.home.color} value={fmt(model.final)} bold />
      </div>
    </div>
  );
}

function cumulatives(model: { base: number; steps: { delta: number }[] }): number[] {
  const out: number[] = []; let c = model.base;
  for (const s of model.steps) { c += s.delta; out.push(c); }
  return out;
}

function WaterRow({ label, left, width, color, value, bold }: { label: string; left: number; width: number; color: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-32 shrink-0 truncate text-xs ${bold ? 'font-semibold text-terminal-bright' : 'text-terminal-muted'}`}>{label}</span>
      <div className="relative h-6 flex-1 rounded bg-terminal-panel/40">
        <div className="absolute inset-y-0 rounded transition-all duration-300" style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: bold ? 0.9 : 0.8 }} />
      </div>
      <span className="tnum w-14 shrink-0 text-right text-xs font-semibold text-terminal-bright">{value}</span>
    </div>
  );
}
