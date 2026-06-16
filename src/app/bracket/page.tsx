import type { Metadata } from 'next';
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

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Knockout Phase"
        title="Projected Bracket"
        description="Most-likely Round-of-32 → Final path built from current projected qualifiers and seeded with standard tournament seeding. Each tie is projected with an ELO win expectancy; the higher-probability side advances through the tree."
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
  const homeWins = node.homeAdvanceProb >= node.awayAdvanceProb;
  return (
    <div className="rounded-md border border-terminal-border bg-terminal-elevated text-xs">
      <Side
        label={node.homeLabel}
        flag={node.home?.flag}
        name={node.home?.name}
        prob={node.homeAdvanceProb}
        winner={homeWins && !!node.home}
      />
      <div className="h-px bg-terminal-border" />
      <Side
        label={node.awayLabel}
        flag={node.away?.flag}
        name={node.away?.name}
        prob={node.awayAdvanceProb}
        winner={!homeWins && !!node.away}
      />
    </div>
  );
}

function Side({
  label,
  flag,
  name,
  prob,
  winner,
}: {
  label: string;
  flag?: string;
  name?: string;
  prob: number;
  winner: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${winner ? 'bg-accent/[0.08]' : ''}`}>
      <span className="w-7 shrink-0 font-mono text-[10px] text-terminal-muted">{label}</span>
      <span className="text-sm">{flag ?? '⚪'}</span>
      <span className={`flex-1 truncate ${winner ? 'font-semibold text-terminal-bright' : 'text-terminal-text'}`}>
        {name ?? 'TBD'}
      </span>
      <span className={`tnum ${winner ? 'text-accent' : 'text-terminal-muted'}`}>{pct(prob, 0)}</span>
    </div>
  );
}

export const dynamic = 'force-dynamic';
