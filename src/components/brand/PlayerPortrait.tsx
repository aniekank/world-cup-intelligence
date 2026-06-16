import { accentFor, darken, lighten, initials, hashStr } from '@/lib/visual';

/**
 * Procedural player portrait — a duotone bust silhouette on a vivid halftone
 * field, a direct nod to "THE MANIFESTO" cover (teal face, CMYK halftone
 * ground). Deterministic per player. License-free placeholder; drop a real
 * head-shot into the same slot later by swapping the <image> in.
 */
export function PlayerPortrait({
  id,
  name,
  size = 96,
  rounded = 'full',
  className,
}: {
  id: string;
  name: string;
  size?: number;
  rounded?: 'full' | 'xl';
  className?: string;
}) {
  const bg = accentFor(id);
  const h = hashStr(id);
  const face = '#1fe5c4'; // cover teal
  const clipId = `pp-${id}`;
  const shoulderShift = (h % 5) - 2; // tiny variation

  // Halftone field — dot grid in a darker shade of the background accent
  const dotColor = darken(bg, 0.35);
  const dots: { x: number; y: number; r: number }[] = [];
  for (let y = 4; y < 100; y += 7) {
    for (let x = 4; x < 100; x += 7) {
      dots.push({ x, y, r: 1.3 + ((x + y) % 3) * 0.35 });
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${name} portrait`}
    >
      <defs>
        <clipPath id={clipId}>
          {rounded === 'full' ? (
            <circle cx="50" cy="50" r="50" />
          ) : (
            <rect x="0" y="0" width="100" height="100" rx="16" />
          )}
        </clipPath>
        <linearGradient id={`${clipId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={lighten(bg, 0.18)} />
          <stop offset="100%" stopColor={darken(bg, 0.2)} />
        </linearGradient>
        <linearGradient id={`${clipId}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(face, 0.25)} />
          <stop offset="100%" stopColor={darken(face, 0.25)} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Vivid halftone ground */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#${clipId}-bg)`} />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={dotColor} fillOpacity={0.55} />
        ))}

        {/* Duotone bust — shadow then teal face */}
        <g transform={`translate(${shoulderShift} 0)`}>
          <path d="M8 102 C8 74 26 66 50 66 C74 66 92 74 92 102 Z" fill="#0b0613" fillOpacity={0.92} />
          <circle cx="50" cy="42" r="22" fill="#0b0613" fillOpacity={0.92} />
          {/* Face highlight (teal), offset to suggest a light source like the cover */}
          <path d="M11 104 C11 78 28 70 50 70 C72 70 89 78 89 104 Z" fill={`url(#${clipId}-face)`} fillOpacity={0.9} />
          <circle cx="52" cy="40" r="20.5" fill={`url(#${clipId}-face)`} />
          {/* Shadow side of the face for the duotone split */}
          <path d="M52 19.5 a20.5 20.5 0 0 0 0 41 a20.5 20.5 0 0 1 0 -41" fill="#0b0613" fillOpacity={0.22} />
        </g>
      </g>

      {/* Rim light */}
      {rounded === 'full' ? (
        <circle cx="50" cy="50" r="49" fill="none" stroke={face} strokeOpacity={0.35} strokeWidth="1.4" />
      ) : (
        <rect x="0.7" y="0.7" width="98.6" height="98.6" rx="15.5" fill="none" stroke={face} strokeOpacity={0.3} strokeWidth="1.4" />
      )}

      <title>{name}</title>
    </svg>
  );
}

/** Tiny monogram chip — for dense rows where a full portrait is too heavy. */
export function PlayerChip({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const bg = accentFor(id);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-terminal-bg"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${lighten(bg, 0.2)}, ${darken(bg, 0.15)})`,
      }}
    >
      {initials(name)}
    </span>
  );
}
