import type { Metadata } from 'next';
import Link from 'next/link';
import { bracketView } from '@/server/queries';
import { PageHeader, Panel } from '@/components/ui';
import { SimulationBanner } from '@/components/SimulationBanner';
import { pct, stageName } from '@/lib/format';
import type { MatchStage } from '@/domain/types';

export const metadata: Metadata = { title: 'Knockout Bracket' };

type Node = ReturnType<typeof bracketView>[number];

export default function BracketPage() {
  const nodes = bracketView();
  const stages: MatchStage[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
  const byStage = stages.map((s) => ({ stage: s, nodes: nodes.filter((n) => n.stage === s) }));

  // The CURRENT round = the latest one drawn from real fixtures (its nodes carry a
  // matchId) that still has ties to play; if all real ties are done, the latest
  // real round. Tracks the tournament forward (R32 → R16 → … → Final) on its own.
  const realStages = byStage.filter((b) => b.nodes.some((n) => n.matchId));
  const current =
    realStages.find((b) => b.nodes.some((n) => !n.decided)) ?? realStages[realStages.length - 1];
  const drawn = !!current;
  const curStage = current?.stage ?? 'R32';
  const curRound = current?.nodes ?? [];
  const played = curRound.filter((n) => n.decided).length;

  const description = drawn
    ? `${stageName[curStage]} shows the real draw and results — ${played} of ${curRound.length} ties played. Rounds beyond it are projected forward by ELO win expectancy until they're drawn.`
    : 'Most-likely path built from the current qualifiers under standard seeding, each tie projected by ELO win expectancy. It switches to the real draw and results once the knockout fixtures are set.';

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={drawn ? `Knockout Phase · ${stageName[curStage]} underway` : 'Knockout Phase'}
        title="Knockout Bracket"
        description={description}
      />

      <SimulationBanner context="bracket" />

      <Panel bodyClassName="overflow-x-auto p-4">
        <div className="flex min-w-[1100px] gap-6">
          {byStage.map(({ stage, nodes: stageNodes }) => (
            <div key={stage} className="flex flex-1 flex-col">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-accent">
                {stageName[stage]}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {stageNodes.map((n) => (
                  <BracketTie key={n.slot} node={n} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function BracketTie({ node }: { node: Node }) {
  const homeWins = node.winnerTeamId ? node.winnerTeamId === node.homeTeamId : node.homeAdvanceProb >= node.awayAdvanceProb;
  const inner = (
    <>
      <Side
        label={node.homeLabel}
        flag={node.home?.flag}
        name={node.home?.name}
        prob={node.homeAdvanceProb}
        score={node.decided ? node.homeScore ?? null : null}
        pens={node.penaltyWin && homeWins}
        winner={homeWins && !!node.home}
      />
      <div className="h-px bg-terminal-border" />
      <Side
        label={node.awayLabel}
        flag={node.away?.flag}
        name={node.away?.name}
        prob={node.awayAdvanceProb}
        score={node.decided ? node.awayScore ?? null : null}
        pens={node.penaltyWin && !homeWins}
        winner={!homeWins && !!node.away}
      />
    </>
  );
  const base = 'block rounded-md border border-terminal-border bg-terminal-elevated text-xs';
  // Real fixtures (R32, and any drawn round) carry a matchId → link to the match.
  // Projected ties (matchId null) stay non-clickable.
  return node.matchId ? (
    <Link href={`/matches/${node.matchId}`} className={`${base} transition-colors hover:border-accent/60`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

function Side({
  label,
  flag,
  name,
  prob,
  score,
  pens,
  winner,
}: {
  label: string;
  flag?: string;
  name?: string;
  prob: number;
  score?: number | null;
  pens?: boolean;
  winner: boolean;
}) {
  const decided = score !== null && score !== undefined;
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${winner ? 'bg-accent/[0.08]' : ''}`}>
      <span className="w-7 shrink-0 font-mono text-[10px] text-terminal-muted">{label}</span>
      <span className="text-sm">{flag ?? '⚪'}</span>
      <span className={`flex-1 truncate ${winner ? 'font-semibold text-terminal-bright' : 'text-terminal-text'}`}>
        {name ?? 'TBD'}
      </span>
      {decided ? (
        <span className={`tnum font-semibold ${winner ? 'text-accent' : 'text-terminal-muted'}`}>
          {score}
          {pens ? <span className="ml-0.5 text-[9px] font-normal">p</span> : null}
        </span>
      ) : (
        <span className={`tnum ${winner ? 'text-accent' : 'text-terminal-muted'}`}>{pct(prob, 0)}</span>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
