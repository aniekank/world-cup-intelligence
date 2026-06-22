'use client';

import { useMemo } from 'react';
import { correlationMatrix } from '@/lib/labMath';
import type { EmbeddingDim, EmbeddingTeam, Residual } from '@/server/lab';

function corrColor(r: number): string {
  const t = Math.max(-1, Math.min(1, r));
  if (t >= 0) return `rgba(34, 224, 208, ${(t * 0.9).toFixed(3)})`;
  return `rgba(255, 46, 154, ${(-t * 0.9).toFixed(3)})`;
}
const short = (label: string) => ((label.split(' /')[0] ?? label).split(' (')[0] ?? label);

export function FeatureRelationships({
  dims, teams, residuals,
}: {
  dims: EmbeddingDim[]; teams: EmbeddingTeam[];
  residuals: { points: Residual[]; mae: number; bias: number; n: number };
}) {
  const corr = useMemo(() => correlationMatrix(teams.map((t) => t.vector)), [teams]);

  // residual scatter scaling
  const pts = residuals.points;
  const maxV = Math.max(4, ...pts.map((p) => Math.max(p.pred, p.actual)));
  const S = 300, PAD = 30;
  const sx = (v: number) => PAD + (v / maxV) * (S - 2 * PAD);
  const sy = (v: number) => S - PAD - (v / maxV) * (S - 2 * PAD);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Correlation matrix */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">Metric correlation matrix · across 48 teams</p>
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `7.5rem repeat(${dims.length}, minmax(0,1fr))` }}>
              <span />
              {dims.map((d) => (
                <span key={d.key} className="pb-1 text-center text-[9px] leading-tight text-terminal-muted" title={d.label}>{short(d.label).slice(0, 6)}</span>
              ))}
              {dims.map((row, i) => (
                <FragRow key={row.key} label={short(row.label)} title={row.label} values={corr[i]!} />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-terminal-muted">Pearson <span className="text-accent">r</span> between every pair of team-style metrics (teal = move together, pink = inversely). Computed in-browser.</p>
      </div>

      {/* Residual scatter */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">Model fit · predicted vs actual goals</p>
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/30 p-2">
          {pts.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-terminal-muted">Plays out once matches finish.</div>
          ) : (
            <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[360px]">
              {[1, 2, 3, 4].filter((g) => g <= maxV).map((g) => (
                <g key={g}>
                  <line x1={sx(g)} y1={sy(0)} x2={sx(g)} y2={sy(maxV)} stroke="rgba(255,255,255,0.04)" />
                  <line x1={sx(0)} y1={sy(g)} x2={sx(maxV)} y2={sy(g)} stroke="rgba(255,255,255,0.04)" />
                  <text x={sx(g)} y={S - PAD + 12} textAnchor="middle" className="fill-terminal-muted" style={{ fontSize: 8 }}>{g}</text>
                  <text x={PAD - 6} y={sy(g) + 3} textAnchor="end" className="fill-terminal-muted" style={{ fontSize: 8 }}>{g}</text>
                </g>
              ))}
              <line x1={sx(0)} y1={sy(0)} x2={sx(maxV)} y2={sy(maxV)} stroke="rgba(255,255,255,0.28)" strokeDasharray="4 4" />
              {pts.map((p, i) => (
                <circle key={i} cx={sx(p.pred)} cy={sy(p.actual)} r={3} fill={p.side === 'home' ? '#22e0d0' : '#ff2e9a'} fillOpacity={0.5}>
                  <title>{`${p.label} (${p.side}): predicted ${p.pred.toFixed(2)}, scored ${p.actual}`}</title>
                </circle>
              ))}
              <text x={S / 2} y={S - 4} textAnchor="middle" className="fill-terminal-muted" style={{ fontSize: 9 }}>predicted goals (xG-rate)</text>
              <text x={10} y={S / 2} textAnchor="middle" transform={`rotate(-90 10 ${S / 2})`} className="fill-terminal-muted" style={{ fontSize: 9 }}>actual goals</text>
            </svg>
          )}
        </div>
        <div className="mt-2 flex gap-3 text-[11px] text-terminal-muted">
          <span>n = <b className="text-terminal-bright">{residuals.n}</b></span>
          <span>MAE = <b className="text-terminal-bright">{residuals.mae.toFixed(2)}</b> goals</span>
          <span>bias = <b className={residuals.bias >= 0 ? 'text-accent' : 'text-accent-red'}>{residuals.bias >= 0 ? '+' : ''}{residuals.bias.toFixed(2)}</b></span>
          <span className="ml-auto"><span className="text-[#22e0d0]">●</span> home <span className="text-[#ff2e9a]">●</span> away</span>
        </div>
        <p className="mt-1 text-[11px] text-terminal-muted">Points above the dashed line scored more than the model expected. Positive bias = teams out-scoring their xG-rate so far.</p>
      </div>
    </div>
  );
}

function FragRow({ label, title, values }: { label: string; title: string; values: number[] }) {
  return (
    <>
      <span className="flex items-center truncate pr-1 text-[10px] text-terminal-text" title={title}>{label}</span>
      {values.map((r, j) => (
        <div key={j} className="flex aspect-square items-center justify-center rounded-[2px]" style={{ background: corrColor(r) }} title={`r = ${r.toFixed(2)}`}>
          <span className="text-[8px] font-semibold" style={{ color: Math.abs(r) > 0.45 ? '#0b0613' : 'rgba(255,255,255,0.55)' }}>{r.toFixed(1)}</span>
        </div>
      ))}
    </>
  );
}
