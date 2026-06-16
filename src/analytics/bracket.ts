/**
 * Projected knockout bracket.
 *
 * Builds the most-likely Round-of-32 → Final tree from the current projected
 * qualifiers (top 2 of each group by live standing, plus the 8 most-probable
 * third-placed teams), seeds them with standard tournament seeding, and
 * projects each tie with an ELO win expectancy. The "projected" winner (higher
 * probability side) propagates forward so the whole tree is populated, while
 * each node keeps both sides' advance probabilities for the UI.
 */

import { eloExpectation } from './elo';
import type { StandingRow, Team, TeamForecast, BracketNode, MatchStage } from '@/domain/types';

function seedOrder(n: number): number[] {
  let rounds = [1, 2];
  while (rounds.length < n) {
    const sum = rounds.length * 2 + 1;
    const next: number[] = [];
    for (const s of rounds) {
      next.push(s);
      next.push(sum - s);
    }
    rounds = next;
  }
  return rounds;
}

interface Qualifier {
  teamId: string;
  label: string; // "1A", "2C", "3rd"
  seedScore: number;
}

export function buildBracket(
  standingsByGroup: StandingRow[][],
  forecasts: Map<string, TeamForecast>,
  teams: Map<string, Team>,
): BracketNode[] {
  const qualifiers: Qualifier[] = [];

  for (const g of standingsByGroup) {
    const first = g[0];
    const second = g[1];
    if (first) {
      qualifiers.push({
        teamId: first.teamId,
        label: `1${first.groupId}`,
        seedScore: 0 - first.points * 100 - first.goalDifference * 10 - (teams.get(first.teamId)?.elo ?? 0) / 100,
      });
    }
    if (second) {
      qualifiers.push({
        teamId: second.teamId,
        label: `2${second.groupId}`,
        seedScore: 1000 - second.points * 100 - second.goalDifference * 10 - (teams.get(second.teamId)?.elo ?? 0) / 100,
      });
    }
  }

  // Bracket size adapts to the format (8 groups → 16, 12 groups → 32)
  const numGroups = standingsByGroup.length;
  const directQ = numGroups * 2;
  const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
  const bracketSize = isPow2(directQ) ? directQ : 1 << Math.ceil(Math.log2(directQ));
  const thirdsNeeded = Math.max(0, bracketSize - directQ);

  // Best thirds (by knockout-reach probability) to fill the bracket
  const thirds = standingsByGroup
    .map((g) => g[2])
    .filter((r): r is StandingRow => Boolean(r))
    .sort((a, b) => (forecasts.get(b.teamId)?.reachR32 ?? 0) - (forecasts.get(a.teamId)?.reachR32 ?? 0))
    .slice(0, thirdsNeeded);
  thirds.forEach((t) =>
    qualifiers.push({
      teamId: t.teamId,
      label: `3${t.groupId}`,
      seedScore: 2000 - t.points * 100 - t.goalDifference * 10 - (teams.get(t.teamId)?.elo ?? 0) / 100,
    }),
  );

  // Pad with placeholders if the group stage is still early
  while (qualifiers.length < bracketSize) {
    qualifiers.push({ teamId: '', label: 'TBD', seedScore: 9999 + qualifiers.length });
  }

  const bySeed = qualifiers.sort((a, b) => a.seedScore - b.seedScore).slice(0, bracketSize);
  const order = seedOrder(bracketSize);
  const slots: Qualifier[] = new Array(bracketSize);
  order.forEach((seedNo, i) => (slots[i] = bySeed[seedNo - 1]!));

  const nodes: BracketNode[] = [];
  // Build stages from the bracket size down to the final
  const ALL_STAGES: { stage: MatchStage; size: number; prefix: string }[] = [
    { stage: 'R32', size: 32, prefix: 'R32' },
    { stage: 'R16', size: 16, prefix: 'R16' },
    { stage: 'QF', size: 8, prefix: 'QF' },
    { stage: 'SF', size: 4, prefix: 'SF' },
    { stage: 'FINAL', size: 2, prefix: 'FINAL' },
  ];
  const stages = ALL_STAGES.filter((s) => s.size <= bracketSize).map((s) => ({
    stage: s.stage,
    count: s.size / 2,
    prefix: s.prefix,
  }));

  // Round 0 sides
  let currentSides: { teamId: string; label: string }[] = slots.map((q) => ({ teamId: q.teamId, label: q.label }));

  stages.forEach((st, stageIdx) => {
    const winners: { teamId: string; label: string }[] = [];
    for (let i = 0; i < st.count; i++) {
      const home = currentSides[i * 2] ?? { teamId: '', label: 'TBD' };
      const away = currentSides[i * 2 + 1] ?? { teamId: '', label: 'TBD' };
      const slot = st.count === 1 ? 'FINAL' : `${st.prefix}-${i + 1}`;
      const nextSlot =
        stageIdx < stages.length - 1
          ? stages[stageIdx + 1]!.count === 1
            ? 'FINAL'
            : `${stages[stageIdx + 1]!.prefix}-${Math.floor(i / 2) + 1}`
          : null;

      let homeProb = 0.5;
      if (home.teamId && away.teamId) {
        homeProb = eloExpectation(teams.get(home.teamId)?.elo ?? 1700, teams.get(away.teamId)?.elo ?? 1700, 0);
      } else if (home.teamId) homeProb = 1;
      else if (away.teamId) homeProb = 0;

      const winner = homeProb >= 0.5 ? home : away;
      winners.push({ teamId: winner.teamId, label: winner.label });

      nodes.push({
        slot,
        stage: st.stage,
        matchId: null,
        homeTeamId: home.teamId || null,
        awayTeamId: away.teamId || null,
        homeLabel: home.label,
        awayLabel: away.label,
        winnerTeamId: winner.teamId || null,
        feedsInto: nextSlot,
        homeAdvanceProb: Math.round(homeProb * 1000) / 1000,
        awayAdvanceProb: Math.round((1 - homeProb) * 1000) / 1000,
      });
    }
    currentSides = winners;
  });

  return nodes;
}
