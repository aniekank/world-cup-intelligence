'use client';

import { useMemo, useState } from 'react';
import { bivariatePoissonGrid } from '@/lib/labMath';
import type { LabMatch } from '@/server/lab';

const LEAGUE_AVG = 1.35;
/** Same goal-expectation map the engine uses — shown here, not hidden. */
function lambdaFor(attack: number, oppDefense: number, isHome: boolean): number {
  return Math.max(0.18, LEAGUE_AVG * (attack / 75) * (2 - oppDefense / 75) * (isHome ? 1.12 : 0.94));
}

const VIEW = 6; // show 0..6 goals; the model computes to 8 under the hood
const pctTxt = (v: number) => `${(v * 100).toFixed(1)}%`;

// teal → amber → magenta sequential ramp on sqrt(prob) for visual range
function cellColor(p: number, max: number): string {
  const t = max > 0 ? Math.sqrt(p / max) : 0;
  const stops = [
    [12, 18, 32], [31, 124, 120], [34, 224, 208], [255, 138, 30], [255, 46, 154],
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const c = stops[i]!.map((a, k) => Math.round(a + (stops[i + 1]![k]! - a) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function Slider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-terminal-muted">{label}</span>
        <span className="tnum font-semibold text-terminal-bright">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="lab-range w-full" />
    </label>
  );
}

export function PoissonHeatmap({ matches }: { matches: LabMatch[] }) {
  const presets = matches.slice(0, 6);
  const first = presets[0];
  const [lh, setLh] = useState(() => first ? lambdaFor(first.home.attack, first.away.defense, true) : 1.6);
  const [la, setLa] = useState(() => first ? lambdaFor(first.away.attack, first.home.defense, false) : 1.1);
  const [cov, setCov] = useState(0.12);
  const [activePreset, setActivePreset] = useState<string | null>(first?.id ?? null);
  const [hover, setHover] = useState<{ h: number; a: number } | null>(null);

  const model = useMemo(() => bivariatePoissonGrid(lh, la, cov), [lh, la, cov]);
  const maxCell = useMemo(() => {
    let m = 0;
    for (let h = 0; h <= VIEW; h++) for (let a = 0; a <= VIEW; a++) m = Math.max(m, model.grid[h]![a]!);
    return m;
  }, [model]);

  const loadPreset = (m: LabMatch) => {
    setLh(lambdaFor(m.home.attack, m.away.defense, true));
    setLa(lambdaFor(m.away.attack, m.home.defense, false));
    setActivePreset(m.id);
  };

  const onManual = (setter: (v: number) => void) => (v: number) => { setter(v); setActivePreset(null); };
  const homeName = activePreset ? presets.find((p) => p.id === activePreset)?.home.code ?? 'Home' : 'Home';
  const awayName = activePreset ? presets.find((p) => p.id === activePreset)?.away.code ?? 'Away' : 'Away';
  const hp = hover ? model.grid[hover.h]?.[hover.a] ?? 0 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Heatmap */}
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {presets.map((m) => (
            <button key={m.id} onClick={() => loadPreset(m)}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${activePreset === m.id ? 'border-accent/60 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40'}`}>
              {m.home.code} v {m.away.code}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* y-axis label */}
          <div className="flex flex-col items-center justify-center">
            <span className="rotate-180 text-[10px] font-semibold uppercase tracking-widest text-terminal-muted [writing-mode:vertical-lr]">
              {homeName} goals
            </span>
          </div>
          <div className="flex-1">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `1.6rem repeat(${VIEW + 1}, minmax(0, 1fr))` }}>
              <div />
              {Array.from({ length: VIEW + 1 }, (_, a) => (
                <div key={a} className="pb-1 text-center text-[11px] tnum text-terminal-muted">{a}</div>
              ))}
              {Array.from({ length: VIEW + 1 }, (_, h) => (
                <FragmentRow key={h} h={h} model={model} maxCell={maxCell} hover={hover} setHover={setHover} />
              ))}
            </div>
            <div className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">{awayName} goals →</div>
          </div>
        </div>

        {/* sliders */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Slider label={`${homeName} expected goals (λ)`} value={lh} min={0.2} max={3.6} step={0.05} onChange={onManual(setLh)} />
          <Slider label={`${awayName} expected goals (λ)`} value={la} min={0.2} max={3.6} step={0.05} onChange={onManual(setLa)} />
          <Slider label="Score correlation (λ₃)" value={cov} min={0} max={0.4} step={0.01} onChange={(v) => setCov(v)} />
        </div>
      </div>

      {/* Readout */}
      <div className="space-y-3">
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">Match outcome</p>
          <OutcomeBar home={model.homeWin} draw={model.draw} away={model.awayWin} homeName={homeName} awayName={awayName} />
          <div className="mt-3 space-y-1.5 text-sm">
            <Row label={`${homeName} win`} value={pctTxt(model.homeWin)} accent="#22e0d0" />
            <Row label="Draw" value={pctTxt(model.draw)} accent="#8b8b9e" />
            <Row label={`${awayName} win`} value={pctTxt(model.awayWin)} accent="#ff2e9a" />
          </div>
        </div>

        <div className="rounded-xl border border-terminal-border bg-terminal-panel/50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">Most likely scores</p>
          <ul className="space-y-1.5">
            {model.topScores.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="tnum font-semibold text-terminal-bright">{s.home}–{s.away}</span>
                <span className="tnum text-terminal-muted">{pctTxt(s.prob)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <Mini label="BTTS" value={pctTxt(model.btts)} />
          <Mini label="Over 2.5" value={pctTxt(model.over25)} />
        </div>

        <div className="rounded-xl border border-terminal-border bg-terminal-panel/30 p-3 text-[11px] leading-relaxed text-terminal-muted">
          {hover
            ? <>P(<span className="font-semibold text-terminal-bright">{homeName} {hover.h}–{hover.a} {awayName}</span>) = <span className="tnum font-semibold text-accent">{pctTxt(hp)}</span></>
            : 'Hover a cell for its exact-scoreline probability. Drag the λ sliders to reshape the joint distribution.'}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ h, model, maxCell, hover, setHover }: {
  h: number; model: ReturnType<typeof bivariatePoissonGrid>; maxCell: number; hover: { h: number; a: number } | null; setHover: (v: { h: number; a: number } | null) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-1 text-[11px] tnum text-terminal-muted">{h}</div>
      {Array.from({ length: VIEW + 1 }, (_, a) => {
        const p = model.grid[h]![a]!;
        const isDraw = h === a;
        const isHover = hover?.h === h && hover?.a === a;
        return (
          <div key={a}
            onMouseEnter={() => setHover({ h, a })}
            onMouseLeave={() => setHover(null)}
            className="relative aspect-square cursor-crosshair rounded-[3px] transition-transform"
            style={{
              background: cellColor(p, maxCell),
              outline: isDraw ? '1px dashed rgba(255,255,255,0.25)' : 'none',
              outlineOffset: '-1px',
              transform: isHover ? 'scale(1.08)' : 'none',
              boxShadow: isHover ? '0 0 0 2px rgba(255,255,255,0.6)' : 'none',
              zIndex: isHover ? 2 : 1,
            }}
            title={`${h}-${a}: ${pctTxt(p)}`}
          >
            {p > maxCell * 0.18 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-black/80">
                {(p * 100).toFixed(0)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function OutcomeBar({ home, draw, away, homeName, awayName }: { home: number; draw: number; away: number; homeName: string; awayName: string }) {
  return (
    <div className="flex h-7 w-full overflow-hidden rounded-md text-[10px] font-semibold">
      <div className="flex items-center justify-center text-black/80" style={{ width: `${home * 100}%`, background: '#22e0d0' }}>{home > 0.12 ? homeName : ''}</div>
      <div className="flex items-center justify-center text-white/80" style={{ width: `${draw * 100}%`, background: '#4b4b5e' }}>{draw > 0.12 ? 'X' : ''}</div>
      <div className="flex items-center justify-center text-black/80" style={{ width: `${away * 100}%`, background: '#ff2e9a' }}>{away > 0.12 ? awayName : ''}</div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-terminal-text"><span className="h-2 w-2 rounded-full" style={{ background: accent }} />{label}</span>
      <span className="tnum font-semibold text-terminal-bright">{value}</span>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-terminal-muted">{label}</div>
      <div className="tnum text-lg font-bold text-terminal-bright">{value}</div>
    </div>
  );
}
