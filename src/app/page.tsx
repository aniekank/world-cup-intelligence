import Link from 'next/link';
import { ArrowRight, Flame, Goal, Trophy } from 'lucide-react';
import { homeData } from '@/server/queries';
import { getMatches, getTeam, getPlayerViews } from '@/data/store';
import { Panel, Stat, TeamBadge, MetricBar, EmptyState } from '@/components/ui';
import { CountUp, Reveal, Spotlight } from '@/components/ui/motion';
import { BriefingDeck } from '@/components/home/BriefingDeck';
import { MatchCard } from '@/components/MatchCard';
import { CriticalMatchCard } from '@/components/CriticalMatchCard';
import { LiveTicker } from '@/components/home/LiveTicker';
import { ParallaxBurst } from '@/components/effects/ParallaxBurst';
import { pct } from '@/lib/format';

export default function HomePage() {
  const data = homeData();
  const allMatches = getMatches();
  const played = allMatches.filter((m) => m.status === 'FINISHED');
  const totalGoals = played.reduce((s, m) => s + m.homeScore + m.awayScore, 0);
  // Sum player xG (real on every source) rather than per-match team stats, which
  // the live feed leaves empty — otherwise "Total xG" reads 0 on live (WC-016).
  const totalXG = getPlayerViews().reduce((s, p) => s + p.stats.xG, 0);

  return (
    <div className="space-y-6">
      {/* Live ticker */}
      <Reveal>
        <LiveTicker />
      </Reveal>

      {/* Briefing hero */}
      <Reveal>
        <section className="manifesto-hero gradient-border relative overflow-hidden rounded-2xl border border-terminal-border bg-terminal-panel/40 p-6 shadow-glow sm:p-8">
          <ParallaxBurst className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 opacity-50 sm:-right-10" />
          <BriefingDeck cards={data.briefingDeck} />
        </section>
      </Reveal>

      {/* Stat strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          <Stat key="t" label="Teams" value={<CountUp value={48} />} sub="12 groups" />,
          <Stat key="m" label="Matches played" value={<CountUp value={played.length} />} sub={`${allMatches.length} total`} />,
          <Stat key="g" label="Goals" value={<CountUp value={totalGoals} />} sub={`${(totalGoals / Math.max(played.length, 1)).toFixed(2)} / match`} accent="#1fe5c4" />,
          <Stat key="x" label="Total xG" value={<CountUp value={totalXG} decimals={1} />} sub={`${(totalXG / Math.max(played.length, 1) / 2).toFixed(2)} / team`} accent="#22e0d0" />,
        ].map((node, i) => (
          <Reveal key={i} delay={i * 80}>
            <Spotlight className="h-full rounded-lg">{node}</Spotlight>
          </Reveal>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live + upcoming */}
        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Live & Upcoming"
            subtitle="Final round of group fixtures"
            action={
              <Link href="/matches" className="flex items-center gap-1 text-xs text-accent hover:underline">
                All matches <ArrowRight className="h-3 w-3" />
              </Link>
            }
            bodyClassName="grid gap-3 sm:grid-cols-2"
          >
            {[...data.live, ...data.upcoming].slice(0, 6).map((m) => {
              const home = data.live.find((x) => x.id === m.id)?.home ?? undefined;
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  home={home ?? lookupTeam(m.homeTeamId)}
                  away={data.live.find((x) => x.id === m.id)?.away ?? lookupTeam(m.awayTeamId)}
                  prediction={'prediction' in m ? (m.prediction as never) : null}
                />
              );
            })}
            {data.live.length === 0 && data.upcoming.length === 0 && <EmptyState>No scheduled matches.</EmptyState>}
          </Panel>

          {/* Matches that matter — ranked by what's at stake */}
          {data.criticalMatches.length > 0 && (
            <Panel
              title="Matches that matter"
              subtitle="Upcoming fixtures ranked by what's at stake"
              action={<Flame className="h-4 w-4 text-accent-red" />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {data.criticalMatches.map((p) => (
                  <CriticalMatchCard key={p.matchId} p={p} />
                ))}
              </div>
            </Panel>
          )}

          {/* Title contenders */}
          <Panel
            title="Title Contenders"
            subtitle="Monte Carlo championship probability · n=8,000"
            action={
              <Link href="/predictions" className="flex items-center gap-1 text-xs text-accent hover:underline">
                Predictions <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="space-y-3">
              {data.favorites.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <Link href={`/teams/${t.id}`} className="flex w-40 shrink-0 items-center gap-2 hover:opacity-80">
                    <span className="text-base">{t.flag}</span>
                    <span className="truncate text-sm text-terminal-bright">{t.name}</span>
                  </Link>
                  <div className="flex-1">
                    <MetricBar value={(t.forecast?.winTitle ?? 0) * 100} max={Math.max(...data.favorites.map((f) => (f.forecast?.winTitle ?? 0) * 100))} color="#1fe5c4" />
                  </div>
                  <span className="tnum w-12 text-right text-sm font-semibold text-terminal-bright">
                    {pct(t.forecast?.winTitle ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Panel title="Power Rankings" subtitle="Top 5" action={<Trophy className="h-4 w-4 text-accent-amber" />}>
            <ol className="space-y-2">
              {data.powerTop.map((r) => (
                <li key={r.teamId} className="flex items-center gap-3">
                  <span className="tnum w-5 text-sm font-bold text-terminal-muted">{r.rank}</span>
                  <TeamBadge team={r.team} href size="sm" />
                  <span className="tnum ml-auto text-sm font-semibold text-accent">{r.powerRating}</span>
                </li>
              ))}
            </ol>
            <Link href="/rankings" className="mt-3 block text-xs text-accent hover:underline">
              Full power table →
            </Link>
          </Panel>

          <Panel title="Golden Boot Race" subtitle="Goals → projected" action={<Goal className="h-4 w-4 text-accent" />}>
            <ol className="space-y-2">
              {data.goldenBoot.map((g, i) => (
                <li key={g.playerId} className="flex items-center gap-3 text-sm">
                  <span className="tnum w-5 font-bold text-terminal-muted">{i + 1}</span>
                  <Link href={`/players/${g.playerId}`} className="truncate text-terminal-bright hover:text-accent">
                    {g.player?.name ?? g.playerId}
                  </Link>
                  <span className="ml-auto flex items-center gap-2 text-xs text-terminal-muted">
                    <span className="tnum font-semibold text-terminal-bright">{g.currentGoals}</span>
                    <span className="tnum">→ {g.projectedGoals}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="AI Insights" subtitle="Auto-detected stories" action={<Flame className="h-4 w-4 text-accent-red" />}>
            <ul className="space-y-3">
              {data.insights.map((i) => (
                <li key={i.id} className="border-l-2 border-accent/40 pl-3">
                  <p className="text-sm font-medium text-terminal-bright">{i.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-terminal-muted">{i.body}</p>
                </li>
              ))}
            </ul>
            <Link href="/insights" className="mt-3 block text-xs text-accent hover:underline">
              All insights →
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function lookupTeam(id: string) {
  return getTeam(id)!;
}

export const dynamic = 'force-dynamic';
