'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, Check, Radio } from 'lucide-react';

interface T {
  id: string;
  label: string;
  short: string;
  year: number;
  gender: 'men' | 'women';
  host: string;
  source: string;
  champion?: string;
  championFlag?: string;
  coverage: 'live' | 'full' | 'historical';
  blurb: string;
}

export function TournamentSwitcher() {
  const [list, setList] = useState<T[]>([]);
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/tournament')
      .then((r) => r.json())
      .then((j) => {
        setList(j.tournaments ?? []);
        setActive(j.active ?? '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeT = list.find((t) => t.id === active);

  const choose = async (id: string) => {
    if (id === active) return setOpen(false);
    setSwitching(id);
    try {
      const res = await fetch('/api/tournament', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setActive(id);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  };

  const group = (g: 'live' | 'men' | 'women' | 'sim') =>
    list.filter((t) =>
      g === 'live' ? t.coverage === 'live' : g === 'sim' ? t.source === 'simulation' : t.gender === g && t.source !== 'simulation' && t.coverage !== 'live',
    );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-terminal-border bg-terminal-panel/70 px-3 py-1 text-xs text-terminal-bright hover:border-accent/40"
      >
        {activeT?.coverage === 'live' && <Radio className="h-3 w-3 animate-pulseDot text-accent-red" />}
        <span className="text-sm">{activeT?.championFlag ?? '🏆'}</span>
        <span className="font-medium">{activeT?.label ?? 'Tournament'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-terminal-muted" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[75vh] w-72 overflow-y-auto rounded-xl border border-terminal-border bg-terminal-elevated shadow-glow">
          {(['live', 'men', 'women', 'sim'] as const).map((g) => {
            const items = group(g);
            if (!items.length) return null;
            const label = g === 'live' ? 'Live' : g === 'men' ? "Men's World Cup" : g === 'women' ? "Women's World Cup" : 'Sandbox';
            return (
              <div key={g} className="border-b border-terminal-border last:border-0">
                <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">{label}</p>
                <div className="py-1">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => choose(t.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-terminal-panel"
                    >
                      <span className="text-base">{t.championFlag ?? '🏆'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-terminal-bright">{t.label}</span>
                        <span className="block truncate text-[11px] text-terminal-muted">{t.blurb}</span>
                      </span>
                      {switching === t.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : active === t.id ? (
                        <Check className="h-4 w-4 text-accent" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
