'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { bivariatePoissonGrid, sampleBivariatePoisson, lcg } from '@/lib/labMath';
import type { LabMatch } from '@/server/lab';

const LEAGUE_AVG = 1.35;
function lambdaFor(attack: number, oppDefense: number, isHome: boolean): number {
  return Math.max(0.18, LEAGUE_AVG * (attack / 75) * (2 - oppDefense / 75) * (isHome ? 1.12 : 0.94));
}
const MAX_RUNS = 2500;
const BATCH = 20;
const W = 620, H = 300, PADL = 38, PADB = 26, PADT = 12, PADR = 96;
const pctTxt = (v: number) => `${(v * 100).toFixed(1)}%`;

export function MonteCarloConvergence({ matches }: { matches: LabMatch[] }) {
  const presets = matches.slice(0, 6);
  const [mid, setMid] = useState(presets[0]?.id ?? '');
  const match = presets.find((m) => m.id === mid) ?? presets[0];
  const [running, setRunning] = useState(true);
  const [hist, setHist] = useState<{ n: number; h: number; d: number; a: number }[]>([]);
  const state = useRef({ n: 0, h: 0, d: 0, a: 0, rng: lcg(12345) });

  const lh = match ? lambdaFor(match.home.attack, match.away.defense, true) : 1.4;
  const la = match ? lambdaFor(match.away.attack, match.home.defense, false) : 1.1;
  const truth = useMemo(() => bivariatePoissonGrid(lh, la), [lh, la]);

  // Reset whenever the match changes.
  useEffect(() => {
    state.current = { n: 0, h: 0, d: 0, a: 0, rng: lcg(12345) };
    setHist([]);
    setRunning(true);
  }, [mid]);

  // Animation loop — draw BATCH samples per tick until MAX_RUNS.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const s = state.current;
      if (s.n >= MAX_RUNS) { setRunning(false); return; }
      for (let i = 0; i < BATCH; i++) {
        const r = sampleBivariatePoisson(s.rng, lh, la);
        if (r.home > r.away) s.h++; else if (r.home === r.away) s.d++; else s.a++;
        s.n++;
      }
      setHist((prev) => [...prev, { n: s.n, h: s.h / s.n, d: s.d / s.n, a: s.a / s.n }]);
    }, 28);
    return () => window.clearInterval(id);
  }, [running, lh, la]);

  const restart = () => { state.current = { n: 0, h: 0, d: 0, a: 0, rng: lcg(12345) }; setHist([]); setRunning(true); };

  const cur = hist[hist.length - 1] ?? { n: 0, h: 0, d: 0, a: 0 };
  const yMax = Math.min(1, Math.max(0.6, truth.homeWin, truth.draw, truth.awayWin) + 0.12);
  const sx = (n: number) => PADL + (n / MAX_RUNS) * (W - PADL - PADR);
  const sy = (p: number) => PADT + (1 - p / yMax) * (H - PADT - PADB);
  const line = (key: 'h' | 'd' | 'a') => hist.map((pt) => `${sx(pt.n)},${sy(pt[key])}`).join(' ');
  const se = cur.n > 0 ? Math.sqrt((truth.homeWin * (1 - truth.homeWin)) / cur.n) : 0; // standard error of the home estimate
  const series = [
    { key: 'h' as const, label: `${match?.home.code ?? 'Home'} win`, color: '#22e0d0', truth: truth.homeWin, est: cur.h },
    { key: 'd' as const, label: 'Draw', color: '#8b8b9e', truth: truth.draw, est: cur.d },
    { key: 'a' as const, label: `${match?.away.code ?? 'Away'} win`, color: '#ff2e9a', truth: truth.awayWin, est: cur.a },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {presets.map((m) => (
            <button key={m.id} onClick={() => setMid(m.id)}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${mid === m.id ? 'border-accent/60 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40'}`}>
              {m.home.code} v {m.away.code}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/30 p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {[0, 0.25, 0.5, 0.75].filter((g) => g <= yMax).map((g) => (
              <g key={g}>
                <line x1={PADL} y1={sy(g)} x2={W - PADR} y2={sy(g)} stroke="rgba(255,255,255,0.05)" />
                <text x={PADL - 5} y={sy(g) + 3} textAnchor="end" className="fill-terminal-muted" style={{ fontSize: 9 }}>{Math.round(g * 100)}</text>
              </g>
            ))}
            {/* analytic truth lines + standard-error band on the home estimate */}
            {cur.n > 0 && <rect x={PADL} y={sy(truth.homeWin + 2 * se)} width={W - PADL - PADR} height={Math.max(0, sy(truth.homeWin - 2 * se) - sy(truth.homeWin + 2 * se))} fill="#22e0d0" opacity={0.08} />}
            {series.map((s) => (
              <g key={s.key}>
                <line x1={PADL} y1={sy(s.truth)} x2={W - PADR} y2={sy(s.truth)} stroke={s.color} strokeOpacity={0.5} strokeDasharray="4 3" />
                {hist.length > 1 && <polyline fill="none" stroke={s.color} strokeWidth={1.6} points={line(s.key)} />}
                <text x={W - PADR + 6} y={sy(s.est || s.truth) + 3} className="fill-terminal-bright" style={{ fontSize: 10, fontWeight: 600 }}>{pctTxt(s.est || 0)}</text>
              </g>
            ))}
            <text x={(W - PADR + PADL) / 2} y={H - 6} textAnchor="middle" className="fill-terminal-muted" style={{ fontSize: 10 }}>simulations →</text>
          </svg>
        </div>
        <p className="mt-2 text-[11px] text-terminal-muted">
          Solid = the running Monte Carlo estimate from sampled scorelines; dashed = the exact bivariate-Poisson probability. Watch the estimate converge as n grows — the shaded band is ±2 standard errors (∝ 1/√n).
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/50 p-4 text-center">
          <div className="text-[11px] uppercase tracking-widest text-terminal-muted">simulations</div>
          <div className="tnum text-3xl font-extrabold text-terminal-bright">{cur.n.toLocaleString()}</div>
          <div className="text-[11px] text-terminal-muted">of {MAX_RUNS.toLocaleString()}</div>
        </div>
        <div className="space-y-1.5 rounded-xl border border-terminal-border bg-terminal-panel/50 p-3">
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="tnum text-terminal-muted">{pctTxt(s.est || 0)} <span className="text-terminal-muted/50">/ {pctTxt(s.truth)}</span></span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-terminal-border pt-1.5 text-[11px]">
            <span className="text-terminal-muted">Max error</span>
            <span className="tnum font-semibold text-accent">{pctTxt(Math.max(...series.map((s) => Math.abs((s.est || 0) - s.truth))))}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRunning((r) => !r)} disabled={cur.n >= MAX_RUNS}
            className="flex-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition enabled:hover:bg-accent/20 disabled:opacity-40">
            {running ? 'Pause' : cur.n >= MAX_RUNS ? 'Done' : 'Resume'}
          </button>
          <button onClick={restart} className="rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-text hover:border-accent/40">Restart</button>
        </div>
      </div>
    </div>
  );
}
