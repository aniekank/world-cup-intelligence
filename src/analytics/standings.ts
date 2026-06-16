/**
 * Group standings engine. Builds each group table from the finished/live match
 * results, applying the full FIFA ranking criteria in order:
 *   1. Points  2. Goal difference  3. Goals scored
 *   4. Head-to-head points  5. Head-to-head GD  6. Head-to-head goals
 *   7. Fair-play (disciplinary) points  8. (drawing of lots — stable order)
 *
 * In the 48-team format the top 2 of each group plus the 8 best third-placed
 * teams advance, so we also expose the "best thirds" ranking.
 */

import type { Group, Match, StandingRow, Team, MatchResultLetter } from '@/domain/types';

interface Accum {
  teamId: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; points: number; disc: number;
  xgf: number; xga: number; form: MatchResultLetter[];
}

function blank(teamId: string): Accum {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, disc: 0, xgf: 0, xga: 0, form: [] };
}

function countsAsPlayed(m: Match): boolean {
  return m.status === 'FINISHED' || m.status === 'LIVE' || m.status === 'HALFTIME';
}

export function computeGroupStandings(group: Group, matches: Match[], teams: Map<string, Team>): StandingRow[] {
  const acc = new Map<string, Accum>();
  group.teamIds.forEach((id) => acc.set(id, blank(id)));

  const groupMatches = matches
    .filter((m) => m.groupId === group.id && countsAsPlayed(m))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  for (const m of groupMatches) {
    const h = acc.get(m.homeTeamId);
    const a = acc.get(m.awayTeamId);
    if (!h || !a) continue;
    const finished = m.status === 'FINISHED';
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    h.xgf += m.teamStats[m.homeTeamId]?.xG ?? 0;
    h.xga += m.teamStats[m.awayTeamId]?.xG ?? 0;
    a.xgf += m.teamStats[m.awayTeamId]?.xG ?? 0;
    a.xga += m.teamStats[m.homeTeamId]?.xG ?? 0;
    // Disciplinary: yellow -1, red -3 (FIFA fair-play, sign flipped for "points")
    h.disc += (m.teamStats[m.homeTeamId]?.yellowCards ?? 0) * 1 + (m.teamStats[m.homeTeamId]?.redCards ?? 0) * 3;
    a.disc += (m.teamStats[m.awayTeamId]?.yellowCards ?? 0) * 1 + (m.teamStats[m.awayTeamId]?.redCards ?? 0) * 3;

    if (finished) {
      if (m.homeScore > m.awayScore) { h.won++; a.lost++; h.points += 3; h.form.push('W'); a.form.push('L'); }
      else if (m.homeScore < m.awayScore) { a.won++; h.lost++; a.points += 3; a.form.push('W'); h.form.push('L'); }
      else { h.drawn++; a.drawn++; h.points++; a.points++; h.form.push('D'); a.form.push('D'); }
    }
  }

  const rows = [...acc.values()];

  // Head-to-head helper among tied teams
  function h2hPoints(ids: Set<string>): Map<string, { pts: number; gd: number; gf: number }> {
    const map = new Map<string, { pts: number; gd: number; gf: number }>();
    ids.forEach((id) => map.set(id, { pts: 0, gd: 0, gf: 0 }));
    for (const m of groupMatches) {
      if (m.status !== 'FINISHED') continue;
      if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
      const hm = map.get(m.homeTeamId)!;
      const am = map.get(m.awayTeamId)!;
      hm.gf += m.homeScore; hm.gd += m.homeScore - m.awayScore;
      am.gf += m.awayScore; am.gd += m.awayScore - m.homeScore;
      if (m.homeScore > m.awayScore) hm.pts += 3;
      else if (m.homeScore < m.awayScore) am.pts += 3;
      else { hm.pts++; am.pts++; }
    }
    return map;
  }

  const sorted = rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const agd = a.gf - a.ga;
    const bgd = b.gf - b.ga;
    if (bgd !== agd) return bgd - agd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    // Head-to-head among all teams tied on the above
    const tied = new Set(rows.filter((r) => r.points === a.points && r.gf - r.ga === agd && r.gf === a.gf).map((r) => r.teamId));
    if (tied.size > 1) {
      const h2h = h2hPoints(tied);
      const ah = h2h.get(a.teamId)!;
      const bh = h2h.get(b.teamId)!;
      if (bh.pts !== ah.pts) return bh.pts - ah.pts;
      if (bh.gd !== ah.gd) return bh.gd - ah.gd;
      if (bh.gf !== ah.gf) return bh.gf - ah.gf;
    }
    if (a.disc !== b.disc) return a.disc - b.disc; // fewer disciplinary points ranks higher
    return a.teamId.localeCompare(b.teamId);
  });

  const allPlayed = sorted.every((r) => r.played >= 3);

  return sorted.map((r, i) => {
    const rank = i + 1;
    let status: StandingRow['status'] = null;
    if (allPlayed) {
      status = rank <= 2 ? 'Q' : rank === 3 ? 'T' : 'E';
    }
    return {
      groupId: group.id,
      teamId: r.teamId,
      rank,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.gf,
      goalsAgainst: r.ga,
      goalDifference: r.gf - r.ga,
      points: r.points,
      disciplinaryPoints: r.disc,
      xGFor: Math.round(r.xgf * 10) / 10,
      xGAgainst: Math.round(r.xga * 10) / 10,
      form: r.form.slice(-5),
      qualificationProbability: 0, // filled by the simulator
      status,
    };
  });
}

/** Rank all third-placed teams to determine the 8 best (qualify to R32). */
export function rankBestThirds(standingsByGroup: StandingRow[][]): StandingRow[] {
  const thirds = standingsByGroup.map((g) => g[2]).filter((r): r is StandingRow => Boolean(r));
  return thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (a.disciplinaryPoints !== b.disciplinaryPoints) return a.disciplinaryPoints - b.disciplinaryPoints;
    return a.teamId.localeCompare(b.teamId);
  });
}
