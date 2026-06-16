import type { Metadata } from 'next';
import Link from 'next/link';
import { teamsWithForecast } from '@/server/queries';
import { PageHeader, Panel, MetricBar, Badge } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { pct } from '@/lib/format';
import type { Confederation } from '@/domain/types';

export const metadata: Metadata = { title: 'Teams' };

const CONF_ORDER: Confederation[] = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

export default function TeamsPage() {
  const teams = teamsWithForecast();
  const byConf = CONF_ORDER.map((c) => ({ conf: c, teams: teams.filter((t) => t.confederation === c) })).filter((g) => g.teams.length);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="32 Nations · 48 Teams"
        title="Teams"
        description="All 48 qualified nations ranked by championship probability, with live power ratings and group context. Click any team for squad, fixtures, form, and tournament outlook."
      />

      {byConf.map(({ conf, teams: confTeams }) => (
        <Panel key={conf} title={conf} subtitle={`${confTeams.length} teams`} bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {confTeams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="card-interactive group glass rounded-lg border border-terminal-border p-3"
            >
              <div className="flex items-center gap-2.5">
                <TeamCrest code={t.code} color={t.primaryColor} size={40} className="shrink-0 drop-shadow" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-terminal-bright group-hover:text-accent">
                    {t.flag} {t.name}
                  </p>
                  <p className="text-[11px] text-terminal-muted">
                    Group {t.groupId} · FIFA #{t.fifaRanking}
                  </p>
                </div>
                {t.powerRanking && <Badge tone="default">#{t.powerRanking.rank}</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-terminal-muted">
                <span>Title odds</span>
                <span className="tnum font-semibold text-accent">{pct(t.forecast?.winTitle ?? 0)}</span>
              </div>
              <div className="mt-1">
                <MetricBar value={(t.forecast?.winTitle ?? 0) * 100} max={15} color="#1fe5c4" height={4} />
              </div>
            </Link>
          ))}
        </Panel>
      ))}
    </div>
  );
}

export const dynamic = 'force-dynamic';
