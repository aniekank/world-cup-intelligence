import { knockoutHistory, type TeamHistory } from '@/server/knockoutHistory';
import { getActiveTournamentId } from '@/data/store';
import { Panel } from '@/components/ui';

const STAGE_LABEL: Record<string, string> = {
  R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD_PLACE: '3rd place', FINAL: 'Final',
};

// How often a team has reached AT LEAST this round, phrased for the panel.
function reachAtStage(stage: string, h: TeamHistory): { n: number; label: string } {
  if (stage === 'FINAL') return { n: h.finals, label: 'finals reached' };
  if (stage === 'SF' || stage === 'THIRD_PLACE') return { n: h.reachedSF, label: 'semis reached' };
  if (stage === 'QF') return { n: h.reachedQF, label: 'quarters reached' };
  return { n: h.reachedR16, label: 'knockouts reached' };
}

/**
 * "World Cup history" for a live knockout tie — past meetings, each side's
 * pedigree at this round, all-time shootout records, and their WC legends. Only
 * renders for the live tournament's knockout matches (historical editions have
 * their own context, and a past match shouldn't cite later results). Async server
 * component: the history index is mined from the archive on first use + memoized.
 */
export async function KnockoutHistoryPanel({
  home,
  away,
  stage,
}: {
  home: { name: string; flag: string };
  away: { name: string; flag: string };
  stage: string;
}) {
  if (stage === 'GROUP' || getActiveTournamentId() !== 'live-2026') return null;
  const { meetings, teamA, teamB } = await knockoutHistory(home.name, away.name, 'men');
  if (!teamA && !teamB && meetings.length === 0) return null;

  return (
    <Panel title="World Cup history" subtitle="How this tie sits in the tournament's past">
      {meetings.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
            Met {meetings.length === 1 ? 'once' : `${meetings.length} times`} before at the World Cup
          </p>
          <ul className="space-y-1.5 text-sm">
            {meetings.map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="tnum w-9 shrink-0 text-terminal-muted">{m.year}</span>
                <span className="w-20 shrink-0 text-[11px] text-terminal-muted">{STAGE_LABEL[m.stage] ?? m.stage}</span>
                <span className="flex-1 truncate text-terminal-text">
                  {m.homeFlag} {m.homeName}{' '}
                  <span className="tnum font-semibold text-terminal-bright">{m.homeScore}–{m.awayScore}</span>{' '}
                  {m.awayName} {m.awayFlag}
                  {m.penalties && (
                    <span className="text-[11px] text-terminal-muted"> ({m.penalties.home}–{m.penalties.away} pens)</span>
                  )}
                </span>
                {m.winnerName && <span className="shrink-0 text-[11px] text-accent">{m.winnerName} ✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Pedigree team={home} h={teamA} stage={stage} />
        <Pedigree team={away} h={teamB} stage={stage} />
      </div>
    </Panel>
  );
}

function Pedigree({ team, h, stage }: { team: { name: string; flag: string }; h: TeamHistory | null; stage: string }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-elevated p-3">
      <p className="mb-2 flex items-center gap-2 font-semibold text-terminal-bright">
        <span>{team.flag}</span> {team.name}
      </p>
      {!h || h.appearances === 0 ? (
        <p className="text-xs text-terminal-muted">First taste of the World Cup knockouts — no history to lean on.</p>
      ) : (
        <ul className="space-y-1 text-xs text-terminal-text">
          <li>
            <span className="text-terminal-muted">Best finish:</span>{' '}
            <span className="font-medium text-terminal-bright">{h.bestFinish}</span>
            {h.bestFinishYear ? <span className="text-terminal-muted"> ({h.bestFinishYear})</span> : null}
            {h.titles > 0 ? <span className="text-accent"> · {h.titles}× champions</span> : null}
          </li>
          <li>
            <span className="text-terminal-muted">{reachAtStage(stage, h).label}:</span>{' '}
            <span className="tnum font-medium text-terminal-bright">{reachAtStage(stage, h).n}</span>
            <span className="text-terminal-muted"> · {h.appearances} tournaments</span>
          </li>
          <li>
            <span className="text-terminal-muted">Shootouts:</span>{' '}
            {h.shootouts.won + h.shootouts.lost === 0 ? (
              <span className="text-terminal-muted">none</span>
            ) : (
              <span className="font-medium text-terminal-bright">
                {h.shootouts.won}–{h.shootouts.lost}
                <span className="text-terminal-muted"> W–L</span>
              </span>
            )}
          </li>
          {h.legends.length > 0 && (
            <li className="text-terminal-muted">
              Legends:{' '}
              {h.legends.map((l, i) => (
                <span key={i} className="text-terminal-text">
                  {i > 0 ? ', ' : ''}
                  {l.name} <span className="tnum text-terminal-muted">{l.goals}</span>
                </span>
              ))}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
