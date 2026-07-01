import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { matchDetail } from '@/server/queries';
import { getPlayer } from '@/data/store';
import { PageHeader, Panel, Badge, LiveDot, ProbBar } from '@/components/ui';
import { ShotMap } from '@/components/charts/ShotMap';
import { TeamBadge } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { stageName, advanceProbabilities } from '@/lib/format';
import { LocalTime } from '@/components/LocalTime';
import { WhereToWatch } from '@/components/WhereToWatch';
import { KnockoutHistoryPanel } from '@/components/match/KnockoutHistoryPanel';
import { stylesClash } from '@/server/tactics';
import type { MatchEvent } from '@/domain/types';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const d = matchDetail(params.id);
  return { title: d ? `${d.home.name} v ${d.away.name}` : 'Match' };
}

const EVENT_ICON: Record<string, string> = {
  GOAL: '⚽',
  PENALTY_GOAL: '⚽',
  OWN_GOAL: '⚽',
  PENALTY_MISS: '❌',
  YELLOW_CARD: '🟨',
  SECOND_YELLOW: '🟨',
  RED_CARD: '🟥',
  SUBSTITUTION: '🔁',
  VAR: '📺',
};

export default function MatchPage({ params }: { params: { id: string } }) {
  const d = matchDetail(params.id);
  if (!d) notFound();
  const { match, home, away, prediction, summary, preview } = d;
  const clash = stylesClash(home.id, away.id);
  const tagTone: Record<string, string> = {
    hot: 'border-accent-red/40 text-accent-red',
    high: 'border-accent-amber/40 text-accent-amber',
    mid: 'border-terminal-border text-terminal-muted',
  };
  const live = match.status === 'LIVE';
  const finished = match.status === 'FINISHED';
  const hs = match.teamStats[home.id];
  const as = match.teamStats[away.id];

  const keyEvents = match.events.filter((e) =>
    ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'PENALTY_MISS', 'YELLOW_CARD', 'SECOND_YELLOW', 'RED_CARD', 'SUBSTITUTION', 'VAR'].includes(e.type),
  );

  const statRows: { label: string; h: number; a: number; suffix?: string }[] = hs && as
    ? [
        { label: 'Possession', h: hs.possession, a: as.possession, suffix: '%' },
        { label: 'Shots', h: hs.shots, a: as.shots },
        { label: 'On target', h: hs.shotsOnTarget, a: as.shotsOnTarget },
        { label: 'xG', h: hs.xG, a: as.xG },
        { label: 'Big chances', h: hs.bigChances, a: as.bigChances },
        { label: 'Corners', h: hs.corners, a: as.corners },
        { label: 'Field tilt', h: hs.fieldTilt, a: as.fieldTilt, suffix: '%' },
        { label: 'Pass acc.', h: hs.passAccuracy, a: as.passAccuracy, suffix: '%' },
        { label: 'PPDA', h: hs.ppda, a: as.ppda },
        { label: 'Fouls', h: hs.fouls, a: as.fouls },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader kicker={match.groupId ? `Group ${match.groupId}` : stageName[match.stage]} title={`${home.name} v ${away.name}`} description={`${match.venue} · ${match.city}`} />

      {/* Scoreboard */}
      <Panel bodyClassName="py-6">
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          <div className="flex flex-1 flex-col items-end gap-2 text-right">
            <TeamCrest code={home.code} color={home.primaryColor} size={68} className="crest-hover cursor-pointer drop-shadow-lg" />
            <TeamBadge team={home} href showName />
          </div>
          <div className="flex flex-col items-center">
            {live && <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-accent-red"><LiveDot /> {match.minute}′</span>}
            {finished && <span className="mb-1 text-xs text-terminal-muted">Full time</span>}
            {match.status === 'SCHEDULED' && <span className="mb-1 text-xs text-terminal-muted"><LocalTime iso={match.kickoff} /></span>}
            <div className="tnum text-5xl font-bold text-terminal-bright">
              {match.status === 'SCHEDULED' ? <span className="text-terminal-muted">vs</span> : `${match.homeScore} – ${match.awayScore}`}
            </div>
            {match.penalties && <span className="mt-1 text-xs text-terminal-muted">pens {match.penalties.home}–{match.penalties.away}</span>}
            {match.homeScoreHT + match.awayScoreHT > 0 && <span className="mt-1 text-[11px] text-terminal-muted">HT {match.homeScoreHT}–{match.awayScoreHT}</span>}
          </div>
          <div className="flex flex-1 flex-col items-start gap-2">
            <TeamCrest code={away.code} color={away.primaryColor} size={68} className="crest-hover cursor-pointer drop-shadow-lg" />
            <TeamBadge team={away} href showName />
          </div>
        </div>

        {match.formations && (
          <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-3 text-xs text-terminal-muted">
            <span className="tnum font-semibold text-terminal-bright">{match.formations.home}</span>
            <span className="uppercase tracking-widest text-[10px]">formations</span>
            <span className="tnum font-semibold text-terminal-bright">{match.formations.away}</span>
          </div>
        )}

        {(match.referee || match.weather) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-terminal-muted">
            {match.referee && <span>🧑‍⚖️ {match.referee}</span>}
            {match.weather && match.weather.description && (
              <span>🌦️ {match.weather.tempC}°C · {match.weather.description}</span>
            )}
          </div>
        )}

        {!finished && prediction && (
          <div className="model-only mx-auto mt-6 max-w-md">
            {match.stage !== 'GROUP' ? (() => {
              // Knockout: fold the draw into each side's chance to advance (ET + pens).
              const adv = advanceProbabilities(prediction);
              return (
                <>
                  <ProbBar home={adv.home} draw={0} away={adv.away} />
                  <div className="mt-1 flex justify-between text-xs tnum text-terminal-muted">
                    <span>{home.code} {(adv.home * 100).toFixed(0)}%</span>
                    <span className="uppercase tracking-wide text-[10px] text-terminal-muted/70">to advance</span>
                    <span>{away.code} {(adv.away * 100).toFixed(0)}%</span>
                  </div>
                </>
              );
            })() : (
              <>
                <ProbBar home={prediction.homeWin} draw={prediction.draw} away={prediction.awayWin} />
                <div className="mt-1 flex justify-between text-xs tnum text-terminal-muted">
                  <span>{home.code} {(prediction.homeWin * 100).toFixed(0)}%</span>
                  <span>Draw {(prediction.draw * 100).toFixed(0)}%</span>
                  <span>{away.code} {(prediction.awayWin * 100).toFixed(0)}%</span>
                </div>
              </>
            )}
            <div className="mt-2 flex justify-center gap-2">
              <Badge>xG {prediction.expectedGoals.home} – {prediction.expectedGoals.away}</Badge>
              <Badge tone="blue">O2.5 {(prediction.over25Prob * 100).toFixed(0)}%</Badge>
              <Badge tone="violet">BTTS {(prediction.bttsProb * 100).toFixed(0)}%</Badge>
            </div>
          </div>
        )}
      </Panel>

      {preview ? (
        <Panel title="What's at stake" subtitle="Why this one matters">
          {preview.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {preview.tags.map((t, i) => (
                <span
                  key={i}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagTone[t.tone] ?? tagTone.mid}`}
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm leading-relaxed text-terminal-text">{preview.blurb}</p>
        </Panel>
      ) : (
        <Panel title="Match Report" subtitle="AI-generated">
          <p className="text-sm leading-relaxed text-terminal-text">{summary}</p>
        </Panel>
      )}

      {clash && (
        <Panel title="Styles" subtitle="Tactical identities">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <TeamCrest code={home.code} color={home.primaryColor} size={20} /> <Badge tone="violet">{clash.home}</Badge>
            </span>
            <span className="text-xs text-terminal-muted">vs</span>
            <span className="flex items-center gap-1.5">
              <TeamCrest code={away.code} color={away.primaryColor} size={20} /> <Badge tone="violet">{clash.away}</Badge>
            </span>
          </div>
          <p className="text-sm leading-relaxed text-terminal-text">{clash.line}</p>
        </Panel>
      )}

      {/* Past World Cups: meetings, pedigree, shootouts, legends (live knockout ties only) */}
      <KnockoutHistoryPanel home={home} away={away} stage={match.stage} />

      {preview?.h2h && preview.h2h.meetings.length > 0 && (
        <Panel title="Head to head" subtitle={preview.h2h.line}>
          <div className="space-y-1">
            {preview.h2h.meetings.map((g, i) => {
              const homeWon = g.homeScore > g.awayScore, awayWon = g.awayScore > g.homeScore;
              return (
                <div key={i} className="flex items-center gap-3 border-b border-terminal-border/50 py-1.5 text-sm last:border-0">
                  <span className="w-10 shrink-0 tnum text-xs text-terminal-muted">{g.date.slice(0, 4)}</span>
                  <span className={`flex-1 text-right ${homeWon ? 'font-semibold text-terminal-bright' : 'text-terminal-text'}`}>{g.homeCode.toUpperCase()}</span>
                  <span className="tnum shrink-0 rounded bg-terminal-elevated px-2 py-0.5 text-xs font-semibold text-terminal-bright">{g.homeScore}–{g.awayScore}</span>
                  <span className={`flex-1 ${awayWon ? 'font-semibold text-terminal-bright' : 'text-terminal-text'}`}>{g.awayCode.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {match.tvListings && match.tvListings.length > 0 && (
        <Panel title="Where to watch" subtitle="International TV listings · via SportMonks">
          <WhereToWatch listings={match.tvListings} />
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {statRows.length > 0 && (
          <Panel title="Match Stats" subtitle={`${home.code} vs ${away.code}`}>
            <div className="space-y-3">
              {statRows.map((r) => (
                <StatComparison key={r.label} {...r} />
              ))}
            </div>
          </Panel>
        )}

        <Panel title="Timeline" subtitle="Key events">
          {keyEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-terminal-muted">No events yet.</p>
          ) : (
            <ul className="space-y-2">
              {keyEvents.map((e) => (
                <EventRow key={e.id} event={e} homeId={home.id} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {hs && as && (match.shots.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={`${home.name} — Shot Map`} subtitle={`${match.shots.filter((s) => s.teamId === home.id).length} shots`}>
            <ShotMap shots={match.shots.filter((s) => s.teamId === home.id)} />
          </Panel>
          <Panel title={`${away.name} — Shot Map`} subtitle={`${match.shots.filter((s) => s.teamId === away.id).length} shots`}>
            <ShotMap shots={match.shots.filter((s) => s.teamId === away.id)} />
          </Panel>
        </div>
      )}
    </div>
  );
}

function StatComparison({ label, h, a, suffix = '' }: { label: string; h: number; a: number; suffix?: string }) {
  const total = h + a || 1;
  const hPct = (h / total) * 100;
  const hLead = h >= a;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className={`tnum ${hLead ? 'font-semibold text-terminal-bright' : 'text-terminal-muted'}`}>{round(h)}{suffix}</span>
        <span className="text-terminal-muted">{label}</span>
        <span className={`tnum ${!hLead ? 'font-semibold text-terminal-bright' : 'text-terminal-muted'}`}>{round(a)}{suffix}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-terminal-border">
        <div style={{ width: `${hPct}%`, backgroundColor: '#1fe5c4' }} />
        <div style={{ width: `${100 - hPct}%`, backgroundColor: '#ff2e9a' }} />
      </div>
    </div>
  );
}

function EventRow({ event, homeId }: { event: MatchEvent; homeId: string }) {
  const player = event.playerId ? getPlayer(event.playerId) : null;
  const isHome = event.teamId === homeId;
  return (
    <li className={`flex items-center gap-2 text-sm ${isHome ? '' : 'flex-row-reverse text-right'}`}>
      <span className="tnum w-8 shrink-0 text-xs text-terminal-muted">{event.minute}′</span>
      <span>{EVENT_ICON[event.type] ?? '•'}</span>
      <span className="text-terminal-text">
        {player?.name ?? event.detail}
        {/* VAR / own-goal carry the meaning in the detail string — always show it */}
        {(event.type === 'VAR' || event.type === 'OWN_GOAL' || event.type === 'PENALTY_MISS') && (
          <span className="text-terminal-muted"> — {event.detail}</span>
        )}
      </span>
    </li>
  );
}

const round = (v: number) => (Number.isInteger(v) ? v : v.toFixed(1));

export const dynamic = 'force-dynamic';
