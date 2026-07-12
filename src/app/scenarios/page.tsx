import type { Metadata } from 'next';
import Link from 'next/link';
import { deepRoundsView, type DeepTie, type DeepSide } from '@/server/deepRounds';
import { PageHeader, Panel } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { LocalTime } from '@/components/LocalTime';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'The Business End' };

export default function ScenariosPage() {
  const { stageLabel, ties, biggestId } = deepRoundsView();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The Business End"
        title={stageLabel ? `${stageLabel} — previews & the title picture` : 'The deep rounds'}
        description="Comprehensive previews for the deep knockout ties, with the conditional title math: for each side, the model's title odds now versus if they win tonight — and the run that ends for whoever loses. Advance odds from the per-match model; title odds from the 8,000-run Monte Carlo."
      />

      {ties.length === 0 ? (
        <Panel>
          <p className="py-10 text-center text-sm text-terminal-muted">
            The tournament hasn&rsquo;t reached the business end yet — this fills in the moment the deep knockout ties (round of 16 onward) are drawn and scheduled.
          </p>
        </Panel>
      ) : (
        ties.map((t) => <TieCard key={t.id} t={t} biggest={t.id === biggestId && ties.length > 1} />)
      )}
    </div>
  );
}

function TieCard({ t, biggest }: { t: DeepTie; biggest: boolean }) {
  const { home, away } = t;
  const advH = Math.round(home.advance * 100);
  const advA = 100 - advH;
  const favName = t.favorite === 'home' ? home.name : t.favorite === 'away' ? away.name : null;

  return (
    <Panel bodyClassName="p-0">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-terminal-muted">
          <span>{t.stage === 'FINAL' ? 'Final' : t.stage === 'SF' ? 'Semi-final' : t.stage === 'QF' ? 'Quarter-final' : t.stage === 'R16' ? 'Round of 16' : 'Round of 32'}</span>
          {biggest && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Tie of the round</span>}
        </div>
        <div className="text-[11px] text-terminal-muted">
          {t.scheduleTbc ? (
            // Pairing decided by results; the provider hasn't published the fixture yet. (WC-086)
            <span className="rounded bg-terminal-elevated px-1.5 py-0.5">Matchup confirmed · kickoff &amp; venue TBC</span>
          ) : (
            <><LocalTime iso={t.kickoff} /> · {t.venue}{t.city ? `, ${t.city}` : ''}</>
          )}
        </div>
      </div>

      {/* matchup + advance bar */}
      <div className="px-4 py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <TeamName side={home} align="left" />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">to advance</span>
          <TeamName side={away} align="right" />
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">
          <div style={{ width: `${advH}%`, background: home.color }} />
          <div style={{ width: `${advA}%`, background: away.color }} />
        </div>
        <div className="mt-1 flex justify-between text-xs tnum">
          <span className="font-semibold text-terminal-bright">{advH}%</span>
          {favName ? <span className="text-terminal-muted">{favName} favoured</span> : <span className="text-terminal-muted">too close to call</span>}
          <span className="font-semibold text-terminal-bright">{advA}%</span>
        </div>
      </div>

      {/* the conditional title picture — the centrepiece */}
      <div className="model-only border-t border-terminal-border bg-terminal-panel/40 px-4 py-3">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
          Title stakes
          <span className="rounded bg-terminal-elevated px-1.5 py-0.5 text-[10px] font-normal tracking-normal text-terminal-muted">{pct(t.atStake, 1)} of the trophy on the line</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <StakeRow side={home} stage={t.stage} />
          <StakeRow side={away} stage={t.stage} />
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-terminal-muted">{stakesSentence(t)}</p>
      </div>

      {/* model read + paths */}
      <div className="grid gap-px border-t border-terminal-border bg-terminal-border/60 sm:grid-cols-2">
        <div className="bg-terminal-panel/40 px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">The model&rsquo;s read</p>
          <p className="text-sm text-terminal-text">
            Expected goals <span className="tnum font-semibold text-terminal-bright">{t.egHome.toFixed(2)}–{t.egAway.toFixed(2)}</span>
            {/* The scoreline is the mode of the REGULATION score matrix — a knockout tie
                can't end level, so say "after 90′" or readers hear "predicts a draw".
                Advance %s already fold the draw mass into ET/pens (advanceProbabilities). */}
            {t.likely && <> · most likely after 90&prime; <span className="tnum font-semibold text-terminal-bright">{t.likely.home}–{t.likely.away}</span> <span className="text-terminal-muted">({pct(t.likely.prob, 0)})</span></>}
          </p>
        </div>
        <div className="bg-terminal-panel/40 px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">How they got here</p>
          <div className="space-y-1 text-xs">
            <PathLine side={home} />
            <PathLine side={away} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TeamName({ side, align }: { side: DeepSide; align: 'left' | 'right' }) {
  return (
    <Link href={`/teams/${side.id}`} className={`flex min-w-0 items-center gap-2 hover:text-accent ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <TeamCrest code={side.code} color={side.color} size={26} />
      <span className="truncate text-base font-bold text-terminal-bright">{side.name}</span>
    </Link>
  );
}

function StakeRow({ side, stage }: { side: DeepSide; stage: DeepTie['stage'] }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-panel/40 px-3 py-2">
      <span className="text-base">{side.flag}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-terminal-text">{side.name}</span>
      <span className="tnum text-xs text-terminal-muted">{pct(side.title, 1)}</span>
      <span className="text-terminal-muted">→</span>
      <span className="tnum text-sm font-bold" style={{ color: side.color }} title={stage === 'FINAL' ? 'wins the trophy' : 'title odds if they win this tie'}>
        {pct(side.titleIfWin, side.titleIfWin >= 0.1 ? 0 : 1)}
      </span>
    </div>
  );
}

function PathLine({ side }: { side: DeepSide }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{side.flag}</span>
      <span className="w-10 shrink-0 truncate font-semibold text-terminal-text">{side.code}</span>
      {side.path.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {side.path.map((w, i) => (
            <span key={i} className="tnum rounded bg-terminal-elevated px-1.5 py-0.5 text-[10px] text-terminal-muted">
              def {w.opp} {w.score}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-[11px] text-terminal-muted">first knockout tie</span>
      )}
    </div>
  );
}

/** A grounded one-liner describing what's at stake, driven by the numbers. */
function stakesSentence(t: DeepTie): string {
  const { home, away, stage } = t;
  const fav = home.advance >= away.advance ? home : away;
  const dog = fav === home ? away : home;
  if (stage === 'FINAL') {
    return `One match for everything: ${fav.name} are favoured, but the winner lifts the trophy and the loser goes home as runners-up.`;
  }
  const favJump = `${pct(fav.title, 1)} → ${pct(fav.titleIfWin, fav.titleIfWin >= 0.1 ? 0 : 1)}`;
  const tight = Math.abs(home.advance - away.advance) < 0.12;
  const lead = tight ? `A coin-flip` : `${fav.name} are favoured`;
  return `${lead}. Win, and ${fav.name}'s title odds move ${favJump}; lose, and a ${pct(fav.title, 1)} title run ends tonight. ${dog.name} are the ones who could blow the bracket open — ${pct(dog.title, 1)} now, ${pct(dog.titleIfWin, dog.titleIfWin >= 0.1 ? 0 : 1)} if they pull it off.`;
}

export const dynamic = 'force-dynamic';
