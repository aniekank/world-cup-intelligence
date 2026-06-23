import type { Metadata } from 'next';
import { tournamentSummaries } from '@/server/history';
import { PageHeader, Panel, Stat } from '@/components/ui';
import { AreaTrend } from '@/components/charts/Recharts';
import { ExploreTournamentButton } from '@/components/history/ExploreTournamentButton';

export const metadata: Metadata = { title: 'Through the Years' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const all = await tournamentSummaries();
  const men = all.filter((t) => t.gender === 'men');
  const women = all.filter((t) => t.gender === 'women');

  const totalGoals = all.reduce((s, t) => s + t.goals, 0);
  const totalMatches = all.reduce((s, t) => s + t.matches, 0);
  const avgGpg = totalMatches ? totalGoals / totalMatches : 0;

  // Goals per game is known for every edition → plot it as a trend over the
  // eras, one coherent series per gender (mixing them on one axis would zig-zag
  // by competition, not by time). `all` is already sorted ascending by year.
  const menGpg = men.map((t) => ({ year: t.short, gpg: Math.round(t.goalsPerGame * 100) / 100 }));
  const womenGpg = women.map((t) => ({ year: t.short, gpg: Math.round(t.goalsPerGame * 100) / 100 }));

  // Field size per edition — the tournament's expansion (13 → 16 → 24 → 32) is
  // one of the clearest "through the years" stories, and we have it for every
  // edition. xG/shot is omitted here (it exists only for the 4 modern StatsBomb
  // editions, so it can't show an era trend); it still appears on those cards.
  const menTeams = men.map((t) => ({ year: t.short, teams: t.teams }));
  const womenTeams = women.map((t) => ({ year: t.short, teams: t.teams }));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The Data Through the Eras"
        title="Through the Years"
        description="Every FIFA World Cup since 1930, men's and women's — results, goals, champions and Golden Boots from the full archive, with shot-level analytics (xG) for the four most recent tournaments via StatsBomb. How scoring has evolved across the eras."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tournaments" value={all.length} sub="men's & women's" />
        <Stat label="Matches" value={totalMatches} accent="#1fe5c4" />
        <Stat label="Goals" value={totalGoals} sub={`${avgGpg.toFixed(2)} / game`} accent="#a8e020" />
        <Stat label="Span" value={`${Math.min(...all.map((t) => t.year))}–${Math.max(...all.map((t) => t.year))}`} accent="#ff2e9a" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {menGpg.length > 0 && (
          <Panel title="Goals per Game · Men's" subtitle="Across every men's World Cup">
            <AreaTrend data={menGpg} dataKey="gpg" xKey="year" color="#1fe5c4" height={220} />
          </Panel>
        )}
        {womenGpg.length > 0 && (
          <Panel title="Goals per Game · Women's" subtitle="Across every women's World Cup">
            <AreaTrend data={womenGpg} dataKey="gpg" xKey="year" color="#ff2e9a" height={220} />
          </Panel>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {menTeams.length > 0 && (
          <Panel title="Field Size · Men's" subtitle="Teams per tournament, 1930 onward">
            <AreaTrend data={menTeams} dataKey="teams" xKey="year" color="#a8e020" height={220} />
          </Panel>
        )}
        {womenTeams.length > 0 && (
          <Panel title="Field Size · Women's" subtitle="Teams per tournament, 1991 onward">
            <AreaTrend data={womenTeams} dataKey="teams" xKey="year" color="#a8e020" height={220} />
          </Panel>
        )}
      </div>

      {[
        // Cards list most-recent-first; the trend charts above stay chronological
        // (copies, so this doesn't disturb their ascending order).
        { title: "Men's World Cups", items: [...men].reverse() },
        { title: "Women's World Cups", items: [...women].reverse() },
      ].map((grp) => (
        grp.items.length > 0 && (
          <div key={grp.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-terminal-muted">{grp.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {grp.items.map((t) => (
                <Panel key={t.id} className="flex flex-col" bodyClassName="flex flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-terminal-bright">{t.label}</h3>
                      <p className="text-xs text-terminal-muted">{t.host}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-terminal-muted">Champion</p>
                      <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-terminal-bright">
                        <span className="text-lg">{t.championFlag}</span> {t.champion}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Mini label="Matches" value={String(t.matches)} />
                    <Mini label="Goals" value={String(t.goals)} accent="#a8e020" />
                    <Mini label="G/Game" value={t.goalsPerGame.toFixed(2)} accent="#1fe5c4" />
                    <Mini label="xG/Shot" value={t.hasShots ? t.xgPerShot.toFixed(2) : '—'} accent="#22e0d0" />
                  </div>

                  {t.topScorer && (
                    <p className="rounded-md border border-terminal-border bg-terminal-elevated px-3 py-2 text-sm">
                      <span className="text-terminal-muted">Golden Boot: </span>
                      <span className="font-semibold text-terminal-bright">{t.topScorer.name}</span>
                      <span className="text-accent"> · {t.topScorer.goals} goals</span>
                    </p>
                  )}

                  <ExploreTournamentButton id={t.id} label={t.short} />
                </Panel>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded border border-terminal-border bg-terminal-elevated py-1.5">
      <p className="text-[10px] uppercase text-terminal-muted">{label}</p>
      <p className="tnum text-sm font-semibold" style={accent ? { color: accent } : { color: '#f6f1ff' }}>
        {value}
      </p>
    </div>
  );
}
