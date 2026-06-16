import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { playerDetail } from '@/server/queries';
import { getMatches, getTeam } from '@/data/store';
import { generateScoutingReport } from '@/ai/narratives';
import { Panel, Stat, Badge, MetricBar } from '@/components/ui';
import { Radar2 } from '@/components/charts/Recharts';
import { ShotMap } from '@/components/charts/ShotMap';
import { PlayerPortrait } from '@/components/brand/PlayerPortrait';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { money, ordinal } from '@/lib/format';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = playerDetail(params.id);
  return { title: p ? `${p.name} — Scouting Profile` : 'Player' };
}

const POS_FULL: Record<string, string> = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };

export default function PlayerPage({ params }: { params: { id: string } }) {
  const p = playerDetail(params.id);
  if (!p) notFound();
  const team = getTeam(p.teamId)!;
  const scouting = generateScoutingReport(p.id);
  const shots = getMatches().flatMap((m) => m.shots).filter((s) => s.playerId === p.id);

  const radarMetrics = ['xG', 'xA', 'Shots', 'Key passes', 'Prog. passes', 'Carries', 'Tackles', 'Pressures'];
  const radarKeys = ['xG', 'xA', 'shots', 'keyPasses', 'progressivePasses', 'progressiveCarries', 'tackles', 'pressuresApplied'];
  const radarValues = radarKeys.map((k) => p.percentiles[k] ?? 0);

  const attrs: { label: string; value: number }[] = [
    { label: 'Pace', value: p.rating.pace },
    { label: 'Shooting', value: p.rating.shooting },
    { label: 'Passing', value: p.rating.passing },
    { label: 'Dribbling', value: p.rating.dribbling },
    { label: 'Defending', value: p.rating.defending },
    { label: 'Physical', value: p.rating.physical },
  ];

  const percentileRows: { label: string; key: string }[] = [
    { label: 'Goals', key: 'goals' },
    { label: 'Assists', key: 'assists' },
    { label: 'xG', key: 'xG' },
    { label: 'xA', key: 'xA' },
    { label: 'Shots', key: 'shots' },
    { label: 'Key passes', key: 'keyPasses' },
    { label: 'Prog. passes', key: 'progressivePasses' },
    { label: 'Prog. carries', key: 'progressiveCarries' },
    { label: 'Tackles', key: 'tackles' },
    { label: 'Interceptions', key: 'interceptions' },
    { label: 'Pressures', key: 'pressuresApplied' },
  ];

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-2xl border border-terminal-border p-6 shadow-glow"
        style={{ background: `linear-gradient(120deg, ${team.primaryColor}2e, transparent 62%)` }}
      >
        <div className="halftone pointer-events-none absolute inset-0 opacity-15" />
        <div className="relative flex flex-wrap items-center gap-5">
          <PlayerPortrait id={p.id} name={p.name} size={96} rounded="xl" className="art-hover shrink-0 cursor-pointer drop-shadow-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              {POS_FULL[p.position]} · {p.detailedPosition}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-terminal-bright">{p.name}</h1>
            <p className="mt-1 text-sm text-terminal-muted">
              {[
                p.shirtNumber ? `#${p.shirtNumber}` : null,
                p.club && p.club !== '—' ? p.club : null,
                p.age ? `Age ${p.age}` : null,
                p.heightCm ? `${p.heightCm}cm` : null,
                `${p.foot}-footed`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Link
            href={`/teams/${team.id}`}
            className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-panel/60 px-3 py-2 text-sm text-terminal-bright hover:border-accent/40"
          >
            <TeamCrest code={team.code} color={team.primaryColor} size={28} /> {team.name}
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Goals" value={p.stats.goals} accent="#1fe5c4" />
        <Stat label="Assists" value={p.stats.assists} accent="#22e0d0" />
        <Stat label="xG" value={p.stats.xG.toFixed(1)} sub={`${(p.stats.goals - p.stats.xG >= 0 ? '+' : '')}${(p.stats.goals - p.stats.xG).toFixed(1)} vs xG`} />
        <Stat label="xA" value={p.stats.xA.toFixed(1)} />
        <Stat label="Minutes" value={p.stats.minutes} sub={`${p.stats.appearances} apps`} />
        <Stat label="Form" value={p.stats.formIndex} accent="#ff8a1e" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Percentile Profile" subtitle={`vs other ${(POS_FULL[p.position] ?? 'player').toLowerCase()}s · per 90`}>
          <Radar2 metrics={radarMetrics} seriesA={{ name: p.name.split(' ').slice(-1)[0]!, values: radarValues, color: team.primaryColor }} />
        </Panel>

        <Panel title="Scouting Report" subtitle="AI-generated" className="lg:col-span-2">
          <p className="text-sm text-terminal-text">{scouting.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Strengths</p>
              <ul className="space-y-1.5">
                {scouting.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-terminal-text">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-amber">Development areas</p>
              <ul className="space-y-1.5">
                {scouting.weaknesses.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-terminal-text">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-accent-amber" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.marketValueEur > 0 && <Badge tone="violet">Market value {money(p.marketValueEur)}</Badge>}
            <Badge tone="blue">{p.foot}-footed</Badge>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Attributes" subtitle="Scouting ratings 0–100">
          <div className="space-y-3">
            {attrs.map((a) => (
              <div key={a.label} className="flex items-center gap-3">
                <span className="w-20 text-xs text-terminal-muted">{a.label}</span>
                <div className="flex-1">
                  <MetricBar value={a.value} />
                </div>
                <span className="tnum w-8 text-right text-sm text-terminal-bright">{a.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Percentile Rankings" subtitle="vs positional peers" bodyClassName="space-y-2.5">
          {percentileRows.map((r) => {
            const v = p.percentiles[r.key] ?? 0;
            return (
              <div key={r.key} className="flex items-center gap-3">
                <span className="w-24 text-xs text-terminal-muted">{r.label}</span>
                <div className="flex-1">
                  <MetricBar value={v} />
                </div>
                <span className="tnum w-12 text-right text-xs text-terminal-text">{ordinal(v)}</span>
              </div>
            );
          })}
        </Panel>

        <Panel title="Shot Map" subtitle={`${shots.length} shots · ${p.stats.goals} goals`}>
          {shots.length > 0 ? (
            <ShotMap shots={shots} />
          ) : (
            <p className="py-8 text-center text-sm text-terminal-muted">No shots recorded yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
