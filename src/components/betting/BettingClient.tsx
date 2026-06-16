'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Calculator, Receipt, TrendingUp } from 'lucide-react';
import { clock } from '@/lib/format';

interface EdgeOutcome {
  label: string;
  side: 'home' | 'draw' | 'away';
  model: number;
  market: number;
  odds: number;
  edge: number;
  ev: number;
}
interface EdgeRow {
  matchId: string;
  kickoff: string;
  home: { code: string; name: string; flag: string };
  away: { code: string; name: string; flag: string };
  books: number;
  outcomes: EdgeOutcome[];
  bestEv: number;
}
interface Selection {
  key: string;
  match: string;
  outcome: string;
  odds: number;
  model: number;
}

const SLIP_KEY = 'wc26:betslip';
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const evColor = (ev: number) => (ev > 0.02 ? 'text-accent' : ev < -0.05 ? 'text-accent-red' : 'text-terminal-muted');

export function BettingClient({ rows }: { rows: EdgeRow[] }) {
  const [slip, setSlip] = useState<Selection[]>([]);
  const [stake, setStake] = useState(10);
  const [mode, setMode] = useState<'single' | 'acca'>('single');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SLIP_KEY) ?? '{}');
      if (Array.isArray(s.slip)) setSlip(s.slip);
      if (typeof s.stake === 'number') setStake(s.stake);
      if (s.mode) setMode(s.mode);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(SLIP_KEY, JSON.stringify({ slip, stake, mode }));
  }, [slip, stake, mode, hydrated]);

  const add = (r: EdgeRow, o: EdgeOutcome) => {
    const key = `${r.matchId}-${o.side}`;
    setSlip((prev) => (prev.find((s) => s.key === key) ? prev : [...prev, { key, match: `${r.home.code} v ${r.away.code}`, outcome: o.label, odds: o.odds, model: o.model }]));
  };
  const remove = (key: string) => setSlip((prev) => prev.filter((s) => s.key !== key));

  const slipMath = useMemo(() => {
    if (!slip.length) return null;
    if (mode === 'acca') {
      const combOdds = slip.reduce((a, s) => a * s.odds, 1);
      const combModel = slip.reduce((a, s) => a * s.model, 1);
      const ret = stake * combOdds;
      const ev = (combModel * combOdds - 1) * stake;
      return { combOdds, combModel, totalStake: stake, ret, ev };
    }
    const totalStake = stake * slip.length;
    const ret = slip.reduce((a, s) => a + stake * s.odds, 0);
    const ev = slip.reduce((a, s) => a + (s.model * s.odds - 1) * stake, 0);
    return { combOdds: 0, combModel: 0, totalStake, ret, ev };
  }, [slip, stake, mode]);

  const valueBets = rows.filter((r) => r.bestEv > 0.02).slice(0, 8);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Model vs market */}
      <div className="space-y-6 lg:col-span-2">
        {valueBets.length > 0 && (
          <div className="rounded-xl border border-terminal-border bg-terminal-panel">
            <div className="flex items-center gap-2 border-b border-terminal-border px-4 py-3">
              <TrendingUp className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-terminal-bright">Model Disagrees With the Market</h2>
              <span className="text-xs text-terminal-muted">— highest model edge (treat with heavy skepticism)</span>
            </div>
            <div className="divide-y divide-terminal-border/60">
              {valueBets.map((r) => {
                const best = r.outcomes.reduce((a, b) => (b.ev > a.ev ? b : a));
                return (
                  <div key={r.matchId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-terminal-bright">{r.home.flag} {r.home.code} v {r.away.code} {r.away.flag}</p>
                      <p className="text-[11px] text-terminal-muted">{clock(r.kickoff)} · {r.books} books</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-terminal-muted">{best.label}</p>
                        <p className="tnum text-terminal-bright">model {pct(best.model)} vs mkt {pct(best.market)}</p>
                      </div>
                      <div className="text-right">
                        <p className="tnum text-sm font-semibold text-terminal-bright">@ {best.odds.toFixed(2)}</p>
                        <p className={`tnum text-xs ${evColor(best.ev)}`}>EV {best.ev >= 0 ? '+' : ''}{(best.ev * 100).toFixed(1)}%</p>
                      </div>
                      <button onClick={() => add(r, best)} className="rounded-md border border-terminal-border p-1.5 text-accent hover:border-accent/40" title="Add to slip">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel">
          <div className="border-b border-terminal-border px-4 py-3">
            <h2 className="text-sm font-semibold text-terminal-bright">Model vs Market — All Fixtures</h2>
            <p className="text-xs text-terminal-muted">Our probability vs de-vigged bookmaker consensus, best price, and expected value</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-terminal-elevated text-[11px] uppercase tracking-wide text-terminal-muted">
                  <th className="px-3 py-2 text-left">Fixture</th>
                  <th className="px-3 py-2 text-left">Pick</th>
                  <th className="px-3 py-2 text-right">Model</th>
                  <th className="px-3 py-2 text-right">Market</th>
                  <th className="px-3 py-2 text-right">Best</th>
                  <th className="px-3 py-2 text-right">EV</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  r.outcomes.map((o, i) => (
                    <tr key={`${r.matchId}-${o.side}`} className="border-t border-terminal-border/50 hover:bg-terminal-elevated">
                      <td className="px-3 py-1.5 text-terminal-text">{i === 0 ? `${r.home.code} v ${r.away.code}` : ''}</td>
                      <td className="px-3 py-1.5 text-terminal-bright">{o.label}</td>
                      <td className="px-3 py-1.5 text-right tnum">{pct(o.model)}</td>
                      <td className="px-3 py-1.5 text-right tnum text-terminal-muted">{pct(o.market)}</td>
                      <td className="px-3 py-1.5 text-right tnum font-medium text-terminal-bright">{o.odds.toFixed(2)}</td>
                      <td className={`px-3 py-1.5 text-right tnum ${evColor(o.ev)}`}>{o.ev >= 0 ? '+' : ''}{(o.ev * 100).toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right">
                        <button onClick={() => add(r, o)} className="text-terminal-muted hover:text-accent" title="Add to slip">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slip + Kelly */}
      <div className="space-y-6">
        <div className="rounded-xl border border-terminal-border bg-terminal-panel">
          <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-terminal-bright">
              <Receipt className="h-4 w-4 text-accent" /> Your Slip
            </h2>
            {slip.length > 0 && (
              <button onClick={() => setSlip([])} className="flex items-center gap-1 text-xs text-terminal-muted hover:text-accent-red">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
          <div className="p-4">
            {slip.length === 0 ? (
              <p className="text-sm text-terminal-muted">Add selections from the table to build a slip. Saved on this device.</p>
            ) : (
              <>
                <div className="mb-3 flex gap-1 rounded-md border border-terminal-border p-0.5 text-xs">
                  {(['single', 'acca'] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded px-2 py-1 ${mode === m ? 'bg-accent/15 text-accent' : 'text-terminal-muted'}`}>
                      {m === 'single' ? 'Singles' : 'Accumulator'}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {slip.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2 rounded border border-terminal-border bg-terminal-elevated px-2 py-1.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-terminal-bright">{s.outcome}</p>
                        <p className="text-[11px] text-terminal-muted">{s.match}</p>
                      </div>
                      <span className="tnum font-semibold text-terminal-bright">{s.odds.toFixed(2)}</span>
                      <button onClick={() => remove(s.key)} className="text-terminal-muted hover:text-accent-red">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="mt-3 block text-xs text-terminal-muted">
                  Stake {mode === 'single' ? 'per selection' : ''} (units)
                  <input type="number" min={0} value={stake} onChange={(e) => setStake(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-md border border-terminal-border bg-terminal-bg px-2 py-1.5 text-terminal-bright focus:border-accent focus:outline-none" />
                </label>
                {slipMath && (
                  <div className="mt-3 space-y-1 border-t border-terminal-border pt-3 text-sm">
                    {mode === 'acca' && (
                      <Row label="Combined odds" value={slipMath.combOdds.toFixed(2)} />
                    )}
                    <Row label="Total stake" value={slipMath.totalStake.toFixed(2)} />
                    <Row label={mode === 'acca' ? 'Potential return' : 'Return if all win'} value={slipMath.ret.toFixed(2)} accent />
                    <Row label="Model expected value" value={`${slipMath.ev >= 0 ? '+' : ''}${slipMath.ev.toFixed(2)}`} evTone={slipMath.ev} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <KellyCalculator />
      </div>
    </div>
  );
}

function Row({ label, value, accent, evTone }: { label: string; value: string; accent?: boolean; evTone?: number }) {
  const color = evTone != null ? (evTone > 0 ? 'text-accent' : evTone < 0 ? 'text-accent-red' : 'text-terminal-muted') : accent ? 'text-accent' : 'text-terminal-bright';
  return (
    <div className="flex justify-between">
      <span className="text-terminal-muted">{label}</span>
      <span className={`tnum font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function KellyCalculator() {
  const [odds, setOdds] = useState(2.5);
  const [prob, setProb] = useState(45);
  const [bankroll, setBankroll] = useState(100);
  const [fraction, setFraction] = useState(0.25);

  const p = prob / 100;
  const b = odds - 1;
  const fullKelly = b > 0 ? (b * p - (1 - p)) / b : 0;
  const k = Math.max(0, fullKelly) * fraction;
  const stake = k * bankroll;
  const ev = p * odds - 1;

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel">
      <div className="flex items-center gap-2 border-b border-terminal-border px-4 py-3">
        <Calculator className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-terminal-bright">Stake Sizing (Kelly)</h2>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <Field label="Decimal odds" value={odds} step={0.01} min={1.01} onChange={setOdds} />
        <Field label="Your win probability (%)" value={prob} step={1} min={0} max={100} onChange={setProb} />
        <Field label="Bankroll (units)" value={bankroll} step={1} min={0} onChange={setBankroll} />
        <div>
          <div className="flex justify-between text-xs text-terminal-muted">
            <span>Kelly fraction</span>
            <span className="tnum text-terminal-text">{(fraction * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min={0.05} max={1} step={0.05} value={fraction} onChange={(e) => setFraction(Number(e.target.value))} className="mt-1 w-full accent-[#1fe5c4]" />
        </div>
        <div className="space-y-1 border-t border-terminal-border pt-3">
          <Row label="Edge (EV)" value={`${ev >= 0 ? '+' : ''}${(ev * 100).toFixed(1)}%`} evTone={ev} />
          <Row label="Full Kelly" value={`${(Math.max(0, fullKelly) * 100).toFixed(1)}%`} />
          <Row label={`Suggested stake (${(fraction * 100).toFixed(0)}% Kelly)`} value={stake.toFixed(2)} accent />
        </div>
        {fullKelly <= 0 && <p className="text-xs text-accent-amber">No edge at these inputs — Kelly says stake nothing.</p>}
        <p className="text-[11px] text-terminal-muted">Kelly assumes your probability is correct. It rarely is — fractional Kelly (¼–½) cushions that error. Never chase losses.</p>
      </div>
    </div>
  );
}

function Field({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max?: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-terminal-muted">
      {label}
      <input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-md border border-terminal-border bg-terminal-bg px-2 py-1.5 text-terminal-bright focus:border-accent focus:outline-none" />
    </label>
  );
}
