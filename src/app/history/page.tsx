import type { Metadata } from 'next';
import { tournamentSummaries } from '@/server/history';
import { PageHeader, Panel, Stat } from '@/components/ui';
import { HBar } from '@/components/charts/Recharts';
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

  const gpgData = all.map((t) => ({ label: t.short, value: Math.round(t.goalsPerGame * 100) / 100, color: t.gender === 'women' ? '#ff2e9a' : '#1fe5c4' }));
  const xgData = all.map((t) => ({ label: t.short, value: Math.round(t.xgPerShot * 100) / 100, color: t.gender === 'women' ? '#ff2e9a' : '#22e0d0' }));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The Data Through the Eras"
        title="Through the Years"
        description="Real event data spanning four World Cups — full shot-level analytics from StatsBomb. How the game's output, shot quality and finishing have evolved across men's and women's tournaments, with every champion and Golden Boot."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tournaments analyzed" value={all.length} sub="full event data" />
        <Stat label="Matches" value={totalMatches} accent="#1fe5c4" />
        <Stat label="Goals" value={totalGoals} sub={`${avgGpg.toFixed(2)} / game`} accent="#a8e020" />
        <Stat label="Span" value={`${Math.min(...all.map((t) => t.year))}–${Math.max(...all.map((t) => t.year))}`} accent="#ff2e9a" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Goals per Game" subtitle="By tournament · teal = men, pink = women">
          <HBar data={gpgData} unit="" color="#1fe5c4" height={Math.max(180, all.length * 46)} />
        </Panel>
        <Panel title="Shot Quality (xG per shot)" subtitle="Average chance quality by tournament">
          <HBar data={xgData} unit="" color="#22e0d0" height={Math.max(180, all.length * 46)} />
        </Panel>
      </div>

      {[
        { title: "Men's World Cups", items: men },
        { title: "Women's World Cups", items: women },
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
                    <Mini label="xG/Shot" value={t.xgPerShot.toFixed(2)} accent="#22e0d0" />
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
