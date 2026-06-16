import type { Shot } from '@/domain/types';

/**
 * Attacking-half shot map. Pitch is drawn vertically (attacking upward); each
 * shot is placed by its (x,y) pitch coordinates, sized by xG and colored by
 * outcome (goal = green, on-target = amber, off-target/blocked = muted).
 */
export function ShotMap({ shots, width = 360 }: { shots: Shot[]; width?: number }) {
  const H = width * 1.15;
  // Map normalized x(55..100 attacking) → vertical position; y(0..100) → horizontal
  const px = (s: Shot) => (s.y / 100) * width;
  const py = (s: Shot) => H - ((s.x - 50) / 50) * H; // x=100 (goal) at top
  const radius = (s: Shot) => 4 + s.xG * 16;
  const color = (s: Shot) =>
    s.outcome === 'goal' || s.outcome === 'penalty_goal'
      ? '#1fe5c4'
      : s.outcome === 'saved' || s.outcome === 'post'
        ? '#ff8a1e'
        : '#9683b5';

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${H}`} className="w-full" role="img" aria-label="Shot map">
        {/* Pitch */}
        <rect x={0} y={0} width={width} height={H} fill="#0e0a1a" stroke="#33215a" />
        {/* Penalty box */}
        <rect x={width * 0.21} y={0} width={width * 0.58} height={H * 0.28} fill="none" stroke="#33215a" strokeWidth={1.5} />
        {/* Six-yard box */}
        <rect x={width * 0.37} y={0} width={width * 0.26} height={H * 0.1} fill="none" stroke="#33215a" strokeWidth={1.5} />
        {/* Penalty spot */}
        <circle cx={width / 2} cy={H * 0.19} r={2} fill="#33215a" />
        {/* Goal */}
        <rect x={width * 0.42} y={0} width={width * 0.16} height={3} fill="#1fe5c4" />
        {/* Center arc */}
        <line x1={0} y1={H * 0.99} x2={width} y2={H * 0.99} stroke="#33215a" />

        {shots.map((s) => (
          <circle
            key={s.id}
            cx={px(s)}
            cy={py(s)}
            r={radius(s)}
            fill={color(s)}
            fillOpacity={s.outcome === 'goal' ? 0.85 : 0.45}
            stroke={color(s)}
            strokeOpacity={0.8}
          >
            <title>{`${s.minute}′ · xG ${s.xG.toFixed(2)} · ${s.situation.replace('_', ' ')} · ${s.outcome.replace('_', ' ')}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-terminal-muted">
        <Legend color="#1fe5c4" label="Goal" />
        <Legend color="#ff8a1e" label="On target" />
        <Legend color="#9683b5" label="Off / blocked" />
        <span className="ml-auto">● size = xG</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
