'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
  LabelList,
  Legend,
} from 'recharts';

const AXIS = { fill: '#9683b5', fontSize: 11 };
const GRID = '#2e1f47';

const tooltipStyle = {
  backgroundColor: '#1f1433',
  border: '1px solid #2e1f47',
  borderRadius: 8,
  fontSize: 12,
  color: '#f6f1ff',
};

// ── Horizontal ranking bar ───────────────────────────────────
export function HBar({
  data,
  color = '#1fe5c4',
  unit = '',
  height = 320,
}: {
  data: { label: string; value: number; color?: string }[];
  color?: string;
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} stroke={GRID} />
        <YAxis type="category" dataKey="label" tick={AXIS} stroke={GRID} width={92} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: number) => [`${v}${unit}`, '']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
          <LabelList dataKey="value" position="right" fill="#d9cdef" fontSize={11} formatter={(v: number) => `${v}${unit}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Radar comparison ─────────────────────────────────────────
export function Radar2({
  metrics,
  seriesA,
  seriesB,
  height = 300,
}: {
  metrics: string[];
  seriesA: { name: string; values: number[]; color?: string };
  seriesB?: { name: string; values: number[]; color?: string };
  height?: number;
}) {
  const data = metrics.map((m, i) => ({
    metric: m,
    [seriesA.name]: seriesA.values[i] ?? 0,
    ...(seriesB ? { [seriesB.name]: seriesB.values[i] ?? 0 } : {}),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#9683b5', fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name={seriesA.name} dataKey={seriesA.name} stroke={seriesA.color ?? '#1fe5c4'} fill={seriesA.color ?? '#1fe5c4'} fillOpacity={0.35} />
        {seriesB && (
          <Radar name={seriesB.name} dataKey={seriesB.name} stroke={seriesB.color ?? '#ff2e9a'} fill={seriesB.color ?? '#ff2e9a'} fillOpacity={0.3} />
        )}
        {seriesB && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Scatter (e.g. xG vs goals, value vs output) ──────────────
export function Scatter2({
  points,
  xLabel,
  yLabel,
  height = 360,
  color = '#22e0d0',
}: {
  points: { x: number; y: number; label: string; z?: number }[];
  xLabel: string;
  yLabel: string;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ left: 4, right: 16, top: 12, bottom: 16 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS} stroke={GRID} label={{ value: xLabel, position: 'insideBottom', offset: -8, fill: '#9683b5', fontSize: 11 }} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS} stroke={GRID} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#9683b5', fontSize: 11 }} />
        <ZAxis type="number" dataKey="z" range={[40, 260]} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ strokeDasharray: '3 3', stroke: GRID }}
          formatter={(v: number, n: string) => [v, n === 'x' ? xLabel : yLabel]}
          labelFormatter={() => ''}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as { label: string; x: number; y: number } | undefined;
            if (!p) return null;
            return (
              <div style={tooltipStyle} className="px-2 py-1">
                <p className="font-semibold">{p.label}</p>
                <p className="tnum">{xLabel}: {p.x} · {yLabel}: {p.y}</p>
              </div>
            );
          }}
        />
        <Scatter data={points} fill={color} fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── Area / momentum line ─────────────────────────────────────
export function AreaTrend({
  data,
  dataKey,
  xKey = 'label',
  color = '#1fe5c4',
  height = 220,
  unit = '',
}: {
  data: Record<string, number | string>[];
  dataKey: string;
  xKey?: string;
  color?: string;
  height?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} stroke={GRID} />
        <YAxis tick={AXIS} stroke={GRID} width={36} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}${unit}`, '']} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
