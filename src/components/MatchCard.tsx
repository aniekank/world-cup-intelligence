import Link from 'next/link';
import type { Match, MatchPrediction, Team } from '@/domain/types';
import { Badge, LiveDot, ProbBar } from '@/components/ui';
import { LocalTime } from '@/components/LocalTime';
import { stageName, advanceProbabilities } from '@/lib/format';

export function MatchCard({
  match,
  home,
  away,
  prediction,
}: {
  match: Match;
  home: Team;
  away: Team;
  prediction?: MatchPrediction | null;
}) {
  // Live feeds can carry fixtures whose teams aren't determined yet (TBD knockout
  // slots). Never crash a whole page on one — just skip the unresolved card.
  if (!home || !away) return null;
  const live = match.status === 'LIVE' || match.status === 'HALFTIME';
  const finished = match.status === 'FINISHED';

  return (
    <Link
      href={`/matches/${match.id}`}
      className="card-interactive glass block rounded-lg border border-terminal-border p-3"
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-terminal-muted">
        <span>{match.groupId ? `Group ${match.groupId}` : stageName[match.stage]}</span>
        {live ? (
          <span className="flex items-center gap-1.5 font-semibold text-accent-red">
            <LiveDot />{' '}
            {match.livePhase === 'PEN'
              ? 'Penalties'
              : match.livePhase === 'BREAK'
                ? 'Break'
                : `${match.livePhase === 'ET' ? 'ET ' : ''}${match.minute}′`}
          </span>
        ) : finished ? (
          <span>{match.penalties ? 'FT (pens)' : 'FT'}</span>
        ) : (
          <LocalTime iso={match.kickoff} />
        )}
      </div>

      <div className="space-y-1.5">
        <TeamRow team={home} score={match.homeScore} show={live || finished} winner={finished && match.homeScore > match.awayScore} />
        <TeamRow team={away} score={match.awayScore} show={live || finished} winner={finished && match.awayScore > match.homeScore} />
      </div>

      {match.penalties && (
        <p className="mt-1.5 text-right text-[11px] text-terminal-muted">
          Penalties {match.penalties.home}–{match.penalties.away}
        </p>
      )}

      {!finished && prediction && (
        <div className="model-only mt-3 space-y-1">
          {match.stage !== 'GROUP' ? (
            // Knockout: a draw isn't a final result — show each side's chance to advance.
            (() => {
              const adv = advanceProbabilities(prediction);
              return (
                <>
                  <ProbBar home={adv.home} draw={0} away={adv.away} />
                  <div className="flex justify-between text-[10px] tnum text-terminal-muted">
                    <span>{(adv.home * 100).toFixed(0)}%</span>
                    <span className="uppercase tracking-wide text-[9px] text-terminal-muted/70">to advance</span>
                    <span>{(adv.away * 100).toFixed(0)}%</span>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <ProbBar home={prediction.homeWin} draw={prediction.draw} away={prediction.awayWin} />
              <div className="flex justify-between text-[10px] tnum text-terminal-muted">
                <span>{(prediction.homeWin * 100).toFixed(0)}%</span>
                <span>Draw {(prediction.draw * 100).toFixed(0)}%</span>
                <span>{(prediction.awayWin * 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      )}

      {match.city && (
        <p className="mt-2 truncate text-[10px] text-terminal-muted">
          {match.venue} · {match.city}
        </p>
      )}
    </Link>
  );
}

function TeamRow({ team, score, show, winner }: { team: Team; score: number; show: boolean; winner: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 truncate">
        <span className="text-base">{team.flag}</span>
        <span className={`truncate text-sm ${winner ? 'font-semibold text-terminal-bright' : 'text-terminal-text'}`}>
          {team.name}
        </span>
      </span>
      {show && <span className={`tnum text-sm ${winner ? 'font-bold text-terminal-bright' : 'text-terminal-text'}`}>{score}</span>}
    </div>
  );
}

export function MiniMatchRow({ match, home, away }: { match: Match; home: Team; away: Team }) {
  if (!home || !away) return null;
  const live = match.status === 'LIVE';
  return (
    <Link href={`/matches/${match.id}`} className="block rounded px-2 py-1.5 hover:bg-terminal-elevated">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex w-1/3 items-center justify-end gap-1.5 truncate text-right">
          <span className="truncate text-terminal-text">{home.name}</span>
          <span>{home.flag}</span>
        </span>
        <span className="tnum flex items-center gap-1 rounded bg-terminal-elevated px-2 py-0.5 text-xs font-semibold text-terminal-bright">
          {match.status === 'SCHEDULED' ? (
            <span className="text-terminal-muted">v</span>
          ) : (
            <>
              {match.homeScore}–{match.awayScore}
            </>
          )}
          {live && <LiveDot />}
        </span>
        <span className="flex w-1/3 items-center gap-1.5 truncate">
          <span>{away.flag}</span>
          <span className="truncate text-terminal-text">{away.name}</span>
        </span>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-terminal-muted">
        {live ? "Live now" : <LocalTime iso={match.kickoff} variant="clock" />}
      </div>
    </Link>
  );
}
