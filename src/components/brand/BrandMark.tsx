/**
 * WC26 Intelligence logo mark — a halftone disc in the cover gradient with a
 * trophy glyph. Used in the sidebar and anywhere the brand needs a real mark
 * instead of the 🏆 emoji.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  // Round trig output so server and client render byte-identical SVG (no hydration mismatch)
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const dots = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return { x: r3(50 + Math.cos(a) * 40), y: r3(50 + Math.sin(a) * 40), r: 1.4 + (i % 3) * 0.5 };
  });
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label="WC26 Intelligence">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff2e9a" />
          <stop offset="38%" stopColor="#9d3df0" />
          <stop offset="70%" stopColor="#1fe5c4" />
          <stop offset="100%" stopColor="#a8e020" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#0b0613" />
      <circle cx="50" cy="50" r="48" fill="url(#bm-g)" opacity="0.22" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="url(#bm-g)" />
      ))}
      <path
        d="M34 30 h32 v9 a16 16 0 0 1 -32 0 z M44 60 h12 v6 H44 z M40 66 h20 v5 H40 z"
        fill="#f6f1ff"
      />
      <path d="M30 32 h6 v5 a8 8 0 0 1 -6 -5 z M64 32 h6 a8 8 0 0 1 -6 5 z" fill="#1fe5c4" />
    </svg>
  );
}
