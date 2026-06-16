import { lighten, darken } from '@/lib/visual';

/**
 * Procedural team crest — a circular roundel in the nation's colors with a
 * halftone dot texture and the FIFA code. A lightweight, license-free stand-in
 * for an official badge; swap the SVG body for a real crest image later without
 * touching call sites.
 */
export function TeamCrest({
  code,
  color,
  size = 48,
  className,
}: {
  code: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const id = `crest-${code}`;
  const r = 50;
  // Halftone ring of dots around the rim
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const dots = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return { x: r3(50 + Math.cos(a) * 41), y: r3(50 + Math.sin(a) * 41), r: 1.6 + (i % 3) * 0.6 };
  });

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={`${code} crest`}>
      <defs>
        <radialGradient id={`${id}-g`} cx="42%" cy="34%" r="75%">
          <stop offset="0%" stopColor={lighten(color, 0.35)} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={darken(color, 0.45)} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill={`url(#${id}-g)`} />
      <circle cx="50" cy="50" r={r - 1.5} fill="none" stroke={lighten(color, 0.5)} strokeOpacity={0.5} strokeWidth={1.2} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#ffffff" fillOpacity={0.18} />
      ))}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="30"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#ffffff"
        style={{ paintOrder: 'stroke', letterSpacing: '-1px' }}
      >
        {code}
      </text>
    </svg>
  );
}
