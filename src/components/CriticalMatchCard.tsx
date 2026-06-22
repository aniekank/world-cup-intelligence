import Link from 'next/link';
import type { Team, MatchPrediction } from '@/domain/types';
import type { MatchPreview } from '@/ai/previews';
import { LocalTime } from '@/components/LocalTime';
import { stageName } from '@/lib/format';

const TONE: Record<string, string> = {
  hot: 'border-accent-red/40 text-accent-red',
  high: 'border-accent-amber/40 text-accent-amber',
  mid: 'border-terminal-border text-terminal-muted',
};

export function CriticalMatchCard({
  p,
}: {
  p: MatchPreview & { home: Team; away: Team; prediction: MatchPrediction | null };
}) {
  const edgeCode = p.edge.side === 'home' ? p.home.code : p.edge.side === 'away' ? p.away.code : null;
  return (
    <Link
      href={`/matches/${p.matchId}`}
      className="card-interactive glass block rounded-lg border border-terminal-border p-4"
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-terminal-muted">
        <span>
          {p.groupId ? `Group ${p.groupId}` : stageName[p.stage]} · <LocalTime iso={p.kickoff} variant="clock" />
        </span>
        {edgeCode ? (
          <span className="tnum font-semibold text-terminal-text">
            {edgeCode} {Math.round(p.edge.prob * 100)}%
          </span>
        ) : (
          <span>too close</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-terminal-bright">
        <span className="text-base">{p.home.flag}</span>
        <span className="truncate">{p.home.name}</span>
        <span className="px-1 text-xs font-normal text-terminal-muted">v</span>
        <span className="text-base">{p.away.flag}</span>
        <span className="truncate">{p.away.name}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {p.tags.map((t, i) => (
          <span
            key={i}
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[t.tone] ?? TONE.mid}`}
          >
            {t.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-terminal-muted">{p.blurb}</p>
      {p.h2h && <p className="mt-1.5 text-[11px] text-terminal-muted/80">↔ {p.h2h.line}</p>}
    </Link>
  );
}
