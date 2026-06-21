import type { Metadata } from 'next';
import Link from 'next/link';
import { insights, dailyBriefing } from '@/server/queries';
import { PageHeader, Panel, Badge } from '@/components/ui';
import type { Insight } from '@/domain/types';

export const metadata: Metadata = { title: 'AI Insights' };

const KIND_TONE: Record<string, 'accent' | 'amber' | 'red' | 'blue' | 'violet' | 'default'> = {
  upset: 'red',
  overperformer: 'accent',
  underperformer: 'amber',
  breakout: 'violet',
  form: 'blue',
  milestone: 'accent',
  tactical: 'default',
  wall: 'blue',
  prediction: 'blue',
};

function entityHref(i: Insight): string | null {
  if (!i.entityId) return null;
  if (i.entityType === 'team') return `/teams/${i.entityId}`;
  if (i.entityType === 'player') return `/players/${i.entityId}`;
  if (i.entityType === 'match') return `/matches/${i.entityId}`;
  return null;
}

export default function InsightsPage() {
  const briefing = dailyBriefing();
  const all = insights();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="AI Intelligence"
        title="Insights"
        description="Automatically detected stories — upsets, over/under-performers, breakout players, momentum swings and milestones — mined from the analytics engine and ranked by significance."
      />

      <Panel title="Daily Briefing" subtitle="13 June 2026 · Matchday 3">
        <h2 className="text-lg font-semibold text-terminal-bright">{briefing.headline}</h2>
        <p className="mt-2 text-sm text-terminal-text">{briefing.body}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {briefing.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-terminal-muted">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {b}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {all.map((i) => {
          const href = entityHref(i);
          const card = (
            <Panel
              className={href ? 'transition-colors hover:border-accent/40' : ''}
              title={
                <span className="flex items-center gap-2">
                  <Badge tone={KIND_TONE[i.kind] ?? 'default'}>{i.kind}</Badge>
                  {i.severity === 'high' && <Badge tone="red">High impact</Badge>}
                </span>
              }
            >
              <h3 className="text-base font-semibold text-terminal-bright">{i.title}</h3>
              <p className="mt-1.5 text-sm text-terminal-text">{i.body}</p>
              {i.metrics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 border-t border-terminal-border pt-3">
                  {i.metrics.map((m, k) => (
                    <div key={k}>
                      <p className="text-[10px] uppercase text-terminal-muted">{m.label}</p>
                      <p className="tnum text-sm font-semibold text-terminal-bright">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          );
          return href ? (
            <Link key={i.id} href={href}>
              {card}
            </Link>
          ) : (
            <div key={i.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
