import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { rankingsView } from '@/server/queries';
import { PageHeader, Panel, Table, Th, Td, MetricBar } from '@/components/ui';
import { signed } from '@/lib/format';

export const metadata: Metadata = { title: 'Power Rankings' };

export default function RankingsPage() {
  const rows = rankingsView();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Rankings"
        title="Tournament Power Ratings"
        description="A composite strength rating blending live ELO, Monte Carlo deep-run equity, and underlying xG differential. The Momentum Index captures recent over/under-performance versus ELO expectation."
      />

      <Panel bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th></Th>
              <Th>Team</Th>
              <Th align="right">Power</Th>
              <Th>Rating</Th>
              <Th align="right">Offense</Th>
              <Th align="right">Defense</Th>
              <Th align="right">ELO</Th>
              <Th align="right">Momentum</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} className="hover:bg-terminal-elevated">
                <Td className="tnum font-bold text-terminal-bright">{r.rank}</Td>
                <Td>
                  {r.trend === 'up' ? (
                    <ArrowUp className="h-3.5 w-3.5 text-accent" />
                  ) : r.trend === 'down' ? (
                    <ArrowDown className="h-3.5 w-3.5 text-accent-red" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-terminal-muted" />
                  )}
                </Td>
                <Td>
                  <Link href={`/teams/${r.teamId}`} className="flex items-center gap-2 hover:text-accent">
                    <span className="text-base">{r.team.flag}</span>
                    <span className="font-medium text-terminal-bright">{r.team.name}</span>
                  </Link>
                </Td>
                <Td align="right" className="font-bold text-accent">{r.powerRating}</Td>
                <Td className="w-28">
                  <MetricBar value={r.powerRating} />
                </Td>
                <Td align="right">{r.offenseRating}</Td>
                <Td align="right">{r.defenseRating}</Td>
                <Td align="right" className="text-terminal-muted">{r.elo}</Td>
                <Td align="right">
                  <span className={r.momentum > 5 ? 'text-accent' : r.momentum < -5 ? 'text-accent-red' : 'text-terminal-muted'}>
                    {signed(r.momentum)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export const dynamic = 'force-dynamic';
