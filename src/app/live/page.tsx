import type { Metadata } from 'next';
import { liveMatches, matchesView } from '@/server/queries';
import { getTeam } from '@/data/store';
import { PageHeader, Panel, EmptyState, LiveDot } from '@/components/ui';
import { MatchCard } from '@/components/MatchCard';

export const metadata: Metadata = { title: 'Live Match Center' };
// Live data: revalidate frequently
export const revalidate = 15;

export default function LivePage() {
  const live = liveMatches();
  const upcoming = matchesView({ status: 'SCHEDULED' })
    .map((m) => ({ m, home: getTeam(m.homeTeamId), away: getTeam(m.awayTeamId) }))
    .filter((x) => x.home && x.away)
    .slice(0, 9);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Live Match Center"
        title={
          <span className="flex items-center gap-3">
            Live Now <LiveDot />
          </span>
        }
        description="Real-time scores, momentum, and key stats from every in-play match. Click a match for the full live event feed, shot maps, and win-probability swing."
      />

      <Panel title="In Play" subtitle={`${live.length} matches live`} bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {live.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState>No matches are live right now. Check the schedule below.</EmptyState>
          </div>
        ) : (
          live.map((m) => <MatchCard key={m.id} match={m} home={m.home} away={m.away} />)
        )}
      </Panel>

      <Panel title="Up Next" subtitle="Scheduled fixtures" bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {upcoming.map(({ m, home, away }) => (
          <MatchCard key={m.id} match={m} home={home!} away={away!} prediction={m.prediction} />
        ))}
      </Panel>
    </div>
  );
}

export const dynamic = 'force-dynamic';
