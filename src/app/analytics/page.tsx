import type { Metadata } from 'next';
import { players, rankingsView } from '@/server/queries';
import { getTeams, getMatches, datasetMeta } from '@/data/store';
import { PageHeader, Panel, Stat } from '@/components/ui';
import { Scatter2, HBar } from '@/components/charts/Recharts';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));

  // Tournament-wide aggregates from PLAYER stats (real on every source, incl.
  // live). Shot-level extras (set-piece share) need shot coordinates the live
  // feed lacks, so they're gated on hasShotData rather than shown as 0 (WC-016).
  const hasShotData = datasetMeta().hasShotData;
  const pv = players({ limit: 2000 });
  const totalShots = pv.reduce((s, p) => s + p.stats.shots, 0);
  const goals = pv.reduce((s, p) => s + p.stats.goals, 0);
  const totalXG = pv.reduce((s, p) => s + p.stats.xG, 0);
  const bigChances = Math.round(pv.reduce((s, p) => s + p.stats.bigChancesCreated, 0));
  const xgPerShot = totalShots ? totalXG / totalShots : 0;
  const conversion = totalShots ? (goals / totalShots) * 100 : 0;
  const allShots = getMatches().flatMap((m) => m.shots);
  const setPieceXG = allShots
    .filter((s) => s.situation === 'corner' || s.situation === 'set_piece' || s.situation === 'free_kick' || s.situation === 'direct_free_kick')
    .reduce((s, sh) => s + sh.xG, 0);
  const setPieceShare = totalXG && setPieceXG ? (setPieceXG / totalXG) * 100 : 0;
  const hasPressures = pv.some((p) => p.stats.pressuresApplied > 0);

  // Team offense vs defense (from power ratings)
  const teamPoints = rankingsView().map((r) => ({
    x: r.offenseRating,
    y: r.defenseRating,
    label: r.team.code,
    z: r.powerRating,
  }));

  // Player finishing: xG vs goals (outfield, >=90 mins)
  const finishing = players({ limit: 400 })
    .filter((p) => p.position !== 'GK' && p.stats.minutes >= 90 && (p.stats.xG > 0.5 || p.stats.goals > 0))
    .map((p) => ({ x: Math.round(p.stats.xG * 10) / 10, y: p.stats.goals, label: p.name, z: p.stats.shots }))
    .slice(0, 120);

  // Creativity: xA vs assists
  const creativity = players({ limit: 400 })
    .filter((p) => p.stats.minutes >= 90 && (p.stats.xA > 0.4 || p.stats.assists > 0))
    .map((p) => ({ x: Math.round(p.stats.xA * 10) / 10, y: p.stats.assists, label: p.name, z: p.stats.keyPasses }))
    .slice(0, 120);

  const lead = (key: 'xG' | 'progressivePasses' | 'tackles' | 'pressuresApplied', n = 10) =>
    players({ sort: key, limit: n }).map((p) => ({
      label: p.team.code + ' ' + p.name.split(' ').slice(-1)[0],
      value: Math.round(((p.stats as unknown as Record<string, number>)[key] ?? 0) * 10) / 10,
      color: teamMap.get(p.teamId)?.primaryColor,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Advanced Metrics"
        title="Analytics Lab"
        description="Opta-grade underlying performance: expected goals, expected assists, progressive actions, pressing, and finishing efficiency. Bubble size encodes a third dimension (shots, key passes, or power rating)."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Avg xG / shot" value={xgPerShot.toFixed(2)} sub={`${totalShots.toLocaleString()} shots`} accent="#22e0d0" />
        <Stat label="Conversion" value={`${conversion.toFixed(1)}%`} sub="goals / shots" accent="#1fe5c4" />
        <Stat label="Big chances" value={bigChances} sub="created" />
        {hasShotData && setPieceShare > 0 ? (
          <Stat label="Set-piece xG" value={`${setPieceShare.toFixed(0)}%`} sub="of total" accent="#ff8a1e" />
        ) : (
          <Stat label="Total xG" value={totalXG.toFixed(1)} sub={`${goals} goals`} accent="#ff8a1e" />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Team Profile" subtitle="Offense rating (x) vs Defense rating (y) · bubble = power">
          <Scatter2 points={teamPoints} xLabel="Offense" yLabel="Defense" color="#1fe5c4" />
        </Panel>
        <Panel title="Finishing" subtitle="xG (x) vs Goals (y) · above the line = overperforming xG">
          <Scatter2 points={finishing} xLabel="xG" yLabel="Goals" color="#ff8a1e" />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Creativity" subtitle="xA (x) vs Assists (y) · bubble = key passes">
          <Scatter2 points={creativity} xLabel="xA" yLabel="Assists" color="#8b5cf6" />
        </Panel>
        <Panel title="xG Leaders" subtitle="Expected goals · top 10">
          <HBar data={lead('xG')} unit="" color="#22e0d0" />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Progressive Passers" subtitle="Passes that advance play">
          <HBar data={lead('progressivePasses')} color="#ff2e9a" height={300} />
        </Panel>
        <Panel title="Top Tacklers" subtitle="Defensive actions">
          <HBar data={lead('tackles')} color="#1fe5c4" height={300} />
        </Panel>
        {hasPressures && (
          <Panel title="Pressing Volume" subtitle="Pressures applied">
            <HBar data={lead('pressuresApplied')} color="#ff8a3d" height={300} />
          </Panel>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
