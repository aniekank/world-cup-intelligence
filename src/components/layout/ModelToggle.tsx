'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Global "real vs model" switch. Real data (live scores, results, standings) is
 * shown by default; ELO / Monte-Carlo PREDICTIONS are hidden until this is on.
 * Visibility is pure CSS — every prediction surface carries `.model-only`, and
 * `html:not([data-show-model="on"]) .model-only { display:none }` (globals.css)
 * hides it. We just flip the attribute + persist it; an inline script in the
 * layout sets it before first paint so there's no flash.
 */
export function ModelToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(document.documentElement.dataset.showModel === 'on');
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.dataset.showModel = next ? 'on' : 'off';
    try {
      localStorage.setItem('wc:showModel', next ? 'on' : 'off');
    } catch {
      /* private mode — non-fatal */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? 'Hide ELO / Monte-Carlo predictions — show real data only' : 'Overlay ELO / Monte-Carlo predictions'}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
        on ? 'border-accent/50 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:text-terminal-bright'
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Predictions</span>
      <span
        className={`flex h-3.5 w-6 items-center rounded-full px-0.5 transition-colors ${
          on ? 'justify-end bg-accent/50' : 'justify-start bg-terminal-border'
        }`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      </span>
    </button>
  );
}
