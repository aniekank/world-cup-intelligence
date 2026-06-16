'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

/** Switch the active tournament, then jump to the dashboard to explore it. */
export function ExploreTournamentButton({ id, label }: { id: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const go = async () => {
    setLoading(true);
    try {
      await fetch('/api/tournament', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      router.push('/');
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={go}
      className="mt-auto flex items-center justify-center gap-1.5 rounded-md border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-xs font-medium text-accent hover:border-accent/40"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Explore {label} <ArrowRight className="h-3.5 w-3.5" /></>}
    </button>
  );
}
