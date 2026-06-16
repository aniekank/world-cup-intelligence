'use client';

import { useEffect, useRef, useState } from 'react';
import { ratingColor } from '@/lib/format';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) {
          requestAnimationFrame(() => setSeen(true));
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

/** A metric bar whose fill animates from 0 → value when it scrolls into view. */
export function GrowBar({
  value,
  max = 100,
  color,
  height = 6,
  delay = 0,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  delay?: number;
}) {
  const target = Math.max(0, Math.min(100, (value / max) * 100));
  const { ref, seen } = useInView<HTMLDivElement>();
  const barColor = color ?? ratingColor(target);
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-full bg-terminal-border" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${seen ? target : 0}%`,
          backgroundColor: barColor,
          transition: `width 0.95s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        }}
      />
    </div>
  );
}

/** Win/draw/loss split bar where each segment grows in from 0. */
export function ProbSplitFill({ home, draw, away }: { home: number; draw: number; away: number }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const seg = (v: number, bg: string, title: string) => (
    <div
      style={{
        width: `${seen ? v * 100 : 0}%`,
        backgroundColor: bg,
        transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
      }}
      title={title}
    />
  );
  return (
    <div ref={ref} className="flex h-2.5 w-full overflow-hidden rounded-full bg-terminal-border">
      {seg(home, '#1fe5c4', `Home ${(home * 100).toFixed(0)}%`)}
      {seg(draw, '#6b5a86', `Draw ${(draw * 100).toFixed(0)}%`)}
      {seg(away, '#ff2e9a', `Away ${(away * 100).toFixed(0)}%`)}
    </div>
  );
}
