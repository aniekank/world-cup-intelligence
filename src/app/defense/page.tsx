import type { Metadata } from 'next';
import Link from 'next/link';
import { defenseView } from '@/server/defense';
import { PageHeader, Panel, Table, Th, Td, MetricBar, Badge } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { PlayerPortrait } from '@/components/brand/PlayerPortrait';

export const metadata: Metadata = { title: 'Defense' };

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function DefensePage() {
  const { meanest, goldenGlove, ballWinners, xgaAvailable, pressuresAvailable, hasResults } = defenseView();

  if (!hasResults) {
    return (
      <div className="space-y-6">
        <PageHeader kicker="Defense" title="The Wall" description="Stifling defenses, the goalkeepers behind them, and the tournament's best ball-winners." />
        <Panel>
          <p className="py-8 text-center text-sm text-terminal-muted">
            Defensive boards populate once matches have been played.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Defense"
        title="The Wall"
        description="Attack gets the Golden Boot and the headlines. This is the other half of the game: the meanest defenses, the goalkeepers behind them, and the players who win the ball back."
      />

      {/* ── Meanest defenses ── */}
      <Panel
        title="Meanest Defenses"
        subtitle={xgaAvailable ? 'Ranked by expected goals conceded per game' : 'Ranked by goals conceded per game'}
        bodyClassName="p-0"
      >
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th></Th>
              <Th>Team</Th>
              <Th align="right">Pld</Th>
              <Th align="right">GA</Th>
              <Th align="right">GA / game</Th>
              {xgaAvailable && <Th align="right">xGA / game</Th>}
              <Th align="right">Clean sheets</Th>
              <Th>Defense rating</Th>
            </tr>
          </thead>
          <tbody>
            {meanest.map((d, i) => (
              <tr key={d.team.id} className="hover:bg-terminal-elevated">
                <Td className="tnum font-bold text-terminal-bright">{i + 1}</Td>
                <Td><TeamCrest code={d.team.code} color={d.team.primaryColor} size={26} /></Td>
                <Td>
                  <Link href={`/teams/${d.team.id}`} className="font-semibold text-terminal-bright hover:text-accent">
                    {d.team.flag} {d.team.name}
                  </Link>
                </Td>
                <Td align="right" className="tnum text-terminal-muted">{d.played}</Td>
                <Td align="right" className="tnum">{d.goalsAgainst}</Td>
                <Td align="right" className="tnum font-semibold text-terminal-bright">{d.gaPerGame.toFixed(2)}</Td>
                {xgaAvailable && <Td align="right" className="tnum text-accent">{d.xgaPerGame.toFixed(2)}</Td>}
                <Td align="right" className="tnum">
                  {d.cleanSheets > 0 ? <Badge tone="accent">{d.cleanSheets}</Badge> : <span className="text-terminal-muted">0</span>}
                </Td>
                <Td><div className="w-28"><MetricBar value={d.defenseRating} /></div></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Golden Glove ── */}
        <Panel title="Golden Glove" subtitle="The tournament's goalkeepers" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Keeper</Th>
                <Th align="right">Saves</Th>
                <Th align="right">CS</Th>
                <Th align="right">Save %</Th>
              </tr>
            </thead>
            <tbody>
              {goldenGlove.length === 0 ? (
                <tr><Td className="py-6 text-center text-sm text-terminal-muted">No goalkeeper data yet.</Td></tr>
              ) : goldenGlove.map((g, i) => (
                <tr key={g.player.id} className="hover:bg-terminal-elevated">
                  <Td className="tnum font-bold text-terminal-bright">{i + 1}</Td>
                  <Td>
                    <Link href={`/players/${g.player.id}`} className="flex items-center gap-2.5 hover:text-accent">
                      <PlayerPortrait id={g.player.id} name={g.player.name} photo={g.player.photo} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-terminal-bright">{g.player.name}</span>
                        <span className="block text-[11px] text-terminal-muted">{g.player.team.flag} {g.player.team.code}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td align="right" className="tnum">{g.saves}</Td>
                  <Td align="right" className="tnum">{g.cleanSheets > 0 ? <span className="text-accent-teal font-semibold">{g.cleanSheets}</span> : <span className="text-terminal-muted">0</span>}</Td>
                  <Td align="right" className="tnum font-semibold text-terminal-bright">{g.saves + g.conceded > 0 ? pct(g.savePct) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        {/* ── Ball-winners ── */}
        <Panel
          title="Top Ball-Winners"
          subtitle={`Defensive actions per 90 · tackles + interceptions + duels${pressuresAvailable ? ' + pressures' : ''}`}
          bodyClassName="p-0"
        >
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Player</Th>
                <Th align="right">Tkl</Th>
                <Th align="right">Int</Th>
                <Th align="right">Duels</Th>
                <Th align="right">Per 90</Th>
              </tr>
            </thead>
            <tbody>
              {ballWinners.length === 0 ? (
                <tr><Td className="py-6 text-center text-sm text-terminal-muted">No ball-winning data yet.</Td></tr>
              ) : ballWinners.map((b, i) => (
                <tr key={b.player.id} className="hover:bg-terminal-elevated">
                  <Td className="tnum font-bold text-terminal-bright">{i + 1}</Td>
                  <Td>
                    <Link href={`/players/${b.player.id}`} className="flex items-center gap-2.5 hover:text-accent">
                      <PlayerPortrait id={b.player.id} name={b.player.name} photo={b.player.photo} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-terminal-bright">{b.player.name}</span>
                        <span className="block text-[11px] text-terminal-muted">{b.player.team.flag} {b.player.team.code} · {b.player.position}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td align="right" className="tnum text-terminal-muted">{b.tackles.toFixed(1)}</Td>
                  <Td align="right" className="tnum text-terminal-muted">{b.interceptions.toFixed(1)}</Td>
                  <Td align="right" className="tnum text-terminal-muted">{b.duelsWon.toFixed(1)}</Td>
                  <Td align="right" className="tnum font-semibold text-accent">{b.score.toFixed(1)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
