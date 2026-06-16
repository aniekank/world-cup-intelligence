import type { Metadata } from 'next';
import Link from 'next/link';
import { discoveries } from '@/server/discoveries';
import { PageHeader, Panel, Badge, EmptyState } from '@/components/ui';
import { PlayerPortrait } from '@/components/brand/PlayerPortrait';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { getTeam } from '@/data/store';
import { Sparkles, Star } from 'lucide-react';

export const metadata: Metadata = { title: 'Discoveries' };
export const dynamic = 'force-dynamic';

export default async function DiscoveriesPage() {
  const data = await discoveries();

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Hidden Gems & First-Timers"
        title="Discoveries"
        description="The under-the-radar players who could light up the tournament — proven at top clubs but carrying unfancied nations — and the countries stepping onto the World Cup stage for the very first time."
      />

      {/* ── Underrated by continent ── */}
      <section className="space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-terminal-bright">
          <Sparkles className="h-5 w-5 text-accent" /> Underrated by Continent
        </h2>
        {data.byContinent.length === 0 ? (
          <EmptyState>
            {data.isLive
              ? 'Club links are still loading — refresh in a moment.'
              : 'Underrated profiles use live club data. Switch to World Cup 2026 in the top-right selector.'}
          </EmptyState>
        ) : (
          data.byContinent.map((grp) => (
            <div key={grp.conf}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-accent-magenta">{grp.label}</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {grp.players.map((p) => (
                  <div key={p.id} className="card-interactive glass flex flex-col gap-3 rounded-xl border border-terminal-border p-4">
                    <div className="flex items-center gap-3">
                      <PlayerPortrait id={p.id} name={p.name} size={52} rounded="xl" className="shrink-0 drop-shadow" />
                      <div className="min-w-0">
                        <Link href={`/players/${p.id}`} className="block truncate text-base font-bold text-terminal-bright hover:text-accent">
                          {p.name}
                        </Link>
                        <p className="truncate text-xs text-terminal-muted">
                          {p.positionFull} · {p.nationFlag} {p.nation}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.clubLogo} alt={p.club} className="h-5 w-5 object-contain" />
                      <span className="text-sm text-terminal-text">{p.club}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${p.leagueColor}33`, color: '#d9cdef' }}>
                        {p.league}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-terminal-text">{p.blurb}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-terminal-border pt-2 text-xs">
                      <span className="text-terminal-muted">Nation title odds</span>
                      <span className="tnum font-semibold text-accent-amber">{(p.titleOdds * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Debutant nations ── */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-terminal-bright">
          <Star className="h-5 w-5 text-accent-amber" /> First-Timers
          <span className="text-sm font-normal text-terminal-muted">· debut nations</span>
        </h2>
        {data.debutants.length === 0 ? (
          <EmptyState>No debutant nations recorded for this tournament.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.debutants.map((d) => {
              const team = getTeam(d.id);
              return (
                <Panel key={d.id} bodyClassName="space-y-3">
                  <div className="flex items-center gap-3">
                    {team && <TeamCrest code={team.code} color={team.primaryColor} size={48} className="shrink-0 drop-shadow" />}
                    <div className="min-w-0 flex-1">
                      <Link href={`/teams/${d.id}`} className="flex items-center gap-2 hover:text-accent">
                        <span className="text-xl">{d.flag}</span>
                        <h3 className="text-lg font-bold text-terminal-bright">{d.name}</h3>
                      </Link>
                      <p className="text-xs text-terminal-muted">
                        {d.confederation}
                        {d.group ? ` · Group ${d.group}` : ''} · {d.squadSize}-player squad
                      </p>
                    </div>
                    <Badge tone="amber">Debut</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-terminal-text">{d.blurb}</p>
                  {d.coach && (
                    <p className="text-sm">
                      <span className="text-terminal-muted">Coach: </span>
                      <span className="font-medium text-terminal-bright">{d.coach}</span>
                    </p>
                  )}
                  {d.keyPlayers.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-terminal-muted">Players at European clubs</p>
                      <div className="flex flex-wrap gap-1.5">
                        {d.keyPlayers.map((kp) => (
                          <Link key={kp.id} href={`/players/${kp.id}`} className="rounded-full border border-terminal-border px-2 py-0.5 text-[11px] text-terminal-text hover:border-accent/40 hover:text-accent">
                            {kp.name} <span className="text-terminal-muted">· {kp.club}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
