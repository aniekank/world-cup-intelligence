import type { Metadata } from 'next';
import { teamsWithForecast, competition } from '@/server/queries';
import { getActiveTournamentId } from '@/data/store';
import { getTournament } from '@/data/tournaments';
import { GlobeExplorer, type GlobeNation } from '@/components/globe/GlobeExplorer';

export const metadata: Metadata = { title: 'World Explorer' };
export const dynamic = 'force-dynamic';

export default function GlobePage() {
  const comp = competition();
  const active = getTournament(getActiveTournamentId());
  const nations: GlobeNation[] = teamsWithForecast().map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    flag: t.flag,
    color: t.primaryColor,
    group: t.groupId,
    confederation: t.confederation,
    manager: t.manager,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">World Explorer</p>
          <h1 className="text-2xl font-bold tracking-tight text-terminal-bright">
            {active?.championFlag ?? '🌍'} {comp.name}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-terminal-muted">
            Spin the planet, zoom into any continent and tap a glowing nation to open its squad,
            head coach and World Cup history. {nations.length} teams are in play.
          </p>
        </div>
      </div>
      <GlobeExplorer nations={nations} />
    </div>
  );
}
