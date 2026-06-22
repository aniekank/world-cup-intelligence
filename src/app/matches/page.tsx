import type { Metadata } from 'next';
import { matchesView } from '@/server/queries';
import { getTeam } from '@/data/store';
import { PageHeader, Panel, Badge, LiveDot } from '@/components/ui';
import { MatchCard } from '@/components/MatchCard';
import { dayLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Matches' };

type M = ReturnType<typeof matchesView>[number];

function groupByDay(arr: M[], dir: 'asc' | 'desc'): [string, M[]][] {
  const map = new Map<string, M[]>();
  for (const m of arr) {
    const d = m.kickoff.slice(0, 10);
    const list = map.get(d) ?? [];
    list.push(m);
    map.set(d, list);
  }
  return [...map.entries()].sort((a, b) => (dir === 'asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])));
}

export default function MatchesPage() {
  // Only fixtures whose teams are resolved — TBD knockout slots have no card yet.
  const matches = matchesView().filter((m) => getTeam(m.homeTeamId) && getTeam(m.awayTeamId));

  // Order by relevance, not calendar: what's happening now, then what's next,
  // then results with the most recent first — so you never scroll past old games.
  const live = matches.filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME');
  const upcoming = groupByDay(matches.filter((m) => m.status === 'SCHEDULED'), 'asc');
  const results = groupByDay(matches.filter((m) => m.status === 'FINISHED'), 'desc');
  const finishedCount = matches.length - live.length - upcoming.reduce((s, [, d]) => s + d.length, 0);

  const card = (m: M) => <MatchCard key={m.id} match={m} home={getTeam(m.homeTeamId)!} away={getTeam(m.awayTeamId)!} prediction={m.prediction} />;
  const gridBody = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Fixtures & Results"
        title="Matches"
        description="Live games first, then what's coming up, then results — most recent at the top. Win-probability bars on upcoming fixtures; full match data on click."
        action={
          <div className="flex gap-2">
            <Badge tone="red">{live.length} live</Badge>
            <Badge tone="accent">{finishedCount} played</Badge>
          </div>
        }
      />

      {/* Live now */}
      {live.length > 0 && (
        <Panel
          title={<span className="flex items-center gap-2"><LiveDot /> Live now</span>}
          subtitle={`${live.length} ${live.length === 1 ? 'match' : 'matches'} in play`}
          bodyClassName={gridBody}
        >
          {live.map(card)}
        </Panel>
      )}

      {/* Upcoming — soonest first */}
      {upcoming.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>Upcoming</SectionLabel>
          {upcoming.map(([day, dayMatches], i) => (
            <Panel key={day} title={i === 0 ? `Next up · ${dayLabel(day)}` : dayLabel(day)} subtitle={`${dayMatches.length} matches`} bodyClassName={gridBody}>
              {dayMatches.map(card)}
            </Panel>
          ))}
        </section>
      )}

      {/* Results — most recent first */}
      {results.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>Results</SectionLabel>
          {results.map(([day, dayMatches]) => (
            <Panel key={day} title={dayLabel(day)} subtitle={`${dayMatches.length} matches`} bodyClassName={gridBody}>
              {dayMatches.map(card)}
            </Panel>
          ))}
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-terminal-muted">{children}</span>
      <span className="h-px flex-1 bg-terminal-border" />
    </div>
  );
}

export const dynamic = 'force-dynamic';
