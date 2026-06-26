import type { Metadata } from 'next';
import { matchesView } from '@/server/queries';
import { getTeam } from '@/data/store';
import { PageHeader, Panel, Badge, LiveDot } from '@/components/ui';
import { MatchCard } from '@/components/MatchCard';
import { MatchDayGroups, type MatchItem } from '@/components/matches/MatchDayGroups';

export const metadata: Metadata = { title: 'Matches' };

type M = ReturnType<typeof matchesView>[number];

export default function MatchesPage() {
  // Only fixtures whose teams are resolved — TBD knockout slots have no card yet.
  const resolve = (arr: M[]): MatchItem[] =>
    arr
      .map((m) => ({ m, home: getTeam(m.homeTeamId), away: getTeam(m.awayTeamId) }))
      .filter((x): x is MatchItem => Boolean(x.home && x.away));

  const all = matchesView();
  const live = resolve(all.filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME'));
  // Day-grouping happens client-side (MatchDayGroups) so games file under the
  // day they fall on in the VIEWER'S timezone, not UTC.
  const upcoming = resolve(all.filter((m) => m.status === 'SCHEDULED'));
  const results = resolve(all.filter((m) => m.status === 'FINISHED'));

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
            <Badge tone="accent">{results.length} played</Badge>
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
          {live.map((it) => (
            <MatchCard key={it.m.id} match={it.m} home={it.home} away={it.away} prediction={it.m.prediction} />
          ))}
        </Panel>
      )}

      {/* Upcoming — soonest first */}
      {upcoming.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>Upcoming</SectionLabel>
          <MatchDayGroups items={upcoming} dir="asc" markFirst />
        </section>
      )}

      {/* Results — most recent first */}
      {results.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>Results</SectionLabel>
          <MatchDayGroups items={results} dir="desc" />
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
