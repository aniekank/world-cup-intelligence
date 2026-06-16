/**
 * football-data.org (v4) adapter — maps the live FIFA World Cup feed into the
 * platform's domain types. The free tier supplies competition, teams, fixtures,
 * standings and top scorers; it does NOT supply shot-level data, so xG/PPDA and
 * other Opta-grade metrics are left at 0 (the analytics engine degrades to
 * ELO/form-based models when advanced metrics are absent). Swap in a licensed
 * Opta/StatsBomb feed here to populate the full metric set.
 *
 * Requires FOOTBALL_DATA_API_KEY. Never throws into the render path — callers
 * fall back to the simulation provider on any failure.
 */

import type {
  Competition,
  Group,
  Team,
  Player,
  PlayerStats,
  Match,
  DatasetSnapshot,
} from '@/domain/types';
import { enrichTeam } from '@/data/enrichment';

const BASE = 'https://api.football-data.org/v4';
const COMP = 'WC'; // FIFA World Cup competition code

// ── External (football-data.org) shapes, loosely typed ───────
interface FDTeam {
  id: number;
  name: string;
  tla: string | null;
  crest: string | null;
  coach?: { name?: string } | null;
  squad?: { id: number; name: string; position: string | null; dateOfBirth: string | null; shirtNumber?: number | null }[];
}
interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  venue?: string | null;
  homeTeam: { id: number; name: string; tla: string | null };
  awayTeam: { id: number; name: string; tla: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}
interface FDScorer {
  player: { id: number; name: string };
  team: { id: number };
  goals: number | null;
  assists: number | null;
  penalties: number | null;
}

async function fd<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': apiKey },
    // Cache live data briefly at the edge
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`football-data ${path} → ${res.status}`);
  return (await res.json()) as T;
}

function mapStatus(s: string): Match['status'] {
  if (s === 'FINISHED' || s === 'AWARDED') return 'FINISHED';
  if (s === 'IN_PLAY') return 'LIVE';
  if (s === 'PAUSED') return 'HALFTIME';
  return 'SCHEDULED';
}

function mapStage(s: string): Match['stage'] {
  switch (s) {
    case 'GROUP_STAGE':
      return 'GROUP';
    case 'LAST_32':
      return 'R32';
    case 'LAST_16':
      return 'R16';
    case 'QUARTER_FINALS':
      return 'QF';
    case 'SEMI_FINALS':
      return 'SF';
    case 'FINAL':
      return 'FINAL';
    case 'THIRD_PLACE':
      return 'THIRD_PLACE';
    default:
      return 'GROUP';
  }
}

function mapPosition(p: string | null): Player['position'] {
  const v = (p ?? '').toLowerCase();
  if (v.includes('keeper') || v === 'goalkeeper') return 'GK';
  if (v.includes('back') || v.includes('defen')) return 'DF';
  if (v.includes('mid')) return 'MF';
  return 'FW';
}

function ageFromDob(dob: string | null): number {
  if (!dob) return 26;
  const y = new Date(dob).getUTCFullYear();
  return Math.max(16, Math.min(44, 2026 - y));
}

function emptyStats(playerId: string): PlayerStats {
  return {
    playerId, minutes: 0, appearances: 0, goals: 0, assists: 0, xG: 0, xA: 0,
    shots: 0, shotsOnTarget: 0, bigChancesCreated: 0, bigChancesMissed: 0,
    passes: 0, passesCompleted: 0, progressivePasses: 0, progressiveCarries: 0,
    keyPasses: 0, tackles: 0, interceptions: 0, ballRecoveries: 0, duelsWon: 0,
    duelsTotal: 0, pressuresApplied: 0, pressRegains: 0, touches: 0, touchesInBox: 0,
    yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsWon: 0, saves: 0,
    goalsConceded: 0, cleanSheets: 0, formIndex: 50,
  };
}

