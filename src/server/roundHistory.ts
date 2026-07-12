import 'server-only';
import { TOURNAMENTS } from '@/data/tournaments';
import { loadTournamentSnapshot } from '@/data/loadTournament';
import { canonNation } from './knockoutHistory';
import type { Match, MatchStage, Team } from '@/domain/types';

/**
 * "This round, the last four World Cups" — the current knockout round set
 * against the same round of the previous N men's editions (ENH-6).
 *
 * Everything here is historical fact read from the archive (datahub + StatsBomb
 * editions) — scores, shootouts, who was there. The only model number is the
 * comparison line the page composes against the current ties' expected goals.
 * Honest-data notes: the archive doesn't flag extra time unless a shootout
 * happened (a 2-1 AET win looks like a 2-1 win), so no "after 90'" claims are
 * made about history — goals are final-score totals, and only penalties are
 * called out explicitly.
 */

export interface RoundHistoryMatch {
  homeName: string; homeFlag: string; awayName: string; awayFlag: string;
  homeScore: number; awayScore: number;
  penalties: { home: number; away: number } | null;
  winnerName: string | null;
}
export interface RoundHistoryEdition {
  year: number;
  label: string;
  matches: RoundHistoryMatch[];
}
export interface RoundHistoryData {
  stage: MatchStage;
  editions: RoundHistoryEdition[]; // newest first
  games: number;
  goals: number;
  goalsPerGame: number;
  shootouts: number;
  biggest: { desc: string; year: number } | null; // largest margin at this round
  /** Which of the CURRENT round's teams were at this round in those editions. */
  presence: { name: string; flag: string; years: number[] }[];
}

const winnerId = (m: Match): string | null => {
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  if (m.penalties) return m.penalties.home >= m.penalties.away ? m.homeTeamId : m.awayTeamId;
  return null;
};

export interface EditionInput {
  year: number;
  label: string;
  matches: Match[];
  teams: Team[];
}

/** Pure aggregation — testable without snapshot loading. */
export function buildRoundHistory(
  editions: EditionInput[],
  stage: MatchStage,
  currentTeams: { name: string; flag: string }[],
): RoundHistoryData {
  const out: RoundHistoryEdition[] = [];
  let games = 0, goals = 0, shootouts = 0;
  let biggest: { desc: string; year: number; margin: number } | null = null;
  const presenceYears = new Map<string, number[]>(); // canon name → years

  for (const ed of [...editions].sort((a, b) => b.year - a.year)) {
    const teamById = new Map(ed.teams.map((t) => [t.id, t]));
    const rows: RoundHistoryMatch[] = [];
    for (const m of ed.matches) {
      if (m.stage !== stage || m.status !== 'FINISHED') continue;
      const h = teamById.get(m.homeTeamId), a = teamById.get(m.awayTeamId);
      if (!h || !a) continue;
      const wId = winnerId(m);
      rows.push({
        homeName: h.name, homeFlag: h.flag, awayName: a.name, awayFlag: a.flag,
        homeScore: m.homeScore, awayScore: m.awayScore, penalties: m.penalties,
        winnerName: wId ? (teamById.get(wId)?.name ?? null) : null,
      });
      games++;
      goals += m.homeScore + m.awayScore;
      if (m.penalties) shootouts++;
      const margin = Math.abs(m.homeScore - m.awayScore);
      if (margin > 0 && (!biggest || margin > biggest.margin)) {
        const wName = margin === 0 ? '' : (m.homeScore > m.awayScore ? h.name : a.name);
        const lName = m.homeScore > m.awayScore ? a.name : h.name;
        const hi = Math.max(m.homeScore, m.awayScore), lo = Math.min(m.homeScore, m.awayScore);
        biggest = { desc: `${wName} ${hi}–${lo} ${lName}`, year: ed.year, margin };
      }
      for (const t of [h, a]) {
        const k = canonNation(t.name);
        const ys = presenceYears.get(k) ?? [];
        if (!ys.includes(ed.year)) ys.push(ed.year);
        presenceYears.set(k, ys);
      }
    }
    if (rows.length > 0) out.push({ year: ed.year, label: ed.label, matches: rows });
  }

  const presence = currentTeams.map((t) => ({
    name: t.name,
    flag: t.flag,
    years: (presenceYears.get(canonNation(t.name)) ?? []).sort((a, b) => a - b),
  }));

  return {
    stage,
    editions: out,
    games,
    goals,
    goalsPerGame: games > 0 ? Math.round((goals / games) * 100) / 100 : 0,
    shootouts,
    biggest: biggest ? { desc: biggest.desc, year: biggest.year } : null,
    presence,
  };
}

const cache = new Map<string, RoundHistoryData>();

/**
 * The last `lastN` men's editions that actually contain this round, compared to
 * the current one. Editions load once and memoize (same snapshots the knockout
 * history panel already warms).
 */
export async function roundHistoryView(
  stage: MatchStage,
  currentTeams: { name: string; flag: string }[],
  lastN = 4,
): Promise<RoundHistoryData | null> {
  if (stage === 'GROUP' || stage === 'THIRD_PLACE') return null;
  const key = `${stage}|${currentTeams.map((t) => canonNation(t.name)).sort().join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const editions: EditionInput[] = [];
  const candidates = TOURNAMENTS
    .filter((t) => (t.source === 'statsbomb' || t.source === 'datahub') && t.gender === 'men')
    .sort((a, b) => b.year - a.year);
  for (const t of candidates) {
    if (editions.length >= lastN) break;
    try {
      const snap = await loadTournamentSnapshot(t.id);
      if (!snap.matches.some((m) => m.stage === stage && m.status === 'FINISHED')) continue; // old formats lack e.g. R32
      editions.push({ year: t.year, label: t.label, matches: snap.matches, teams: snap.teams });
    } catch {
      continue; // an unloadable edition just narrows the window
    }
  }
  if (editions.length === 0) return null;

  const data = buildRoundHistory(editions, stage, currentTeams);
  cache.set(key, data);
  return data;
}
