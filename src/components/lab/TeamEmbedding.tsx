'use client';

import { useMemo, useState } from 'react';
import { standardizeColumns, pca, kmeans } from '@/lib/labMath';
import type { EmbeddingDim, EmbeddingTeam } from '@/server/lab';

const CLUSTER_COLORS = ['#22e0d0', '#ff8a1e', '#ff2e9a', '#8b5cf6', '#3b82f6', '#eab308', '#10b981', '#f43f5e'];
const CONF_COLORS: Record<string, string> = { UEFA: '#3b82f6', CONMEBOL: '#eab308', CAF: '#10b981', AFC: '#ff2e9a', CONCACAF: '#ff8a1e', OFC: '#8b5cf6' };

const W = 620, H = 440, PAD = 34;

export function TeamEmbedding({ dims, teams }: { dims: EmbeddingDim[]; teams: EmbeddingTeam[] }) {
  const [on, setOn] = useState<boolean[]>(() => dims.map(() => true));
  const [k, setK] = useState(5);
  const [colorBy, setColorBy] = useState<'cluster' | 'confederation'>('cluster');
  const [hover, setHover] = useState<number | null>(null);

  const selIdx = useMemo(() => on.map((v, i) => (v ? i : -1)).filter((i) => i >= 0), [on]);

  const result = useMemo(() => {
    if (selIdx.length < 2) return null;
    const rows = teams.map((t) => selIdx.map((i) => t.vector[i]!));
    const { z } = standardizeColumns(rows);
    const { coords, components, explained } = pca(z, 2);
    const { assignments } = kmeans(z, k);
    // scale coords into the viewBox
    const xs = coords.map((c) => c[0]!), ys = coords.map((c) => c[1]!);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const sx = (x: number) => PAD + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * PAD);
    const sy = (y: number) => H - PAD - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * PAD);
    const pts = coords.map((c, i) => ({ x: sx(c[0]!), y: sy(c[1]!), cluster: assignments[i]!, team: teams[i]! }));
    // loadings: top contributing selected dim for each PC
    const loadings = components.map((pc) =>
      selIdx.map((di, j) => ({ label: dims[di]!.label, w: pc[j]! }))
        .sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 3),
    );
    return { pts, explained, loadings };
  }, [selIdx, k, teams, dims]);

  const colorOf = (cluster: number, conf: string) => colorBy === 'cluster' ? CLUSTER_COLORS[cluster % CLUSTER_COLORS.length]! : (CONF_COLORS[conf] ?? '#8b8b9e');
  const hoverTeam = hover != null ? result?.pts[hover] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div className="relative overflow-hidden rounded-xl border border-terminal-border bg-terminal-panel/30">
          {!result ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-terminal-muted">Select at least two metrics to project.</div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {/* quadrant axes */}
              <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} stroke="rgba(255,255,255,0.06)" />
              <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.06)" />
              <text x={W - PAD} y={H / 2 - 6} textAnchor="end" className="fill-terminal-muted" style={{ fontSize: 10 }}>PC1 →</text>
              <text x={W / 2 + 6} y={PAD + 4} className="fill-terminal-muted" style={{ fontSize: 10 }}>PC2 ↑</text>
              {result.pts.map((p, i) => {
                const isH = hover === i;
                const c = colorOf(p.cluster, p.team.confederation);
                return (
                  <g key={p.team.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                    <circle cx={p.x} cy={p.y} r={isH ? 9 : 6} fill={c} fillOpacity={isH ? 1 : 0.82} stroke={isH ? '#fff' : 'rgba(0,0,0,0.4)'} strokeWidth={isH ? 1.5 : 0.5} />
                    {(isH || p.team.elo > 1850) && (
                      <text x={p.x} y={p.y - (isH ? 13 : 10)} textAnchor="middle" className="fill-terminal-bright" style={{ fontSize: isH ? 12 : 9.5, fontWeight: 700, paintOrder: 'stroke', stroke: '#0b0613', strokeWidth: 3 }}>
                        {p.team.code}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
          {hoverTeam && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-terminal-border bg-terminal-bg/95 px-3 py-2 text-xs shadow-glow">
              <div className="font-semibold text-terminal-bright">{hoverTeam.team.flag} {hoverTeam.team.name}</div>
              <div className="text-terminal-muted">{hoverTeam.team.confederation} · cluster {hoverTeam.cluster + 1} · ELO {hoverTeam.team.elo}</div>
            </div>
          )}
        </div>
        {result && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-terminal-muted">
            <span>PC1 explains <b className="text-terminal-bright">{(result.explained[0]! * 100).toFixed(0)}%</b> · PC2 <b className="text-terminal-bright">{(result.explained[1]! * 100).toFixed(0)}%</b> of variance</span>
            <span className="hidden sm:inline">PC1 driven by {result.loadings[0]!.map((l) => l.label.split(' ')[0]).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">Metrics in the projection</p>
          <div className="flex flex-wrap gap-1.5">
            {dims.map((d, i) => (
              <button key={d.key} onClick={() => setOn((o) => o.map((v, j) => (j === i ? !v : v)))}
                className={`rounded-md border px-2 py-1 text-[11px] transition ${on[i] ? 'border-accent/50 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40'}`}>
                {d.label.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-terminal-muted">Clusters (k)</span>
            <span className="tnum font-semibold text-terminal-bright">{k}</span>
          </div>
          <input type="range" min={2} max={8} step={1} value={k} onChange={(e) => setK(parseInt(e.target.value))} className="lab-range w-full" />
        </div>

        <div>
          <p className="mb-1.5 text-xs text-terminal-muted">Colour by</p>
          <div className="flex gap-1.5">
            {(['cluster', 'confederation'] as const).map((m) => (
              <button key={m} onClick={() => setColorBy(m)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] capitalize transition ${colorBy === m ? 'border-accent/50 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-terminal-border bg-terminal-panel/30 p-3 text-[11px] leading-relaxed text-terminal-muted">
          48 teams reduced from {selIdx.length} dimensions to 2 via PCA computed in your browser. Toggle metrics or change k and the projection + k-means clusters recompute live.
        </div>
      </div>
    </div>
  );
}
