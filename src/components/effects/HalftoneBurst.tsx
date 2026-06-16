/**
 * Halftone burst — a circular CMYK-style dot field where dot radius grows
 * toward the centre, echoing the print texture on the cover. Deterministic SVG,
 * tinted along a teal→magenta→purple gradient. Decorative only.
 */
export function HalftoneBurst({ className }: { className?: string }) {
  const size = 240;
  const center = size / 2;
  const step = 9;
  const maxR = 3.6;
  const fieldR = center - 4;

  const dots: { cx: number; cy: number; r: number; fill: string }[] = [];
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > fieldR) continue;
      const t = 1 - dist / fieldR; // 1 at centre → 0 at edge
      const r = Math.round(Math.max(0.3, t * maxR) * 1000) / 1000;
      // hue along the gradient by angle
      const ang = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      const fill = ang < 0.34 ? '#1fe5c4' : ang < 0.67 ? '#ff2e9a' : '#9d3df0';
      dots.push({ cx: x, cy: y, r, fill });
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} />
      ))}
    </svg>
  );
}
