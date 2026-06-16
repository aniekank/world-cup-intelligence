'use client';

import { useEffect, useRef } from 'react';
import { HalftoneBurst } from './HalftoneBurst';

/**
 * Wraps the halftone burst with a subtle cursor-driven parallax — the dot field
 * drifts as the mouse moves, adding depth to the hero while the SVG keeps its
 * slow rotation. Disabled under prefers-reduced-motion.
 */
export function ParallaxBurst({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const dx = (e.clientX / window.innerWidth - 0.5) * 26;
        const dy = (e.clientY / window.innerHeight - 0.5) * 26;
        if (ref.current) ref.current.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ transition: 'transform 0.35s ease-out' }}>
      <HalftoneBurst className="h-full w-full animate-spinSlow" />
    </div>
  );
}
