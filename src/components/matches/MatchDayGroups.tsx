'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/ui';
import { MatchCard } from '@/components/MatchCard';
import type { Team } from '@/domain/types';
import type { matchesView } from '@/server/queries';

type M = ReturnType<typeof matchesView>[number];
export type MatchItem = { m: M; home: Team; away: Team };

const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

/**
 * Groups fixtures by the day they fall on in the VIEWER'S timezone. Kickoffs are
 * UTC, so a late-evening North American game rolls onto the next UTC day —
 * grouping by the raw date filed it under the wrong header while the card time
 * (LocalTime) showed the right one. Renders UTC groups on the server / first
 * paint (hydration-safe), then re-groups in the browser's zone after mount.
 */
export function MatchDayGroups({ items, dir, markFirst = false }: { items: MatchItem[]; dir: 'asc' | 'desc'; markFirst?: boolean }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(true), []);

  const days = useMemo(() => {
    const zone = local ? undefined : 'UTC';
    const map = new Map<string, MatchItem[]>();
    for (const it of items) {
      const key = new Date(it.m.kickoff).toLocaleDateString('en-CA', zone ? { timeZone: zone } : {}); // YYYY-MM-DD
      const list = map.get(key);
      if (list) list.push(it);
      else map.set(key, [it]);
    }
    return [...map.entries()].sort((a, b) => (dir === 'asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])));
  }, [items, dir, local]);

  const labelFor = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(local ? {} : { timeZone: 'UTC' }) });

  return (
    <>
      {days.map(([key, group], i) => (
        <Panel
          key={key}
          title={<span suppressHydrationWarning>{markFirst && i === 0 ? `Next up · ${labelFor(group[0]!.m.kickoff)}` : labelFor(group[0]!.m.kickoff)}</span>}
          subtitle={`${group.length} ${group.length === 1 ? 'match' : 'matches'}`}
          bodyClassName={GRID}
        >
          {group.map((it) => (
            <MatchCard key={it.m.id} match={it.m} home={it.home} away={it.away} prediction={it.m.prediction} />
          ))}
        </Panel>
      ))}
    </>
  );
}
