import type { Metadata } from 'next';
import Link from 'next/link';
import { civilizationsView, CONF_META, GOAL_INTERVALS } from '@/server/civilizations';
import type { Confederation } from '@/domain/types';
import { PageHeader, Panel } from '@/components/ui';

export const metadata: Metadata = { title: 'Clash of the Civilizations' };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pct0 = (v: number) => `${Math.round(v * 100)}%`;

export default function CivilizationsPage() {
  const { regions, goalTiming, matrix, crossRecord, topClashes, totalTitle, presentConfs, meta } = civilizationsView();
  const leader = regions[0];

  // Goals-graphic derivations
  const byGoals = [...regions].sort((a, b) => b.goalsFor - a.goalsFor);
  const maxGoals = Math.max(1, ...regions.map((r) => Math.max(r.goalsFor, r.goalsAgainst)));
  const totalGoals = regions.reduce((s, r) => s + r.goalsFor, 0);
  const totalMatchTeamGames = regions.reduce((s, r) => s + r.played, 0);
  const goalsPerMatch = totalMatchTeamGames ? totalGoals / totalMatchTeamGames : 0;
  const hasXg = regions.some((r) => r.xgFor > 0.5);
  const sharpest = [...byGoals].sort((a, b) => b.goalsPerMatch - a.goalsPerMatch)[0];
  const meanest = [...regions].filter((r) => r.played > 0).sort((a, b) => a.concededPerMatch - b.concededPerMatch)[0];
  const maxTimingShare = Math.max(0.01, ...goalTiming.flatMap((r) => r.buckets.map((b) => (r.total ? b / r.total : 0))));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The World at the Cup"
        title="Clash of the Civilizations"
        description="Six confederations, one trophy. How every region of the world is faring — combined results, who's still standing, the model's read on each continent's title hopes, and the head-to-head record when civilizations collide."
      />

      {/* Which continent is winning the World Cup? */}
      <Panel title="Which continent is winning the World Cup?" subtitle="Combined championship probability by region · Monte Carlo, n=3,000">
        <div className="flex h-9 w-full overflow-hidden rounded-lg">
          {regions.map((r) => {
            const w = (r.titleProb / totalTitle) * 100;
            return (
              <div key={r.conf} className="flex items-center justify-center text-[10px] font-bold text-black/75 transition-all"
                style={{ width: `${w}%`, background: r.color }} title={`${r.name}: ${pct(r.titleProb)}`}>
                {w > 8 ? r.emoji : ''}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {regions.map((r) => (
            <span key={r.conf} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
              <span className="text-terminal-text">{r.name}</span>
              <span className="tnum font-semibold text-terminal-bright">{pct(r.titleProb / totalTitle)}</span>
            </span>
          ))}
        </div>
        {leader && (
          <p className="mt-4 text-sm text-terminal-muted">
            <span className="font-semibold text-terminal-bright">{leader.emoji} {leader.name}</span> leads the field, carrying{' '}
            <span className="font-semibold" style={{ color: leader.color }}>{pct0(leader.titleProb / totalTitle)}</span> of the tournament&rsquo;s title probability across {leader.teamCount} {leader.teamCount === 1 ? 'team' : 'teams'}.
          </p>
        )}
      </Panel>

      {/* Goals around the world */}
      <Panel title="Goals around the world" subtitle={`${totalGoals} goals · ${goalsPerMatch.toFixed(2)} per match · scored vs conceded by region`}>
        {/* headline stat strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GoalStat label="Goals scored" value={String(totalGoals)} sub="all regions" />
          <GoalStat label="Per match" value={goalsPerMatch.toFixed(2)} sub="tournament-wide" />
          <GoalStat label="Sharpest attack" value={sharpest ? `${sharpest.emoji} ${sharpest.goalsPerMatch.toFixed(2)}` : '—'} sub={sharpest ? `${sharpest.name} / game` : ''} accent={sharpest?.color} />
          <GoalStat label="Meanest defense" value={meanest ? `${meanest.emoji} ${meanest.concededPerMatch.toFixed(2)}` : '—'} sub={meanest ? `${meanest.name} conceded` : ''} accent={meanest?.color} />
        </div>

        {/* diverging scored-vs-conceded bars */}
        <div className="mb-2 flex items-center text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
          <span className="flex-1 text-right">← Conceded</span>
          <span className="w-32 shrink-0" />
          <span className="flex-1">Scored →</span>
        </div>
        <div className="space-y-1.5">
          {byGoals.map((r) => (
            <div key={r.conf} className="flex items-center gap-2 text-sm">
              <div className="flex flex-1 items-center justify-end">
                <span className="tnum mr-2 text-xs text-terminal-muted">{r.goalsAgainst}</span>
                <div className="h-5 rounded-l" style={{ width: `${(r.goalsAgainst / maxGoals) * 100}%`, background: 'rgba(139,139,158,0.45)', minWidth: r.goalsAgainst ? 2 : 0 }} />
              </div>
              <span className="flex w-32 shrink-0 items-center justify-center gap-1 text-center text-xs text-terminal-bright">
                <span>{r.emoji}</span><span className="truncate">{r.name}</span>
              </span>
              <div className="flex flex-1 items-center">
                <div className="h-5 rounded-r" style={{ width: `${(r.goalsFor / maxGoals) * 100}%`, background: r.color, minWidth: r.goalsFor ? 2 : 0 }} />
                <span className="tnum ml-2 text-xs font-semibold text-terminal-bright">{r.goalsFor}</span>
                <span className="tnum ml-2 hidden text-[10px] text-terminal-muted sm:inline">{r.goalsPerMatch.toFixed(2)}/g{hasXg ? ` · ${r.finishing >= 0 ? '+' : ''}${r.finishing.toFixed(1)} vs xG` : ''}</span>
              </div>
            </div>
          ))}
        </div>

        {/* When regions score — goal-timing heatmap */}
        {goalTiming.some((r) => r.total > 0) && (
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">When regions score · share of goals by match minute</p>
            <div className="overflow-x-auto">
              <div className="min-w-[460px]">
                <div className="grid items-center gap-1" style={{ gridTemplateColumns: '7rem repeat(6, minmax(0,1fr)) 3rem' }}>
                  <span />
                  {GOAL_INTERVALS.map((iv) => <span key={iv} className="pb-1 text-center text-[10px] tnum text-terminal-muted">{iv}</span>)}
                  <span className="pb-1 text-center text-[10px] uppercase tracking-wide text-terminal-muted">Σ</span>
                  {goalTiming.map((r) => (
                    <TimingRow key={r.conf} r={r} maxShare={maxTimingShare} />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-terminal-muted">Each cell is the share of a region&rsquo;s goals scored in that 15-minute window — darker means more goals come in that phase. Built from {goalTiming.reduce((s, r) => s + r.total, 0)} timed goals.</p>
          </div>
        )}
      </Panel>

      {/* Region cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {regions.map((r, i) => (
          <div key={r.conf} className="overflow-hidden rounded-2xl border border-terminal-border bg-terminal-panel/40"
            style={{ boxShadow: `inset 4px 0 0 0 ${r.color}` }}>
            <div className="flex items-center gap-3 border-b border-terminal-border p-4">
              <span className="text-3xl">{r.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="tnum text-xs font-bold text-terminal-muted">#{i + 1}</span>
                  <h3 className="truncate text-lg font-bold text-terminal-bright">{r.name}</h3>
                </div>
                <p className="text-[11px] text-terminal-muted">{r.conf} · {r.teamCount} teams · avg ELO {r.avgElo}</p>
              </div>
              <div className="text-right">
                <div className="tnum text-xl font-extrabold" style={{ color: r.color }}>{pct(r.titleProb)}</div>
                <div className="text-[10px] uppercase tracking-wide text-terminal-muted">title odds</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-px bg-terminal-border/60 text-center">
              <Cell label="W-D-L" value={`${r.won}-${r.drawn}-${r.lost}`} />
              <Cell label="Goals" value={`${r.goalsFor}:${r.goalsAgainst}`} />
              <Cell label="PPG" value={r.ppg.toFixed(2)} />
              <Cell label="Win %" value={pct0(r.winRate)} />
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5 text-[11px]">
              {r.qualified > 0 && <span className="flex items-center gap-1 text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{r.qualified} through</span>}
              {r.eliminated > 0 && <span className="flex items-center gap-1 text-accent-red"><span className="h-1.5 w-1.5 rounded-full bg-accent-red" />{r.eliminated} out</span>}
              <span className="ml-auto text-terminal-muted">knockout reach {pct0(r.knockoutProb / r.teamCount)}</span>
            </div>

            {(r.topScorer || r.cleanSheets > 0 || r.yellow > 0) && (
              <div className="flex items-center gap-x-3 gap-y-1 border-t border-terminal-border/60 px-4 py-2 text-[11px] text-terminal-muted">
                {r.topScorer && (
                  <Link href={`/players/${r.topScorer.id}`} className="flex min-w-0 items-center gap-1 hover:text-accent">
                    <span>⚽</span><span className="truncate text-terminal-text">{r.topScorer.name}</span><span className="tnum">{r.topScorer.goals}</span>
                  </Link>
                )}
                <span className="ml-auto flex items-center gap-2.5">
                  {r.cleanSheets > 0 && <span title="clean sheets">🧤 {r.cleanSheets}</span>}
                  {r.yellow > 0 && <span title="yellow cards"><span className="inline-block h-2.5 w-1.5 translate-y-px rounded-[1px] bg-accent-amber align-middle" /> {r.yellow}</span>}
                  {r.red > 0 && <span title="red cards"><span className="inline-block h-2.5 w-1.5 translate-y-px rounded-[1px] bg-accent-red align-middle" /> {r.red}</span>}
                </span>
              </div>
            )}

            <div className="space-y-0.5 px-3 pb-3">
              {r.teams.slice(0, 5).map((t) => (
                <Link key={t.id} href={`/teams/${t.id}`}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-terminal-elevated">
                  <span>{t.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-terminal-text">{t.name}</span>
                  {t.status === 'Q' && <span className="text-[10px] font-semibold text-accent">Q</span>}
                  {t.status === 'E' && <span className="text-[10px] font-semibold text-accent-red">OUT</span>}
                  <span className="tnum w-12 text-right text-xs text-terminal-muted">{pct(t.winTitle)}</span>
                </Link>
              ))}
              {r.teams.length > 5 && <p className="px-1.5 pt-1 text-[10px] text-terminal-muted">+{r.teams.length - 5} more</p>}
            </div>
          </div>
        ))}
      </div>

      {/* The Clash — head-to-head matrix */}
      <Panel title="The Clash" subtitle="Head-to-head record when regions collide · row beats column">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-center text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">Region</th>
                {presentConfs.map((c) => (
                  <th key={c} className="p-2 text-[11px] text-terminal-muted" title={CONF_META[c].name}>{CONF_META[c].emoji}</th>
                ))}
                <th className="p-2 text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">vs world</th>
              </tr>
            </thead>
            <tbody>
              {presentConfs.map((a) => {
                const tot = crossRecord[a]!;
                return (
                  <tr key={a} className="border-t border-terminal-border">
                    <td className="p-2 text-left">
                      <span className="flex items-center gap-2"><span>{CONF_META[a].emoji}</span><span className="text-terminal-bright">{CONF_META[a].name}</span></span>
                    </td>
                    {presentConfs.map((b) => {
                      if (a === b) return <td key={b} className="p-2 text-terminal-muted/40">—</td>;
                      const c = matrix[a]![b]!;
                      if (c.played === 0) return <td key={b} className="p-2 text-terminal-muted/30">·</td>;
                      const winRate = c.played ? c.w / c.played : 0;
                      const tone = winRate > 0.55 ? 'rgba(34,224,208,0.16)' : winRate < 0.45 ? 'rgba(255,46,154,0.14)' : 'transparent';
                      return (
                        <td key={b} className="p-2" style={{ background: tone }} title={`${CONF_META[a].name} vs ${CONF_META[b].name}: ${c.w}W ${c.d}D ${c.l}L`}>
                          <span className="tnum text-terminal-bright">{c.w}-{c.d}-{c.l}</span>
                        </td>
                      );
                    })}
                    <td className="p-2">
                      <span className="tnum font-semibold text-terminal-bright">{tot.w}-{tot.d}-{tot.l}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-terminal-muted">
          Each cell is the row region&rsquo;s record against the column region in finished fixtures. Teal = winning record, pink = losing. Intra-region games (same confederation) are excluded.
        </p>
      </Panel>

      {/* Cross-region highlights */}
      {topClashes.length > 0 && (
        <Panel title="Statement results across borders" subtitle="The most emphatic cross-region wins so far">
          <div className="space-y-2">
            {topClashes.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-terminal-border bg-terminal-panel/40 px-3 py-2.5">
                <span className="flex items-center gap-1 text-lg">
                  <span title={CONF_META[c.winnerConf as Confederation].name}>{CONF_META[c.winnerConf as Confederation].emoji}</span>
                  <span className="text-terminal-muted">›</span>
                  <span className="opacity-60" title={CONF_META[c.loserConf as Confederation].name}>{CONF_META[c.loserConf as Confederation].emoji}</span>
                </span>
                <span className="flex-1 text-sm text-terminal-text">{c.label}</span>
                <span className="tnum rounded-md bg-terminal-elevated px-2 py-0.5 text-xs font-semibold text-terminal-bright">{c.score}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-terminal-panel/40 px-2 py-2.5">
      <div className="tnum text-sm font-bold text-terminal-bright">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-terminal-muted">{label}</div>
    </div>
  );
}

function GoalStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-terminal-muted">{label}</div>
      <div className="tnum text-lg font-bold" style={{ color: accent ?? undefined }}>{value}</div>
      {sub && <div className="text-[10px] text-terminal-muted">{sub}</div>}
    </div>
  );
}

function TimingRow({ r, maxShare }: { r: { name: string; emoji: string; color: string; buckets: number[]; total: number }; maxShare: number }) {
  return (
    <>
      <span className="flex items-center gap-1.5 pr-1 text-xs text-terminal-text"><span>{r.emoji}</span><span className="truncate">{r.name}</span></span>
      {r.buckets.map((b, i) => {
        const share = r.total ? b / r.total : 0;
        const op = maxShare ? Math.min(1, (share / maxShare) * 0.92 + 0.06) : 0;
        return (
          <div key={i} className="flex aspect-[2/1] items-center justify-center rounded-[3px]" style={{ background: r.total ? r.color : 'transparent', opacity: r.total ? op : 1, border: r.total ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
            title={`${r.name} ${GOAL_INTERVALS[i]}': ${b} goals (${(share * 100).toFixed(0)}%)`}>
            {b > 0 && <span className="text-[10px] font-semibold text-black/75">{b}</span>}
          </div>
        );
      })}
      <span className="tnum text-center text-xs font-semibold text-terminal-bright">{r.total}</span>
    </>
  );
}

export const dynamic = 'force-dynamic';
