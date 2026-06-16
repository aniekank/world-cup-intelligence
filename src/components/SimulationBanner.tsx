import Link from 'next/link';
import { Dices } from 'lucide-react';
import { getActiveTournamentId } from '@/data/store';

const COPY: Record<string, string> = {
  predictions:
    'These probabilities are forecasting the offline “Simulated 2026” dataset — a deterministic fantasy tournament, not the real World Cup. Switch to World Cup 2026 (live) in the top-right selector for a genuine forecast.',
  bracket:
    'This bracket is projected from the offline “Simulated 2026” dataset, not the real tournament. Switch to World Cup 2026 (live) in the top-right selector for the real knockout path.',
  groups:
    'These group odds come from the offline “Simulated 2026” dataset, not the real tournament. Switch to World Cup 2026 (live) in the top-right selector for live tables.',
  betting:
    'Heads up: there are no real bookmaker lines for a fictional tournament, so any edge / Kelly figures shown on the simulated dataset are illustrative only. Real market comparison is available on World Cup 2026 (live).',
  default:
    'You are viewing the offline “Simulated 2026” dataset — a deterministic fantasy tournament, not the real World Cup. Switch to World Cup 2026 (live) in the top-right selector for real data.',
};

/**
 * Shown only when the active dataset is the deterministic “Simulated 2026”
 * tournament, so forecast/betting numbers are never mistaken for the real
 * event. Server Component — reads the active tournament from the store.
 */
export function SimulationBanner({ context = 'default' }: { context?: keyof typeof COPY }) {
  if (getActiveTournamentId() !== 'simulation') return null;
  return (
    <div className="rounded-xl border border-accent-violet/40 bg-accent-violet/[0.08] p-4">
      <div className="flex items-start gap-3">
        <Dices className="mt-0.5 h-5 w-5 shrink-0 text-accent-violet" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-terminal-bright">
            🎲 Simulated tournament — not the live World Cup
          </p>
          <p className="text-terminal-muted">{COPY[context] ?? COPY.default}</p>
          <p className="text-xs">
            <Link href="/guide" className="text-accent hover:underline">
              New here? Read the guide →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
