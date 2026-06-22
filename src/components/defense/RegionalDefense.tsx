'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Panel, Table, Th, Td, MetricBar, Badge } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { PlayerPortrait } from '@/components/brand/PlayerPortrait';
import { RegionFilter } from '@/components/RegionFilter';
import type { DefenseData } from '@/server/defense';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function RegionalDefense({ data }: { data: DefenseData }) {
  const { meanest, goldenGlove, ballWinners, xgaAvailable, pressuresAvailable } = data;
  const [region, setRegion] = useState('');

  const m = useMemo(() => (region ? meanest.filter((d) => d.team.confederation === region) : meanest), [meanest, region]);
  const gg = useMemo(() => (region ? goldenGlove.filter((g) => g.player.team.confederation === region) : goldenGlove), [goldenGlove, region]);
  const bw = useMemo(() => (region ? ballWinners.filter((b) => b.player.team.confederation === region) : ballWinners), [ballWinners, region]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-terminal-muted">Filter the boards by confederation</span>
        <RegionFilter value={region} onChange={setRegion} />
      </div>

      {/* Meanest defenses */}
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
            {m.length === 0 ? (
              <tr><Td className="py-6 text-center text-sm text-terminal-muted">No teams from this region have played yet.</Td></tr>
            ) : m.map((d, i) => (
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
        {/* Golden Glove */}
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
              {gg.length === 0 ? (
                <tr><Td className="py-6 text-center text-sm text-terminal-muted">No goalkeeper data for this region.</Td></tr>
              ) : gg.map((g, i) => (
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

        {/* Ball-winners */}
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
              {bw.length === 0 ? (
                <tr><Td className="py-6 text-center text-sm text-terminal-muted">No ball-winning data for this region.</Td></tr>
              ) : bw.map((b, i) => (
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
