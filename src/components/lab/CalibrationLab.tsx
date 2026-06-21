'use client';

import { useMemo, useState } from 'react';
import { calibrationBins } from '@/lib/labMath';
import type { CalPair } from '@/server/lab';

const S = 360, PAD = 40;
const sx = (p: number) => PAD + p * (S - 2 * PAD);
const sy = (p: number) => S - PAD - p * (S - 2 * PAD);

export function CalibrationLab({ pairs, n, skill, hitRate }: { pairs: CalPair[]; n: number; skill: number; hitRate: number }) {
  const [nBins, setNBins] = useState(10);
  const [cls, setCls] = useState<'all' | 'H' | 'D' | 'A'>('all');

  const filtered = useMemo(() => (cls === 'all' ? pairs : pairs.filter((p) => p.cls === cls)), [pairs, cls]);
  const cal = useMemo(() => calibrationBins(filtered.map((p) => ({ p: p.p, y: p.y })), nBins), [filtered, nBins]);
  const maxCount = Math.max(1, ...cal.bins.map((b) => b.count));

  if (n < 3) {
    return (
      <p className="rounded-xl border border-terminal-border bg-terminal-panel/40 px-4 py-8 text-center text-sm text-terminal-muted">
        Calibration needs played matches to score the model against. Only {n} finished so far — switch to the Simulated or a historical edition for a full reliability curve.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/30 p-3">
          <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[420px]">
            {/* grid + perfect-calibration diagonal */}
            {[0.25, 0.5, 0.75].map((g) => (
              <g key={g}>
                <line x1={sx(g)} y1={sy(0)} x2={sx(g)} y2={sy(1)} stroke="rgba(255,255,255,0.05)" />
                <line x1={sx(0)} y1={sy(g)} x2={sx(1)} y2={sy(g)} stroke="rgba(255,255,255,0.05)" />
              </g>
            ))}
            <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
            <text x={sx(0.5)} y={S - 8} textAnchor="middle" className="fill-terminal-muted" style={{ fontSize: 11 }}>Predicted probability</text>
            <text x={12} y={sy(0.5)} textAnchor="middle" transform={`rotate(-90 12 ${sy(0.5)})`} className="fill-terminal-muted" style={{ fontSize: 11 }}>Observed frequency</text>
            {/* count histogram (faint bars on x) */}
            {cal.bins.map((b, i) => b.count > 0 && (
              <rect key={`h${i}`} x={sx(b.lo)} y={sy(0)} width={Math.max(1, sx(b.hi) - sx(b.lo) - 1)}
                height={(b.count / maxCount) * 26} transform={`translate(0,${-((b.count / maxCount) * 26)})`}
                fill="rgba(34,224,208,0.15)" />
            ))}
            {/* reliability curve */}
            <polyline fill="none" stroke="#22e0d0" strokeWidth={2}
              points={cal.bins.filter((b) => b.count > 0).map((b) => `${sx(b.predMean)},${sy(b.obsFreq)}`).join(' ')} />
            {cal.bins.filter((b) => b.count > 0).map((b, i) => (
              <circle key={i} cx={sx(b.predMean)} cy={sy(b.obsFreq)} r={3 + Math.sqrt(b.count) * 0.9} fill="#22e0d0" fillOpacity={0.85} stroke="#0b0613" strokeWidth={0.5}>
                <title>{`pred ${(b.predMean * 100).toFixed(0)}% → observed ${(b.obsFreq * 100).toFixed(0)}% (n=${b.count})`}</title>
              </circle>
            ))}
          </svg>
          <p className="mt-1 text-center text-[11px] text-terminal-muted">Points on the dashed line = perfectly calibrated. Bubble size = sample in that bin.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Brier score" value={cal.brier.toFixed(3)} sub="lower is better" />
          <Metric label="Brier skill" value={`${(skill * 100).toFixed(0)}%`} sub="vs coin-flip" accent />
          <Metric label="Reliability" value={cal.reliability.toFixed(3)} sub="calibration error" />
          <Metric label="Resolution" value={cal.resolution.toFixed(3)} sub="discrimination" />
        </div>
        <p className="text-[11px] leading-relaxed text-terminal-muted">
          Murphy decomposition: <span className="text-terminal-bright">Brier = Reliability − Resolution + Uncertainty</span>. Low reliability means the stated probabilities match reality; high resolution means the model separates likely from unlikely. Hit rate {(hitRate * 100).toFixed(0)}% across {n} matches.
        </p>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-terminal-muted">Bins</span>
            <span className="tnum font-semibold text-terminal-bright">{nBins}</span>
          </div>
          <input type="range" min={5} max={20} step={1} value={nBins} onChange={(e) => setNBins(parseInt(e.target.value))} className="lab-range w-full" />
        </div>

        <div>
          <p className="mb-1.5 text-xs text-terminal-muted">Outcome class</p>
          <div className="flex gap-1.5">
            {(['all', 'H', 'D', 'A'] as const).map((c) => (
              <button key={c} onClick={() => setCls(c)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] transition ${cls === c ? 'border-accent/50 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40'}`}>
                {c === 'all' ? 'All' : c === 'H' ? 'Home' : c === 'D' ? 'Draw' : 'Away'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-terminal-muted">{label}</div>
      <div className={`tnum text-xl font-bold ${accent ? 'text-accent' : 'text-terminal-bright'}`}>{value}</div>
      <div className="text-[10px] text-terminal-muted">{sub}</div>
    </div>
  );
}
