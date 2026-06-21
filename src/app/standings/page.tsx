import type { Metadata } from 'next';
import Link from 'next/link';
import { standingsView } from '@/server/queries';
import { PageHeader, Panel, Table, Th, Td, Badge, FormString } from '@/components/ui';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Standings' };

export default function StandingsPage() {
  const { groups, bestThirds } = standingsView();
  // Team-level xG comes from per-match team stats, which the live feed leaves
  // empty — hide the xG line entirely rather than show "0.0 / 0.0" (WC-016).
  const hasXg = groups.some((g) => g.rows.some((r) => r.xGFor > 0 || r.xGAgainst > 0));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Group Stage"
        title="Standings"
        description="Live group tables with FIFA tiebreakers, xG context, and Monte Carlo qualification probability. Top 2 of each group plus the 8 best third-placed teams advance to the Round of 32."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(({ group, rows }) => (
          <Panel key={group.id} title={group.name} bodyClassName="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Team</Th>
                  <Th align="center">Pl</Th>
                  <Th align="center">GD</Th>
                  <Th align="center">Pts</Th>
                  <Th align="right">Q%</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.teamId}
                    className={r.rank <= 2 ? 'bg-accent/[0.04]' : ''}
                    style={{ boxShadow: `inset 3px 0 0 0 ${r.team.primaryColor}` }}
                  >
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <span className="tnum text-terminal-muted">{r.rank}</span>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            r.status === 'Q' ? 'bg-accent' : r.status === 'T' ? 'bg-accent-amber' : r.status === 'E' ? 'bg-accent-red' : 'bg-terminal-border'
                          }`}
                        />
                      </span>
                    </Td>
                    <Td>
                      <Link href={`/teams/${r.teamId}`} className="flex items-center gap-2 hover:text-accent">
                        <span>{r.team.flag}</span>
                        <span className="truncate font-medium text-terminal-bright">{r.team.code}</span>
                      </Link>
                    </Td>
                    <Td align="center">{r.played}</Td>
                    <Td align="center">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</Td>
                    <Td align="center" className="font-bold text-terminal-bright">{r.points}</Td>
                    <Td align="right">
                      <span className={r.qualificationProbability > 0.6 ? 'text-accent' : 'text-terminal-text'}>
                        {pct(r.qualificationProbability, 0)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="space-y-1 px-3 py-2">
              {rows.map((r) => (
                <div key={r.teamId} className="flex items-center gap-2 text-[10px] text-terminal-muted">
                  <span className="w-8 font-mono">{r.team.code}</span>
                  <FormString form={r.form} />
                  {hasXg && <span className="ml-auto tnum">xG {r.xGFor.toFixed(1)} / {r.xGAgainst.toFixed(1)}</span>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 border-t border-terminal-border px-3 py-2 text-[10px] text-terminal-muted">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Qualify</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent-amber" /> Thirds race</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent-red" /> Out</span>
            </div>
          </Panel>
        ))}
      </div>

      <Panel
        title="Best Third-Placed Teams"
        subtitle="The 8 highest-ranked third-placed teams qualify for the Round of 32"
        bodyClassName="p-0"
      >
        <Table>
          <thead>
            <tr>
              <Th>Rank</Th>
              <Th>Group</Th>
              <Th>Team</Th>
              <Th align="center">Pts</Th>
              <Th align="center">GD</Th>
              <Th align="center">GF</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {bestThirds.map((r, i) => (
              <tr key={r.teamId} className={i < 8 ? 'bg-accent/[0.04]' : ''}>
                <Td className="tnum">{i + 1}</Td>
                <Td>Group {r.groupId}</Td>
                <Td>
                  <Link href={`/teams/${r.teamId}`} className="flex items-center gap-2 hover:text-accent">
                    <span>{r.team.flag}</span>
                    <span className="font-medium text-terminal-bright">{r.team.name}</span>
                  </Link>
                </Td>
                <Td align="center" className="font-semibold">{r.points}</Td>
                <Td align="center">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</Td>
                <Td align="center">{r.goalsFor}</Td>
                <Td align="right">{i < 8 ? <Badge tone="accent">Qualifies</Badge> : <Badge tone="red">Out</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export const dynamic = 'force-dynamic';
