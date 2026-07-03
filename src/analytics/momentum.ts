/**
 * Momentum detectors — the "story" side of the tournament: comebacks, wins
 * against the run of play, and late/clutch goals. Pure functions over the match
 * list, shared by the "Ask the data" queries (ai/nlq) and the auto-detected
 * insight cards (ai/narratives) so both read one source of truth. (ENH-4/ENH-5)
 */
import type { Match, MatchStage } from '@/domain/types';

// ── Comebacks: the winner came from behind ───────────────────────────────────
export interface ComebackWin {
  match: Match;
  winnerId: string;
  deficit: number; // largest goal deficit the winner overturned
}

// Uses the goal timeline (was the winner ever behind on the running score?) when
// events are present, else the halftime score. Own goals credit the other side;
// shootout kicks (minute>120) excluded. A penalty-decided tie is not a win.
function trailedThenWon(m: Match): { winnerId: string; deficit: number } | null {
  const hWon = m.homeScore > m.awayScore, aWon = m.awayScore > m.homeScore;
  if (!hWon && !aWon) return null;
  const winnerHome = hWon;
  const winnerId = winnerHome ? m.homeTeamId : m.awayTeamId;
  const goals = (m.events ?? [])
    .filter((e) => (e.type === 'GOAL' || e.type === 'PENALTY_GOAL' || e.type === 'OWN_GOAL') && e.minute <= 120)
    .sort((a, b) => a.minute - b.minute);
  if (goals.length) {
    let h = 0, a = 0, deficit = 0, behind = false;
    for (const e of goals) {
      const scorer = e.type === 'OWN_GOAL' ? (e.teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId) : e.teamId;
      if (scorer === m.homeTeamId) h++; else a++;
      const ws = winnerHome ? h : a, os = winnerHome ? a : h;
      if (ws < os) { behind = true; deficit = Math.max(deficit, os - ws); }
    }
    return behind ? { winnerId, deficit } : null;
  }
  const wHT = winnerHome ? m.homeScoreHT : m.awayScoreHT;
  const oHT = winnerHome ? m.awayScoreHT : m.homeScoreHT;
  return wHT < oHT ? { winnerId, deficit: oHT - wHT } : null;
}

export function comebackWins(matches: Match[]): ComebackWin[] {
  const out: ComebackWin[] = [];
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    const c = trailedThenWon(m);
    if (c) out.push({ match: m, winnerId: c.winnerId, deficit: c.deficit });
  }
  return out.sort((a, b) => b.deficit - a.deficit || b.match.kickoff.localeCompare(a.match.kickoff));
}

// ── Possession upsets: won with a minority of the ball ───────────────────────
export interface PossessionUpset {
  match: Match;
  winnerId: string;
  possession: number;
}

export function possessionUpsets(matches: Match[]): PossessionUpset[] {
  const out: PossessionUpset[] = [];
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    const winnerId = m.homeScore > m.awayScore ? m.homeTeamId : m.awayScore > m.homeScore ? m.awayTeamId : null;
    if (!winnerId) continue;
    const pw = m.teamStats?.[winnerId]?.possession ?? null;
    if (pw === null || pw >= 50) continue;
    out.push({ match: m, winnerId, possession: pw });
  }
  return out.sort((a, b) => a.possession - b.possession);
}

// ── Clutch goals: late (85'+) decisive strikes ───────────────────────────────
export type ClutchKind = 'winner' | 'equaliser' | 'go-ahead';
export interface ClutchGoal {
  match: Match;
  teamId: string;
  playerId: string | null; // null for an own goal
  minute: number;
  kind: ClutchKind;
  stage: MatchStage;
}

// A goal at 85'+ (≤120') that took the scoring team level (equaliser) or ahead
// (go-ahead; "winner" if that side then won the match). Needs the goal timeline,
// so it's empty until events are backfilled.
export function clutchGoals(matches: Match[]): ClutchGoal[] {
  const out: ClutchGoal[] = [];
  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    const goals = (m.events ?? [])
      .filter((e) => (e.type === 'GOAL' || e.type === 'PENALTY_GOAL' || e.type === 'OWN_GOAL') && e.minute <= 120)
      .sort((a, b) => a.minute - b.minute);
    let h = 0, a = 0;
    for (const e of goals) {
      const scorerTeam = e.type === 'OWN_GOAL' ? (e.teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId) : e.teamId;
      const homeScored = scorerTeam === m.homeTeamId;
      const bH = h, bA = a;
      if (homeScored) h++; else a++;
      if (e.minute < 85 || e.minute > 120) continue;
      const sB = homeScored ? bH : bA, oB = homeScored ? bA : bH;
      const sA = homeScored ? h : a, oA = homeScored ? a : h;
      let kind: ClutchKind | null = null;
      if (sB < oB && sA === oA) kind = 'equaliser';
      else if (sB === oB && sA > oA) {
        const won = (homeScored && m.homeScore > m.awayScore) || (!homeScored && m.awayScore > m.homeScore);
        kind = won ? 'winner' : 'go-ahead';
      }
      if (kind) out.push({ match: m, teamId: scorerTeam, playerId: e.type === 'OWN_GOAL' ? null : (e.playerId ?? null), minute: e.minute, kind, stage: m.stage });
    }
  }
  const rank = (k: ClutchKind) => (k === 'winner' ? 0 : k === 'equaliser' ? 1 : 2);
  return out.sort((x, y) => rank(x.kind) - rank(y.kind) || y.minute - x.minute);
}
