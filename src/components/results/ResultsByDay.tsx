'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LocalTime } from '@/components/LocalTime';
import type { resultsFeed } from '@/server/queries';

type Result = ReturnType<typeof resultsFeed>[number];

const STAGE_LABEL: Record<string, string> = {
  R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final',
  SF: 'Semi-final', THIRD_PLACE: 'Third-place play-off', FINAL: 'Final',
};
const stageText = (r: Result) => (r.stage === 'GROUP' ? (r.groupId ? `Group ${r.groupId}` : 'Group stage') : STAGE_LABEL[r.stage] ?? r.stage);

/**
 * Groups results by the day they were *played in the viewer's own timezone*.
 * Kickoffs are UTC, so a late-evening game in North America rolls onto the next
 * UTC day — grouping by the raw date string filed it under the wrong header
 * (the card time already showed local, so header and time disagreed). We render
 * UTC groups on the server / first paint (so hydration matches) and re-group in
 * the viewer's zone right after mount.
 */
export function ResultsByDay({ results }: { results: Result[] }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(true), []);

  const days = useMemo(() => {
    const zone = local ? undefined : 'UTC';
    const map = new Map<string, Result[]>();
    for (const r of results) {
      const key = new Date(r.kickoff).toLocaleDateString('en-CA', zone ? { timeZone: zone } : {}); // YYYY-MM-DD
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])); // newest day first
  }, [results, local]);

  const labelFor = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(local ? {} : { timeZone: 'UTC' }) });

  return (
    <>
      {days.map(([key, rows]) => (
        <section key={key} className="space-y-3">
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-terminal-muted" suppressHydrationWarning>
              {labelFor(rows[0]!.kickoff)}
            </span>
            <span className="h-px flex-1 bg-terminal-border" />
            <span className="text-xs text-terminal-muted">{rows.length} {rows.length === 1 ? 'match' : 'matches'}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => (
              <ResultCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ResultCard({ r }: { r: Result }) {
  const homeGoals = r.scorers.filter((s) => s.teamId === r.home.id);
  const awayGoals = r.scorers.filter((s) => s.teamId === r.away.id);
  const fmtGoals = (gs: typeof r.scorers) => gs.map((s) => `${s.name} ${s.minute}'${s.pen ? ' (P)' : ''}`).join(', ');

  return (
    <Link
      href={`/matches/${r.id}`}
      className="block rounded-lg border border-terminal-border bg-terminal-panel p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-1 items-center justify-end gap-2 truncate text-right">
          <span className="truncate font-medium text-terminal-bright">{r.home.name}</span>
          <span className="text-lg">{r.home.flag}</span>
        </span>
        <span className="tnum shrink-0 rounded bg-terminal-elevated px-3 py-1 text-lg font-bold text-terminal-bright">
          {r.homeScore}–{r.awayScore}
        </span>
        <span className="flex flex-1 items-center gap-2 truncate">
          <span className="text-lg">{r.away.flag}</span>
          <span className="truncate font-medium text-terminal-bright">{r.away.name}</span>
        </span>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-terminal-muted">
        {stageText(r)} · <LocalTime iso={r.kickoff} variant="time" />
        {r.penalties ? ` · ${r.penalties.home}–${r.penalties.away} pens` : ''}
      </p>

      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-terminal-muted">
          <span className="flex-1 text-right">{fmtGoals(homeGoals)}</span>
          <span className="shrink-0 text-terminal-border">·</span>
          <span className="flex-1 text-left">{fmtGoals(awayGoals)}</span>
        </div>
      )}

      {r.summary && <p className="mt-2.5 text-sm leading-relaxed text-terminal-text">{r.summary}</p>}
    </Link>
  );
}
