import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { playerDetail } from '@/server/queries';
import { getMatches, getTeam, datasetMeta } from '@/data/store';
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
  // Never crash if the full team record is momentarily unresolved (snapshot
  // mid-swap) — fall back to the lightweight team carried on the player view,
  // plus a neutral accent. The page only needs id/name/code/color. (WC-025)
  const fullTeam = getTeam(p.teamId);
  const team = {
    id: p.teamId,
    name: fullTeam?.name ?? p.team.name,
    code: fullTeam?.code ?? p.team.code,
    primaryColor: fullTeam?.primaryColor ?? '#1fe5c4',
  };
  const scouting = generateScoutingReport(p.id);
  const shots = getMatches().flatMap((m) => m.shots).filter((s) => s.playerId === p.id);

  // Only chart metrics the active source actually provides (percentile present).
  const modeled = new Set(datasetMeta().modeledMetrics ?? []);
  const est = (base: string, key: string) => (modeled.has(key) ? `${base} (est.)` : base);
  const radarDef = (
    [
      ['xG', 'xG'], ['xA', 'xA'], ['Shots', 'shots'], ['Key passes', 'keyPasses'],
      ['Prog. passes', 'progressivePasses'], ['Carries', 'progressiveCarries'],
      ['Tackles', 'tackles'], ['Pressures', 'pressuresApplied'],
    ] as [string, string][]
  ).filter(([, k]) => p.percentiles[k] != null);
  const radarMetrics = radarDef.map(([m, k]) => est(m, k));
  const radarKeys = radarDef.map(([, k]) => k);
  const radarValues = radarKeys.map((k) => p.percentiles[k] ?? 0);

  // WC-023: per-attribute ratings exist only for seeded / historical editions.
  // Live (SportMonks) data omits them; the page shows the real match rating card.
  const r = p.rating;
  const hasAttrs = typeof r.pace === 'number';
  const attrs: { label: string; value: number }[] = hasAttrs
    ? (
        [
          ['Pace', r.pace], ['Shooting', r.shooting], ['Passing', r.passing],
          ['Dribbling', r.dribbling], ['Defending', r.defending], ['Physical', r.physical],
        ] as [string, number | undefined][]
      ).map(([label, value]) => ({ label, value: value ?? 0 }))
    : [];

  const percentileRows = (
    [
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
    ] as { label: string; key: string }[]
  )
    .filter((r) => p.percentiles[r.key] != null)
    .map((r) => ({ ...r, label: est(r.label, r.key) }));

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-2xl border border-terminal-border p-6 shadow-glow"
        style={{ background: `linear-gradient(120deg, ${team.primaryColor}2e, transparent 62%)` }}
      >
        <div className="halftone pointer-events-none absolute inset-0 opacity-15" />
        <div className="relative flex flex-wrap items-center gap-5">
          <PlayerPortrait id={p.id} name={p.name} photo={p.photo} size={96} rounded="xl" className="art-hover shrink-0 cursor-pointer drop-shadow-lg" />
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
        {p.stats.xG > 0 ? (
          <Stat label="xG" value={p.stats.xG.toFixed(1)} sub={`${(p.stats.goals - p.stats.xG >= 0 ? '+' : '')}${(p.stats.goals - p.stats.xG).toFixed(1)} vs xG`} />
        ) : (
          // No player-level xG source for the WC — show a real stat instead of a fake 0.
          <Stat label="Shots" value={p.stats.shots} sub={`${p.stats.shotsOnTarget} on target`} />
        )}
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
        {hasAttrs ? (
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
        ) : (
          <Panel title="Match Rating" subtitle="average · live data">
            {p.stats.appearances > 0 ? (
              <>
                <div className="flex items-baseline justify-center gap-1.5 py-2">
                  <span className="text-4xl font-extrabold text-accent">{(p.stats.formIndex / 10).toFixed(1)}</span>
                  <span className="text-sm text-terminal-muted">/ 10</span>
                </div>
                <p className="text-center text-xs text-terminal-muted">
                  across {p.stats.appearances} {p.stats.appearances === 1 ? 'appearance' : 'appearances'}
                </p>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-terminal-muted">Yet to feature at this tournament.</p>
            )}
            <p className="mt-4 border-t border-terminal-border pt-3 text-[11px] leading-relaxed text-terminal-muted">
              Per-attribute scouting ratings aren&apos;t published for live tournament data. See the performance radar
              and percentile rankings, all from real matches.
            </p>
          </Panel>
        )}

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
