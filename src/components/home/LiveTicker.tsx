import Link from 'next/link';
import { getMatches, getTeam, dataset } from '@/data/store';
import { engine } from '@/analytics';
import { LiveMinute } from './LiveMinute';

const isLive = (s: string) => s === 'LIVE' || s === 'HALFTIME';

/**
 * Broadcast-style scrolling ticker of live scores and recent results.
 * Pure-CSS marquee (pauses on hover), content duplicated for a seamless loop.
 * The minute on a live game runs as a local clock (see LiveMinute), re-anchored
 * each time the auto-refresh lands a fresh snapshot.
 */
export function LiveTicker() {
  const eng = engine();
  const generatedAt = dataset().generatedAt;
  const matches = getMatches()
    .filter((m) => isLive(m.status) || m.status === 'FINISHED')
    .sort((a, b) => (isLive(b.status) ? 1 : 0) - (isLive(a.status) ? 1 : 0))
    .slice(0, 16);

  if (matches.length === 0) return null;

  const items = matches
    .map((m) => ({ m, home: getTeam(m.homeTeamId), away: getTeam(m.awayTeamId) }))
    .filter((x) => x.home && x.away)
    .map(({ m, home: home0, away: away0 }) => {
    const home = home0!;
    const away = away0!;
    const live = isLive(m.status);
    return (
      <Link
        key={m.id}
        href={`/matches/${m.id}`}
        className="mx-3 inline-flex shrink-0 items-center gap-2 text-sm hover:text-accent"
      >
        {live && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-red" />}
        <span>{home.flag}</span>
        <span className="text-terminal-text">{home.code}</span>
        <span className="tnum font-semibold text-terminal-bright">
          {m.homeScore}–{m.awayScore}
        </span>
        <span className="text-terminal-text">{away.code}</span>
        <span>{away.flag}</span>
        {live ? (
          <span className="tnum text-[10px] text-accent-red">
            <LiveMinute minute={m.minute} status={m.status} generatedAt={generatedAt} />
          </span>
        ) : (
          <span className="text-[10px] text-terminal-muted">FT</span>
        )}
        <span className="ml-2 text-terminal-border">|</span>
      </Link>
    );
  });

  return (
    <div className="marquee-mask glass overflow-hidden rounded-lg border border-terminal-border">
      <div className="flex items-center">
        <span className="z-10 flex shrink-0 items-center gap-1.5 border-r border-terminal-border bg-terminal-elevated px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-accent-red">
          <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-red" /> Live
        </span>
        <div className="overflow-hidden py-2">
          <div className="marquee-track">
            {items}
            {items}
          </div>
        </div>
      </div>
      <span className="sr-only">{eng.generatedAt}</span>
    </div>
  );
}
