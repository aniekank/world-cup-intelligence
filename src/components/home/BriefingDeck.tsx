'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { BriefingCard } from '@/ai/narratives';

const ROTATE_MS = 8_000;

/**
 * The home hero, as a rotating deck. Cycles through deep stories — title race,
 * live recaps, recent results, golden boot, the meanest defense, marquee
 * fixtures — one every 8s, with a progress bar, dot nav, prev/next, hover-pause
 * and a play/pause toggle. Auto-rotation is disabled under reduced-motion; the
 * controls still work. Falls back to a single static card when only one exists.
 */
export function BriefingDeck({ cards }: { cards: BriefingCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Bump on every manual nav so the progress bar restarts cleanly.
  const [tick, setTick] = useState(0);

  const count = cards.length;
  const safeIndex = count ? index % count : 0;
  const card = cards[safeIndex];

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const go = useCallback((next: number) => {
    setIndex((i) => {
      const n = count ? (next + count) % count : 0;
      return n === i ? i : n;
    });
    setTick((t) => t + 1);
  }, [count]);

  const running = !paused && !hover && !reduced && count > 1;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => go(safeIndex + 1), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [running, safeIndex, tick, go]);

  if (!card) return null;
  const accent = card.accent ?? '#22e0d0';

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="region"
      aria-label="Daily intelligence briefing"
              aria-roledescription="carousel"
    >
      {/* Header row: brand label + current story kicker + auto-rotate toggle */}
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
        <Brain className="h-3.5 w-3.5 text-accent" />
        <span className="text-manifesto-anim">Daily Intelligence Briefing</span>
        <span className="hidden h-3 w-px bg-terminal-border sm:inline-block" />
        <span className="hidden tracking-wide sm:inline" style={{ color: accent }}>{card.kicker}</span>
        {count > 1 && !reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="ml-auto flex items-center gap-1 rounded-full border border-terminal-border px-2 py-0.5 text-[10px] text-terminal-muted transition hover:border-accent/40 hover:text-terminal-bright"
            aria-label={paused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
          >
            {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
            {paused ? 'Paused' : 'Auto'}
          </button>
        )}
      </div>

      {/* Rotating body — re-keyed per card so it fades on change */}
      <div key={card.id} className="wci-deck-fade">
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-terminal-bright sm:text-4xl">
          {card.headline}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-terminal-muted sm:text-base">{card.body}</p>
        {card.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {card.tags.map((t, i) => (
              <Badge key={t + i} tone={i === 0 ? 'accent' : 'default'}>
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {count > 1 && (
        <>
          {/* Progress bar — restarts each card, pauses with the deck */}
          <div className="mt-5 h-0.5 w-full overflow-hidden rounded-full bg-terminal-border/60">
            {running ? (
              <div
                key={`${safeIndex}-${tick}`}
                className="wci-deck-progress h-full rounded-full"
                style={{ background: accent }}
              />
            ) : (
              <div className="h-full rounded-full" style={{ width: `${((safeIndex + 1) / count) * 100}%`, background: accent, opacity: 0.5 }} />
            )}
          </div>

          {/* Dots + prev/next */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {cards.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Story ${i + 1}: ${c.kicker}`}
                  aria-current={i === safeIndex}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === safeIndex ? 18 : 6,
                    background: i === safeIndex ? accent : 'var(--terminal-border, #2a2a3a)',
                  }}
                />
              ))}
            </div>
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => go(safeIndex - 1)}
                className="rounded-full border border-terminal-border p-1 text-terminal-muted transition hover:border-accent/40 hover:text-terminal-bright"
                aria-label="Previous story"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="tnum w-9 text-center text-[11px] text-terminal-muted">{safeIndex + 1}/{count}</span>
              <button
                type="button"
                onClick={() => go(safeIndex + 1)}
                className="rounded-full border border-terminal-border p-1 text-terminal-muted transition hover:border-accent/40 hover:text-terminal-bright"
                aria-label="Next story"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        </>
      )}

      <style jsx>{`
        .wci-deck-fade {
          animation: wciDeckFade 0.5s ease;
        }
        @keyframes wciDeckFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wci-deck-progress {
          animation: wciDeckProgress ${ROTATE_MS}ms linear forwards;
        }
        @keyframes wciDeckProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wci-deck-fade { animation: none; }
        }
      `}</style>
    </div>
  );
}
