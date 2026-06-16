import type { Metadata } from 'next';
import { matchesView } from '@/server/queries';
import { getTeam } from '@/data/store';
import { PageHeader, Panel, Badge } from '@/components/ui';
import { MatchCard } from '@/components/MatchCard';
import { dayLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Matches' };

export default function MatchesPage() {
  // Only fixtures whose teams are resolved — TBD knockout slots have no card yet.
  const matches = matchesView().filter((m) => getTeam(m.homeTeamId) && getTeam(m.awayTeamId));
  // Group by calendar day
  const byDay = new Map<string, typeof matches>();
  for (const m of matches) {
    const day = m.kickoff.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(m);
    byDay.set(day, arr);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const liveCount = matches.filter((m) => m.status === 'LIVE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Fixtures & Results"
        title="Matches"
        description="The complete tournament schedule with live scores, win-probability bars on upcoming fixtures, and full match data on click."
        action={
          <div className="flex gap-2">
            <Badge tone="red">{liveCount} live</Badge>
            <Badge tone="accent">{matches.filter((m) => m.status === 'FINISHED').length} played</Badge>
          </div>
        }
      />

      {days.map(([day, dayMatches]) => (
        <Panel key={day} title={dayLabel(day)} subtitle={`${dayMatches.length} matches`} bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dayMatches.map((m) => (
            <MatchCard key={m.id} match={m} home={getTeam(m.homeTeamId)!} away={getTeam(m.awayTeamId)!} prediction={m.prediction} />
          ))}
        </Panel>
      ))}
    </div>
  );
}

export const dynamic = 'force-dynamic';
