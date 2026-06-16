import type { Metadata } from 'next';
import Link from 'next/link';
import { watchStorylines } from '@/server/queries';
import { getTeam } from '@/data/store';
import { PageHeader, Panel } from '@/components/ui';
import { PlayerPortrait } from '@/components/brand/PlayerPortrait';
import { TeamCrest } from '@/components/brand/TeamCrest';
import type { Storyline } from '@/ai/narratives';

export const metadata: Metadata = { title: 'Storylines — Ones to Watch' };
export const dynamic = 'force-dynamic';

const ACCENT: Record<Storyline['accent'], { text: string; chip: string; ring: string }> = {
  accent: { text: 'text-accent', chip: 'border-accent/40 bg-accent/10 text-accent', ring: 'hover:border-accent/50' },
  magenta: { text: 'text-accent-magenta', chip: 'border-accent-magenta/40 bg-accent-magenta/10 text-accent-magenta', ring: 'hover:border-accent-magenta/50' },
  amber: { text: 'text-accent-amber', chip: 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber', ring: 'hover:border-accent-amber/50' },
  violet: { text: 'text-accent-violet', chip: 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet', ring: 'hover:border-accent-violet/50' },
  cyan: { text: 'text-accent-cyan', chip: 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan', ring: 'hover:border-accent-cyan/50' },
  lime: { text: 'text-accent-lime', chip: 'border-accent-lime/40 bg-accent-lime/10 text-accent-lime', ring: 'hover:border-accent-lime/50' },
};

export default function StorylinesPage() {
  const { players, squads } = watchStorylines();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The Narrative Layer"
        title="Storylines — Ones to Watch"
        description="The stories the numbers are telling: the players and squads worth your attention right now, surfaced automatically from the analytics engine — Golden Boot contenders, breakout stars, dark horses and fortresses."
      />

      <Panel title="Players to Watch" subtitle="Auto-curated from form, output and projection" bodyClassName={players.length >= 3 ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : ''}>
        {players.length >= 3 ? (
          players.map((s) => <PlayerStory key={s.id} s={s} />)
        ) : (
          <div className="rounded-lg border border-dashed border-terminal-border p-6 text-sm text-terminal-muted">
            <p className="text-terminal-text">Player storylines need more matches.</p>
            <p className="mt-1">
              The live feed has only populated player stats for {players.length} team
              {players.length === 1 ? '' : 's'} so far — these stories fill in as the group stage
              plays out. For the full, rich version right now, switch to the StatsBomb source
              (<code className="text-accent">DATA_SOURCE=statsbomb</code>), which carries complete
              shot-level data for a past World Cup.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {players.map((s) => (
                <PlayerStory key={s.id} s={s} />
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Squads to Watch" subtitle="Favourites, dark horses and surprise packages" bodyClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {squads.map((s) => (
          <SquadStory key={s.id} s={s} />
        ))}
      </Panel>
    </div>
  );
}

function PlayerStory({ s }: { s: Storyline }) {
  const a = ACCENT[s.accent];
  return (
    <Link
      href={`/players/${s.entityId}`}
      className={`card-interactive glass flex flex-col gap-3 rounded-xl border border-terminal-border p-4 ${a.ring}`}
    >
      <div className="flex items-center gap-3">
        <PlayerPortrait id={s.entityId} name={s.title} size={56} rounded="xl" className="shrink-0 drop-shadow" />
        <div className="min-w-0">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${a.chip}`}>
            {s.tag}
          </span>
          <p className="mt-1 truncate text-base font-bold text-terminal-bright">{s.title}</p>
          <p className="truncate text-xs text-terminal-muted">{s.subtitle}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-terminal-text">{s.blurb}</p>
      <div className="mt-auto flex flex-wrap gap-3 border-t border-terminal-border pt-3">
        {s.metrics.map((m, i) => (
          <div key={i}>
            <p className="text-[10px] uppercase text-terminal-muted">{m.label}</p>
            <p className={`tnum text-sm font-semibold ${i === 0 ? a.text : 'text-terminal-bright'}`}>{m.value}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

function SquadStory({ s }: { s: Storyline }) {
  const a = ACCENT[s.accent];
  const team = getTeam(s.entityId);
  return (
    <Link
      href={`/teams/${s.entityId}`}
      className={`card-interactive glass flex flex-col gap-3 rounded-xl border border-terminal-border p-4 ${a.ring}`}
    >
      <div className="flex items-center gap-3">
        {team && <TeamCrest code={team.code} color={team.primaryColor} size={52} className="shrink-0 drop-shadow" />}
        <div className="min-w-0">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${a.chip}`}>
            {s.tag}
          </span>
          <p className="mt-1 truncate text-base font-bold text-terminal-bright">{s.title}</p>
          <p className="truncate text-xs text-terminal-muted">{s.subtitle}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-terminal-text">{s.blurb}</p>
      <div className="mt-auto flex flex-wrap gap-3 border-t border-terminal-border pt-3">
        {s.metrics.map((m, i) => (
          <div key={i}>
            <p className="text-[10px] uppercase text-terminal-muted">{m.label}</p>
            <p className={`tnum text-sm font-semibold ${i === 0 ? a.text : 'text-terminal-bright'}`}>{m.value}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
