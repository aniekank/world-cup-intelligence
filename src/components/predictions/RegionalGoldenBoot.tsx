'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Table, Th, Td } from '@/components/ui';
import { RegionFilter } from '@/components/RegionFilter';
import { pct } from '@/lib/format';

export interface GBRow {
  playerId: string;
  currentGoals: number;
  currentXG: number;
  projectedGoals: number;
  winProbability: number;
  player: { name: string } | null;
  team: { flag: string; code: string; confederation?: string | null } | null;
}

export function RegionalGoldenBoot({ rows }: { rows: GBRow[] }) {
  const [region, setRegion] = useState('');
  const shown = useMemo(
    () => (region ? rows.filter((g) => g.team?.confederation === region) : rows).slice(0, 12),
    [rows, region],
  );

  return (
    <div>
      <div className="px-3 py-2.5">
        <RegionFilter value={region} onChange={setRegion} />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Player</Th>
            <Th align="right">G</Th>
            <Th align="right">xG</Th>
            <Th align="right">Proj.</Th>
            <Th align="right">Win Boot</Th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 ? (
            <tr><Td className="py-6 text-center text-sm text-terminal-muted">No scorers from this region yet.</Td></tr>
          ) : shown.map((g, i) => (
            <tr key={g.playerId}>
              <Td className="tnum text-terminal-muted">{i + 1}</Td>
              <Td>
                <Link href={`/players/${g.playerId}`} className="flex items-center gap-2 hover:text-accent">
                  <span>{g.team?.flag}</span>
                  <span className="truncate text-terminal-bright">{g.player?.name ?? g.playerId}</span>
                </Link>
              </Td>
              <Td align="right" className="font-semibold">{g.currentGoals}</Td>
              <Td align="right" className="text-terminal-muted">{g.currentXG}</Td>
              <Td align="right" className="text-accent">{g.projectedGoals}</Td>
              <Td align="right">{pct(g.winProbability, 0)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