/** Fetch and map the live World Cup into a DatasetSnapshot. */
export async function fetchWorldCupSnapshot(apiKey: string): Promise<DatasetSnapshot> {
  const [teamsRes, matchesRes, scorersRes] = await Promise.all([
    fd<{ teams: FDTeam[] }>(`/competitions/${COMP}/teams`, apiKey),
    fd<{ matches: FDMatch[] }>(`/competitions/${COMP}/matches`, apiKey),
    fd<{ scorers: FDScorer[] }>(`/competitions/${COMP}/scorers?limit=100`, apiKey).catch(() => ({ scorers: [] })),
  ]);

  const idToCode = new Map<number, string>();
  teamsRes.teams.forEach((t) => idToCode.set(t.id, (t.tla ?? t.name.slice(0, 3)).toUpperCase()));
  const codeKey = (id: number) => (idToCode.get(id) ?? `T${id}`).toLowerCase();

  // Teams + squads
  const teams: Team[] = [];
  const players: Player[] = [];
  const playerStats: Record<string, PlayerStats> = {};

  teamsRes.teams.forEach((t) => {
    const id = codeKey(t.id);
    const code = (t.tla ?? t.name.slice(0, 3)).toUpperCase();
    const e = enrichTeam(code);
    teams.push({
      id,
      name: t.name,
      code,
      flag: e.flag,
      confederation: e.confederation,
      groupId: null, // filled from standings/matches below
      fifaRanking: e.fifaRanking,
      elo: e.elo,
      preTournamentTitleOdds: e.preTournamentTitleOdds,
      manager: t.coach?.name ?? 'Unknown',
      attackRating: e.attackRating,
      defenseRating: e.defenseRating,
      primaryColor: e.primaryColor,
      squadIds: [],
    });
    (t.squad ?? []).forEach((s, i) => {
      const pid = `${id}-p${s.id}`;
      players.push({
        id: pid,
        name: s.name,
        teamId: id,
        shirtNumber: s.shirtNumber ?? i + 1,
        position: mapPosition(s.position),
        detailedPosition: 'CM',
        age: ageFromDob(s.dateOfBirth),
        heightCm: 182,
        foot: 'right',
        club: '—',
        marketValueEur: 0,
        rating: { overall: 75, pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75 },
      });
      playerStats[pid] = emptyStats(pid);
    });
  });

  const teamByCode = new Map(teams.map((t) => [t.id, t]));
  teams.forEach((t) => (t.squadIds = players.filter((p) => p.teamId === t.id).map((p) => p.id)));

  // Matches + group inference
  const matches: Match[] = matchesRes.matches.map((m) => {
    const homeId = codeKey(m.homeTeam.id);
    const awayId = codeKey(m.awayTeam.id);
    const groupId = m.group ? m.group.replace('GROUP_', '') : null;
    if (groupId) {
      const h = teamByCode.get(homeId);
      const a = teamByCode.get(awayId);
      if (h && !h.groupId) h.groupId = groupId;
      if (a && !a.groupId) a.groupId = groupId;
    }
    return {
      id: `m-${m.id}`,
      competitionId: 'wc-2026',
      stage: mapStage(m.stage),
      groupId,
      matchday: m.matchday ?? 1,
      kickoff: m.utcDate,
      venue: m.venue ?? 'TBD',
      city: '',
      status: mapStatus(m.status),
      minute: mapStatus(m.status) === 'FINISHED' ? 90 : 0,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: m.score.fullTime.home ?? 0,
      awayScore: m.score.fullTime.away ?? 0,
      homeScoreHT: m.score.halfTime.home ?? 0,
      awayScoreHT: m.score.halfTime.away ?? 0,
      penalties: m.score.penalties && m.score.penalties.home != null
        ? { home: m.score.penalties.home, away: m.score.penalties.away ?? 0 }
        : null,
      teamStats: {},
      events: [],
      shots: [],
      bracketSlot: null,
    };
  });

  // Top scorers → seed goal/assist tallies on matching players (by name)
  const playerByName = new Map(players.map((p) => [p.name.toLowerCase(), p]));
  scorersRes.scorers.forEach((s) => {
    const p = playerByName.get(s.player.name.toLowerCase());
    if (p && playerStats[p.id]) {
      const st = playerStats[p.id]!;
      st.goals = s.goals ?? 0;
      st.assists = s.assists ?? 0;
      st.minutes = Math.max(st.minutes, 90);
      st.appearances = Math.max(st.appearances, 1);
    }
  });

  // Groups
  const groupLetters = [...new Set(teams.map((t) => t.groupId).filter(Boolean))].sort() as string[];
  const groups: Group[] = groupLetters.map((letter) => ({
    id: letter,
    competitionId: 'wc-2026',
    name: `Group ${letter}`,
    teamIds: teams.filter((t) => t.groupId === letter).map((t) => t.id),
  }));

  const competition: Competition = {
    id: 'wc-2026',
    name: 'FIFA World Cup 2026',
    season: '2026',
    hostCountries: ['United States', 'Canada', 'Mexico'],
    startDate: '2026-06-11',
    endDate: '2026-07-19',
    numTeams: teams.length,
    numGroups: groups.length,
    currentMatchday: Math.max(1, ...matches.map((m) => m.matchday)),
    logoEmoji: '🏆',
  };

  return {
    competition,
    groups,
    teams,
    players,
    playerStats,
    matches,
    generatedAt: new Date().toISOString(),
    meta: { source: 'football-data.org', hasAdvancedMetrics: false, hasShotData: false },
  };
}
