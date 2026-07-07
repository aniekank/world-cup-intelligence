import type { Metadata } from 'next';
import { analyticsView } from '@/server/analytics';
import { PageHeader, Panel, Stat } from '@/components/ui';
import { Scatter2, HBar } from '@/components/charts/Recharts';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  const { flags, stats, teamProfile, teamFinishing, xgLeaders, creativity, progressive, tacklers, pressing } = analyticsView();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Advanced Metrics"
        title="Analytics Lab"
        description="Underlying performance: expected goals, progressive actions, pressing and finishing efficiency. xG is shown at team level — where the live feed actually provides it — rather than fabricating per-player values it doesn't carry. Panels that have no data on the current source are hidden, not zeroed."
      />

      {/* headline stats — only the ones with real data */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {flags.hasTeamXg && <Stat label="Total xG" value={stats.teamXG.toFixed(1)} sub={`${stats.goals} goals`} accent="#ff8a1e" />}
        {flags.hasTeamXg && <Stat label="Avg xG / shot" value={stats.xgPerShot.toFixed(2)} sub={`${stats.totalShots.toLocaleString()} shots`} accent="#22e0d0" />}
        <Stat label="Conversion" value={`${stats.conversion.toFixed(1)}%`} sub="goals / shots" accent="#1fe5c4" />
        {flags.hasBigChances && <Stat label="Big chances" value={stats.bigChances} sub="created" />}
        {flags.hasShotData && stats.setPieceShare > 0 && <Stat label="Set-piece xG" value={`${stats.setPieceShare.toFixed(0)}%`} sub="of shot xG" accent="#ff8a1e" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Team Profile" subtitle="Offense rating (x) vs Defense rating (y) · bubble = power">
          <Scatter2 points={teamProfile} xLabel="Offense" yLabel="Defense" color="#1fe5c4" />
        </Panel>
        {flags.hasTeamXg ? (
          <Panel title="Finishing" subtitle="Team xG (x) vs Goals (y) · above the line = clinical">
            <Scatter2 points={teamFinishing} xLabel="xG" yLabel="Goals" color="#ff8a1e" />
          </Panel>
        ) : (
          <Panel title="Team Profile — attack" subtitle="Goals scored, by team power">
            <p className="py-10 text-center text-sm text-terminal-muted">Expected-goals data isn&rsquo;t available on the current source yet — the finishing view fills in once team xG is present.</p>
          </Panel>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {flags.hasXa && (
          <Panel title="Creativity" subtitle="xA (x) vs Assists (y) · bubble = key passes">
            <Scatter2 points={creativity} xLabel="xA" yLabel="Assists" color="#8b5cf6" />
          </Panel>
        )}
        {flags.hasTeamXg && (
          <Panel title="xG Leaders" subtitle="Expected goals by team · top 10">
            <HBar data={xgLeaders} unit="" color="#22e0d0" />
          </Panel>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {flags.hasProg && (
          <Panel title="Progressive Passers" subtitle="Passes that advance play">
            <HBar data={progressive} color="#ff2e9a" height={300} />
          </Panel>
        )}
        <Panel title="Top Tacklers" subtitle="Defensive actions">
          <HBar data={tacklers} color="#1fe5c4" height={300} />
        </Panel>
        {flags.hasPressures && (
          <Panel title="Pressing Volume" subtitle="Pressures applied">
            <HBar data={pressing} color="#ff8a3d" height={300} />
          </Panel>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
