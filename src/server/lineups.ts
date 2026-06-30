import 'server-only';
import { getTeam, getTeamMatches, getPlayer, getPlayers } from '@/data/store';
import type { Position } from '@/domain/types';

/**
 * Most-recent starting XI for a team + what changed from the previous match —
 * the manager's rotation and adjustments. Live source only (the XIs come from
 * the live feed's lineups; seeded/historical omit them, so this returns null).
 */
export interface LineupPlayer { id: string; name: string; pos: Position; linkable?: boolean }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const surnameOf = (name: string) => { const t = name.trim().split(/\s+/); return norm(t[t.length - 1] ?? name); };
const firstInitial = (name: string) => (norm(name.trim().split(/\s+/)[0] ?? '')[0] ?? '');

/**
 * Make a lineup player's id point at a real player in the active store, so
 * `/players/[id]` never 404s. The frozen-overlay lineups (captured under
 * SportMonks ids) don't match the live API-Football player ids after the feed
 * migration, so a raw id can dangle — re-resolve it by name within the team.
 *
 * Matching requires surname AND first initial, and accepts ONLY a unique
 * candidate: a squad routinely has two players sharing a surname (Ivory Coast:
 * Seko vs Yahia Fofana, Yan vs Ousmane Diomande), and sending a click to the
 * WRONG player is worse than no link. When the match is absent or ambiguous we
 * keep the original id (stable React key) but mark it non-linkable, so the UI
 * shows the name as plain text — never a 404, never a mis-link. (WC-052)
 */
function resolveLineupId(teamId: string, p: LineupPlayer): LineupPlayer {
  if (getPlayer(p.id)) return { ...p, linkable: true };
  const sur = surnameOf(p.name);
  const fi = firstInitial(p.name);
  const candidates = getPlayers().filter((q) => q.teamId === teamId && surnameOf(q.name) === sur && firstInitial(q.name) === fi);
  return candidates.length === 1 ? { ...p, id: candidates[0]!.id, linkable: true } : { ...p, linkable: false };
}
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
    // Compare by the raw (consistent across matches) ids, then resolve the
    // surviving in/out players to live store ids for linking.
    changes = {
      in: xi.filter((p) => !prevIds.has(p.id)).map((p) => resolveLineupId(teamId, p)),
      out: prevXi.filter((p) => !currIds.has(p.id)).map((p) => resolveLineupId(teamId, p)),
      vsOpponent: getTeam(prevOppId)?.code ?? '',
    };
  }

  return {
    date: latest.kickoff,
    opponent: opp ? { code: opp.code, name: opp.name } : null,
    formation,
    xi: xi.map((p) => resolveLineupId(teamId, p)),
    changes,
  };
}
