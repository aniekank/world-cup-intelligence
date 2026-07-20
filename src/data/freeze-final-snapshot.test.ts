import { it, expect } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadTournamentSnapshot } from '@/data/loadTournament';
import { tournamentComplete, tournamentChampion } from '@/analytics/knockoutResults';

/**
 * FREEZE EXPORTER (task #38) — not a regression test; a one-off runner that uses
 * the real load path (API-Football + frozen SportMonks overlay) to produce the
 * pinned final snapshot at src/data/cache/wc2026-final.json. Run manually:
 *
 *   set -a && source .env && set +a && FREEZE_EXPORT=1 npx vitest run src/data/freeze-final-snapshot.test.ts
 *
 * Guarded: skips (fails soft) without an API key; refuses to write anything that
 * isn't a COMPLETE tournament with a champion.
 */
it('exports the frozen final snapshot', { timeout: 300_000 }, async () => {
  // Double opt-in: the regular suite must never hit the network or rewrite the pin.
  if (process.env.FREEZE_EXPORT !== '1' || !process.env.API_FOOTBALL_KEY) {
    console.warn('[freeze] Skipped (set FREEZE_EXPORT=1 with API_FOOTBALL_KEY to run the exporter).');
    return;
  }
  const snap = await loadTournamentSnapshot('live-2026');
  expect(snap.matches.length).toBeGreaterThan(100);
  expect(tournamentComplete(snap.matches)).toBe(true);
  const champ = tournamentChampion(snap.matches);
  expect(champ).toBeTruthy();

  // A fresh full load has fixtures/squads/stats but NOT the per-match event
  // timelines and team-stat overlays that production accumulated via the live
  // refresh ticks. Merge those from the committed prod export (final-export/,
  // captured the night of the final) wherever the fresh load is thinner.
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'data/cache/final-export/matches.json'), 'utf8'));
    const items: Record<string, unknown>[] = raw?.data?.matches ?? raw?.data ?? raw;
    const byId = new Map((items as { id: string }[]).map((m) => [m.id, m as unknown as Record<string, unknown>]));
    let merged = 0;
    snap.matches = snap.matches.map((m) => {
      const p = byId.get(m.id);
      if (!p) return m;
      const richer =
        ((p['events'] as unknown[])?.length ?? 0) > m.events.length ||
        Object.keys((p['teamStats'] as object) ?? {}).length > Object.keys(m.teamStats).length;
      if (!richer) return m;
      merged++;
      return {
        ...m,
        events: ((p['events'] as unknown as typeof m.events)?.length ?? 0) > m.events.length ? (p['events'] as unknown as typeof m.events) : m.events,
        teamStats: Object.keys((p['teamStats'] as object) ?? {}).length > Object.keys(m.teamStats).length ? (p['teamStats'] as unknown as typeof m.teamStats) : m.teamStats,
        penalties: m.penalties ?? ((p['penalties'] ?? null) as typeof m.penalties),
      };
    });
    console.log(`[freeze] Enriched ${merged} matches from the prod export (events/teamStats).`);
  } catch (e) {
    console.warn('[freeze] Prod-export merge skipped:', (e as Error).message);
  }

  const out = path.join(process.cwd(), 'src/data/cache/wc2026-final.json');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snap));
  console.log(`[freeze] Wrote ${out} — ${snap.matches.length} matches, ${snap.players.length} players, champion=${champ}.`);
});
