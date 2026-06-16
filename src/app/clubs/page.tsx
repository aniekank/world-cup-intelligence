import type { Metadata } from 'next';
import Link from 'next/link';
import { clubConnections } from '@/server/clubs';
import { PageHeader, Panel, Stat, EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Club Connections' };
export const dynamic = 'force-dynamic';

export default async function ClubsPage() {
  const data = await clubConnections();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Where the World Cup Plays Its Football"
        title="Club Connections"
        description="Every 2026 World Cup player matched to their club — across more than 30 leagues on every continent, from the giants stacking national teams to the little-known sides sending a lone star to the world stage."
      />

      {!data.available ? (
        <EmptyState>
          {data.isLive ? (
            <>Club data is loading from the live feed — give it a moment and refresh.</>
          ) : (
            <>
              Club connections are only available for the <span className="text-accent">live 2026</span> tournament
              (historical event data carries no club links). Switch to World Cup 2026 in the top-right selector.
            </>
          )}
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Players linked" value={data.totalLinked} accent="#1fe5c4" />
            <Stat label="Clubs represented" value={data.clubs.length} />
            <Stat label="Leagues" value={data.byLeague.length} sub="worldwide" accent="#a8e020" />
            <Stat label="Nations" value={data.countries.length} accent="#ff2e9a" />
          </section>

          {/* League cards — top leagues by World Cup players */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.byLeague.map((l) => (
              <div key={l.name} className="glass relative overflow-hidden rounded-xl border border-terminal-border p-3" style={{ background: `linear-gradient(135deg, ${l.color}44, transparent 70%)` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{l.flag}</span>
                  <h3 className="truncate text-sm font-bold text-terminal-bright">{l.name}</h3>
                </div>
                <div className="mt-2 flex gap-3 text-xs">
                  <span><span className="tnum text-lg font-bold text-accent">{l.players}</span> <span className="text-terminal-muted">players</span></span>
                  <span><span className="tnum text-lg font-bold text-terminal-bright">{l.clubs}</span> <span className="text-terminal-muted">clubs</span></span>
                  <span><span className="tnum text-lg font-bold text-terminal-bright">{l.countries}</span> <span className="text-terminal-muted">nations</span></span>
                </div>
              </div>
            ))}
          </section>

          {/* Clubs supplying the World Cup */}
          <Panel title="Clubs Supplying the World Cup" subtitle={`${data.clubs.length} clubs · sorted by World Cup players`} bodyClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.clubs.map((c) => (
              <div key={c.club} className="rounded-lg border border-terminal-border bg-terminal-elevated p-3">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.clubLogo} alt={c.club} className="h-8 w-8 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-terminal-bright">{c.club}</p>
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${c.leagueColor}33`, color: '#d9cdef' }}>
                      {c.leagueShort}
                    </span>
                  </div>
                  <span className="tnum text-lg font-bold text-accent">{c.count}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.players.map((p) => (
                    <Link key={p.playerId} href={`/players/${p.playerId}`} title={`${p.name} · ${p.countryName}`} className="flex items-center gap-1 rounded-full border border-terminal-border px-2 py-0.5 text-[11px] text-terminal-text hover:border-accent/40 hover:text-accent">
                      <span>{p.countryFlag}</span>
                      <span className="max-w-[8rem] truncate">{p.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </Panel>

          {/* By nation */}
          <Panel title="By Nation" subtitle="Which clubs each country's players come from" bodyClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.countries.map((c) => (
              <div key={c.code} className="rounded-lg border border-terminal-border bg-terminal-elevated p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/teams/${c.teamId}`} className="flex items-center gap-2 hover:text-accent">
                    <span className="text-lg">{c.flag}</span>
                    <span className="font-semibold text-terminal-bright">{c.name}</span>
                  </Link>
                  <span className="text-xs text-terminal-muted">{c.total} in EPL/L1/SA</span>
                </div>
                <div className="space-y-1">
                  {c.clubs.map((cl) => (
                    <div key={cl.club} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 truncate text-terminal-text">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cl.color }} />
                        <span className="truncate">{cl.club}</span>
                      </span>
                      <span className="tnum text-terminal-muted">{cl.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}
