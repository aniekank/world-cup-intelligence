import 'server-only';
import { getTeam, getTeamMatches } from '@/data/store';
import type { Position } from '@/domain/types';

/**
 * Most-recent starting XI for a team + what changed from the previous match —
 * the manager's rotation and adjustments. Live source only (the XIs come from
 * SportMonks lineups; seeded/historical omit them, so this returns null).
 */
export interface LineupPlayer { id: string; name: string; pos: Position }
export interface LineupView {
  date: string;
  opponent: { code: string; name: string } | null;
  formation: string | null;
  xi: LineupPlayer[];
  changes: { in: LineupPlayer[]; out: LineupPlayer[]; vsOpponent: string } | null;
}

const POS_ORDER: Record<string, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

export function lineupView(teamId: string): LineupView | null {
  const finished = getTeamMatches(teamId)
    .filter((m) => m.status === 'FINISHED' && m.lineups?.[teamId]?.length)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  if (!finished.length) return null;

  const latest = finished[0]!;
  const xi = [...latest.lineups![teamId]!].sort((a, b) => (POS_ORDER[a.pos] ?? 9) - (POS_ORDER[b.pos] ?? 9));
  const oppId = latest.homeTeamId === teamId ? latest.awayTeamId : latest.homeTeamId;
  const opp = getTeam(oppId);
  const formation = latest.formations ? (latest.homeTeamId === teamId ? latest.formations.home : latest.formations.away) : null;

  let changes: LineupView['changes'] = null;
  const prev = finished[1];
  if (prev?.lineups?.[teamId]?.length) {
    const prevXi = prev.lineups[teamId]!;
    const prevIds = new Set(prevXi.map((p) => p.id));
    const currIds = new Set(xi.map((p) => p.id));
    const prevOppId = prev.homeTeamId === teamId ? prev.awayTeamId : prev.homeTeamId;
    changes = {
      in: xi.filter((p) => !prevIds.has(p.id)),
      out: prevXi.filter((p) => !currIds.has(p.id)),
      vsOpponent: getTeam(prevOppId)?.code ?? '',
    };
  }

  return { date: latest.kickoff, opponent: opp ? { code: opp.code, name: opp.name } : null, formation, xi, changes };
}
