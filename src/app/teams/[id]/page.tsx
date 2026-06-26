import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { teamView, squadViews } from '@/server/queries';
import { tacticalProfile } from '@/server/tactics';
import { lineupView } from '@/server/lineups';
import { getTeam } from '@/data/store';
import { Panel, Stat, Badge, FormString, Table, Th, Td, MetricBar } from '@/components/ui';
import { MiniMatchRow } from '@/components/MatchCard';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { pct, ordinal } from '@/lib/format';
import { RUNS } from '@/analytics/simulate';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const t = getTeam(params.id);
  return { title: t ? t.name : 'Team' };
}

export default function TeamPage({ params }: { params: { id: string } }) {
  const t = teamView(params.id);
  if (!t) notFound();
  const squad = squadViews(params.id);
  const f = t.forecast;
  const pr = t.powerRanking;
  const tactics = tacticalProfile(params.id);
  const s = t.standing;
  const coach = t.coach;
  const lineup = lineupView(params.id);

  const positions = ['GK', 'DF', 'MF', 'FW'] as const;

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-2xl border border-terminal-border p-6 shadow-glow"
        style={{ background: `linear-gradient(120deg, ${t.primaryColor}33, transparent 60%)` }}
      >
        <div className="halftone pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-5">
          <TeamCrest code={t.code} color={t.primaryColor} size={84} className="crest-hover shrink-0 cursor-pointer drop-shadow-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              {t.confederation} · Group {t.groupId}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-terminal-bright">
              {t.flag} {t.name}
            </h1>
            <p className="mt-1 text-sm text-terminal-muted">
              {[
                t.manager && t.manager !== '—' ? `Managed by ${t.manager}` : null,
                t.fifaRanking ? `FIFA #${t.fifaRanking}` : null,
                `ELO ${t.elo}`,
                pr ? `Power rank #${pr.rank}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {s && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-terminal-muted">Form</span>
              <FormString form={s.form} />
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Win title" value={pct(f?.winTitle ?? 0)} accent="#1fe5c4" />
        <Stat label="Reach final" value={pct(f?.reachFinal ?? 0)} />
        <Stat label="Reach SF" value={pct(f?.reachSF ?? 0)} />
        <Stat label="Win group" value={pct(f?.groupWin ?? 0)} accent="#22e0d0" />
        <Stat label="Power" value={pr?.powerRating ?? '—'} sub={pr ? `#${pr.rank}` : ''} />
        <Stat label="Momentum" value={pr ? (pr.momentum > 0 ? `+${pr.momentum}` : pr.momentum) : '—'} accent={pr && pr.momentum >= 0 ? '#1fe5c4' : '#ff2e6e'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Tournament Outlook" subtitle={`Monte Carlo · n=${RUNS.toLocaleString()}`}>
          <div className="space-y-3">
            {[
              { label: 'Qualify (R32)', v: f?.reachR32 ?? 0 },
              { label: 'Round of 16', v: f?.reachR16 ?? 0 },
              { label: 'Quarter-final', v: f?.reachQF ?? 0 },
              { label: 'Semi-final', v: f?.reachSF ?? 0 },
              { label: 'Final', v: f?.reachFinal ?? 0 },
              { label: 'Champions', v: f?.winTitle ?? 0 },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-28 text-xs text-terminal-muted">{row.label}</span>
                <div className="flex-1">
                  <MetricBar value={row.v * 100} color="#1fe5c4" />
                </div>
                <span className="tnum w-12 text-right text-sm text-terminal-bright">{pct(row.v, 0)}</span>
              </div>
            ))}
          </div>
          {f && (
            <p className="mt-4 border-t border-terminal-border pt-3 text-xs text-terminal-muted">
              {f.titleProbabilityDelta >= 0 ? 'Outperforming' : 'Underperforming'} the pre-tournament market by{' '}
              <span className={f.titleProbabilityDelta >= 0 ? 'text-accent' : 'text-accent-red'}>
                {f.titleProbabilityDelta >= 0 ? '+' : ''}
                {pct(f.titleProbabilityDelta)}
              </span>
              .
            </p>
          )}
        </Panel>

        <Panel title="Group Position" subtitle={`Group ${t.groupId}`}>
          {s ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-terminal-bright">{ordinal(s.rank)}</span>
                <span className="text-terminal-muted">· {s.points} pts</span>
                {s.status === 'Q' && <Badge tone="accent">Qualified</Badge>}
                {s.status === 'T' && <Badge tone="amber">Thirds race</Badge>}
                {s.status === 'E' && <Badge tone="red">Eliminated</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="W-D-L" value={`${s.won}-${s.drawn}-${s.lost}`} />
                <MiniStat label="Goals" value={`${s.goalsFor}:${s.goalsAgainst}`} />
                <MiniStat label="xG" value={`${s.xGFor.toFixed(1)}`} />
              </div>
              <div className="flex items-center justify-between text-xs text-terminal-muted">
                <span>Qualification probability</span>
                <span className="tnum text-accent">{pct(s.qualificationProbability)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-terminal-muted">No group data.</p>
          )}
        </Panel>

        <Panel title="Fixtures" subtitle="Results & upcoming" bodyClassName="space-y-0.5">
          {t.recentMatches.map((m) => {
            // Skip a row rather than crash if an opponent is momentarily
            // unresolved during a live snapshot swap. (WC-025)
            const home = getTeam(m.homeTeamId);
            const away = getTeam(m.awayTeamId);
            if (!home || !away) return null;
            return <MiniMatchRow key={m.id} match={m} home={home} away={away} />;
          })}
        </Panel>
      </div>

      {tactics.available && (
        <Panel title="Tactical Identity" subtitle="Derived playing style · over played matches">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="violet">{tactics.label}</Badge>
            <span className="text-xs uppercase tracking-wide text-terminal-muted">{tactics.tag}</span>
            {tactics.formation && (
              <span className="ml-auto flex items-center gap-1.5 rounded-md border border-terminal-border bg-terminal-panel/50 px-2 py-1 text-xs">
                <span className="text-[10px] uppercase tracking-wide text-terminal-muted">Shape</span>
                <span className="tnum font-semibold text-terminal-bright">{tactics.formation}</span>
              </span>
            )}
          </div>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed text-terminal-text">{tactics.blurb}</p>
          {tactics.bars && (
            <div className="grid gap-3 sm:grid-cols-2">
              {tactics.bars.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-terminal-muted">{r.label}</span>
                  <div className="flex-1"><MetricBar value={r.value} /></div>
                  <span className="tnum w-10 text-right text-sm text-terminal-bright">{Math.round(r.value)}{r.suffix ?? ''}</span>
                </div>
              ))}
            </div>
          )}
          {tactics.stats && (
            <div className="grid grid-cols-3 gap-3">
              {tactics.stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-terminal-border bg-terminal-panel/40 p-3 text-center">
                  <div className="tnum text-lg font-bold text-terminal-bright">{s.value}</div>
                  <div className="mt-0.5 text-[11px] text-terminal-muted">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {tactics.note && <p className="mt-3 text-[11px] leading-relaxed text-terminal-muted">{tactics.note}</p>}
        </Panel>
      )}

      {/* Manager + line-up changes */}
      {(coach || lineup) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {coach && (
            <Panel title="Manager" subtitle="Head coach">
              <div className="flex items-start gap-4">
                {coach.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coach.photo} alt="" width={72} height={72} className="h-18 w-18 shrink-0 rounded-xl bg-terminal-panel object-cover" style={{ width: 72, height: 72 }} />
                ) : (
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-terminal-panel text-2xl">👔</div>
                )}
                <div className="min-w-0">
                  <div className="text-lg font-bold text-terminal-bright">{coach.name}</div>
                  {coach.age != null && <div className="text-xs text-terminal-muted">Age {coach.age}</div>}
                  {coach.career && coach.career.length > 0 ? (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">Coaching career</p>
                      <ul className="space-y-1">
                        {coach.career.slice(0, 6).map((c, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs">
                            <span className="tnum w-20 shrink-0 text-terminal-muted">{c.start ? c.start.slice(0, 4) : '—'}{c.end ? `–${c.end.slice(0, 4)}` : c.start ? '–now' : ''}</span>
                            <span className="truncate text-terminal-text">{c.team}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-terminal-muted">Career history loads from the live feed.</p>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {lineup && (
            <Panel
              title="Line-up & changes"
              subtitle={`Last XI${lineup.opponent ? ` · vs ${lineup.opponent.name}` : ''}${lineup.formation ? ` · ${lineup.formation}` : ''}`}
            >
              <div className="flex flex-wrap gap-1.5">
                {lineup.xi.map((p) => {
                  const isNew = lineup.changes?.in.some((x) => x.id === p.id);
                  return (
                    <Link key={p.id} href={`/players/${p.id}`}
                      className={`rounded-md border px-2 py-1 text-xs hover:border-accent/40 ${isNew ? 'border-accent/50 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-text'}`}>
                      {p.name.split(' ').slice(-1)[0]}{isNew && ' •'}
                    </Link>
                  );
                })}
              </div>
              {lineup.changes && (lineup.changes.in.length > 0 || lineup.changes.out.length > 0) ? (
                <div className="mt-3 border-t border-terminal-border pt-3 text-xs">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">Changes from the {lineup.changes.vsOpponent} game</p>
                  <div className="space-y-1">
                    {lineup.changes.in.map((p) => (
                      <div key={p.id} className="flex items-center gap-2"><span className="text-accent">▲ in</span><span className="text-terminal-text">{p.name} <span className="text-terminal-muted">({p.pos})</span></span></div>
                    ))}
                    {lineup.changes.out.map((p) => (
                      <div key={p.id} className="flex items-center gap-2"><span className="text-accent-red">▼ out</span><span className="text-terminal-muted">{p.name} ({p.pos})</span></div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-terminal-muted">{lineup.changes ? 'Unchanged XI from the previous match.' : 'First XI of the tournament.'}</p>
              )}
            </Panel>
          )}
        </div>
      )}

      <Panel title="Squad" subtitle={`${squad.length} players`} bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Player</Th>
              <Th>Pos</Th>
              <Th align="right">Age</Th>
              <Th align="right">OVR</Th>
              <Th align="right">Min</Th>
              <Th align="right">G</Th>
              <Th align="right">A</Th>
              <Th align="right">xG</Th>
            </tr>
          </thead>
          <tbody>
            {positions.flatMap((pos) =>
              squad
                .filter((p) => p.position === pos)
                .map((p) => (
                  <tr key={p.id} className="hover:bg-terminal-elevated">
                    <Td className="tnum text-terminal-muted">{p.shirtNumber}</Td>
                    <Td>
                      <Link href={`/players/${p.id}`} className="font-medium text-terminal-bright hover:text-accent">
                        {p.name}
                      </Link>
                    </Td>
                    <Td className="text-xs text-terminal-muted">{p.detailedPosition}</Td>
                    <Td align="right">{p.age}</Td>
                    <Td align="right" className="font-semibold text-accent">{p.rating.overall}</Td>
                    <Td align="right" className="text-terminal-muted">{p.stats.minutes}</Td>
                    <Td align="right" className="font-semibold">{p.stats.goals}</Td>
                    <Td align="right">{p.stats.assists}</Td>
                    <Td align="right" className="text-accent-cyan">{p.stats.xG.toFixed(1)}</Td>
                  </tr>
                )),
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-terminal-border bg-terminal-elevated py-1.5">
      <p className="text-[10px] uppercase text-terminal-muted">{label}</p>
      <p className="tnum text-sm font-semibold text-terminal-bright">{value}</p>
    </div>
  );
}

export const dynamic = 'force-dynamic';
