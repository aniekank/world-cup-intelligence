import type { Metadata } from 'next';
import Link from 'next/link';
import { standingsView, matchesView } from '@/server/queries';
import { getTeam } from '@/data/store';
import { PageHeader, Panel, Table, Th, Td, Badge } from '@/components/ui';
import { SimulationBanner } from '@/components/SimulationBanner';
import { MiniMatchRow } from '@/components/MatchCard';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Groups' };

export default function GroupsPage() {
  const { groups, settled } = standingsView();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Group Stage"
        title="Groups"
        description="All 12 groups with live tables and fixtures. Top 2 of each group advance directly; third-placed teams enter the best-thirds race for the remaining 8 Round-of-32 berths."
      />

      <SimulationBanner context="groups" />

      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map(({ group, rows }) => {
          const fixtures = matchesView({ groupId: group.id });
          return (
            <Panel key={group.id} title={group.name} bodyClassName="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Team</Th>
                    <Th align="center">Pl</Th>
                    <Th align="center">W</Th>
                    <Th align="center">D</Th>
                    <Th align="center">L</Th>
                    <Th align="center">GD</Th>
                    <Th align="center">Pts</Th>
                    {settled ? <Th align="right">Status</Th> : <Th align="right" className="model-only">Q%</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.teamId}
                      className={r.rank <= 2 ? 'bg-accent/[0.04]' : ''}
                      style={{ boxShadow: `inset 3px 0 0 0 ${r.team.primaryColor}` }}
                    >
                      <Td className="tnum text-terminal-muted">{r.rank}</Td>
                      <Td>
                        <Link href={`/teams/${r.teamId}`} className="flex items-center gap-2 hover:text-accent">
                          <span>{r.team.flag}</span>
                          <span className="font-medium text-terminal-bright">{r.team.name}</span>
                        </Link>
                      </Td>
                      <Td align="center">{r.played}</Td>
                      <Td align="center">{r.won}</Td>
                      <Td align="center">{r.drawn}</Td>
                      <Td align="center">{r.lost}</Td>
                      <Td align="center">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</Td>
                      <Td align="center" className="font-bold text-terminal-bright">{r.points}</Td>
                      {settled ? (
                        <Td align="right">{r.qualified ? <Badge tone="accent">Through</Badge> : <Badge tone="red">Out</Badge>}</Td>
                      ) : (
                        <Td align="right" className="model-only text-accent">{pct(r.qualificationProbability, 0)}</Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="border-t border-terminal-border p-2">
                {fixtures.map((m) => (
                  <MiniMatchRow key={m.id} match={m} home={getTeam(m.homeTeamId)!} away={getTeam(m.awayTeamId)!} />
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
