/**
 * SportMonks (api.sportmonks.com v3) adapter — live 2026 World Cup WITH real
 * per-player advanced data: xG, big chances, key passes, through balls, passes in
 * the final third, ball recoveries, tackles, interceptions, duels, dribbles,
 * touches, and player ratings. A major depth upgrade over API-Football, which
 * carried only basic stats.
 *
 * Honest derivations (see DERIVED_* below): SportMonks doesn't expose xA,
 * discrete progressive passes/carries, pressures, or touches-in-box, so we map
 * to the closest *real* metric it does provide (final-third passes → progressive
 * passes, successful dribbles → progressive carries) and model xA transparently
 * from big chances + key passes. touches-in-box / pressures are left empty and
 * the UI degrades them (see datasetMeta.hasAdvancedMetrics handling).
 */

import { enrichTeam } from '@/data/enrichment';
import type {
  DatasetSnapshot,
  Team,
  Player,
  PlayerStats,
  Match,
  MatchEvent,
  Group,
  Competition,
  Position,
  DetailedPosition,
  EventType,
} from '@/domain/types';

const BASE = 'https://api.sportmonks.com/v3/football';
const WC_SEASON = 26618; // FIFA World Cup 2026 (league 732)

/** SportMonks statistic type_ids → meaning (confirmed against live WC data). */
const T = {
  goals: 52, assists: 79, xG: 5304, xGoT: 5305,
  shots: 42, sot: 86, shotsInBox: 49,
  bigChancesCreated: 580, chancesCreated: 9706, keyPasses: 117, throughBalls: 124,
  finalThirdPasses: 27269, passes: 80, accuratePasses: 116, passAcc: 1584,
  tackles: 78, tacklesWon: 27267, interceptions: 100, clearances: 101,
  ballRecovery: 27271, duelsTotal: 105, duelsWon: 106,
  dribbleAtt: 108, dribbles: 109, touches: 120, dispossessed: 94, possessionLost: 27273,
  rating: 118, minutes: 119, yellow: 84, red: 83, saves: 57, conceded: 88,
  fouls: 56, foulsDrawn: 96, aerialsWon: 107,
} as const;

// Use SportMonks' real 3-letter code (MEX, RSA, KOR…) — name-slicing collides
// (Australia/Austria → AUS, Iran/Iraq → IRA) and merges distinct teams.
const codeFor = (p: SMParticipant): string => (p.short_code || p.name.slice(0, 3)).toUpperCase();

const POS: Record<number, Position> = { 24: 'GK', 25: 'DF', 26: 'MF', 27: 'FW' };
const mapPosition = (id: number | null): Position => (id != null && POS[id]) || 'MF';
const DETAIL: Record<Position, DetailedPosition> = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' };

function mapStatus(dev: string | undefined): Match['status'] {
  const s = (dev ?? '').toUpperCase();
  if (s === 'FT' || s === 'AET' || s === 'FT_PEN' || s === 'AWARDED') return 'FINISHED';
  if (s === 'HT') return 'HALFTIME';
  if (s.startsWith('INPLAY') || s === 'BREAK' || s === 'EXTRA_TIME' || s === 'PENALTIES') return 'LIVE';
  return 'SCHEDULED';
}

function mapEventType(name: string): EventType {
  const n = name.toLowerCase();
  if (n.includes('own')) return 'OWN_GOAL';
  if (n.includes('penalty') && n.includes('miss')) return 'PENALTY_MISS';
  if (n.includes('penalty')) return 'PENALTY_GOAL';
  if (n === 'goal' || n.includes('goal')) return 'GOAL';
  if (n.includes('yellow')) return 'YELLOW_CARD';
  if (n.includes('red')) return 'RED_CARD';
  if (n.includes('subst')) return 'SUBSTITUTION';
  if (n.includes('var')) return 'VAR';
  return 'VAR';
}

interface SMResp<T> {
  data: T;
  pagination?: { has_more: boolean };
}

async function smGet<T>(path: string, apiKey: string): Promise<SMResp<T>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: apiKey },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`sportmonks ${path} → ${res.status}`);
  return (await res.json()) as SMResp<T>;
}

/** Paginated list fetch (follows pagination.has_more). */
async function smList<T>(path: string, apiKey: string, cap = 6): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= cap; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await smGet<T[]>(`${path}${sep}page=${page}`, apiKey);
    out.push(...(r.data ?? []));
    if (!r.pagination?.has_more) break;
  }
  return out;
}

// ── SportMonks response shapes (only what we use) ────────────────────────────
interface SMParticipant { id: number; name: string; short_code?: string | null; meta?: { location?: 'home' | 'away' } }
interface SMScore { participant_id: number; score: { goals: number; participant: string }; description: string }
interface SMFixture {
  id: number;
  name: string;
  starting_at: string;
  state_id: number;
  group_id: number | null;
  round_id: number | null;
  placeholder?: boolean;
  participants?: SMParticipant[];
  scores?: SMScore[];
  state?: { developer_name?: string };
  group?: { name?: string };
  round?: { name?: string };
}
interface SMDetail { type_id: number; data?: { value?: number } }
interface SMLineup { player_id: number; team_id: number; position_id: number | null; jersey_number: number | null; player_name: string; details?: SMDetail[] }
interface SMEvent { type?: { name?: string }; minute?: number; player_id?: number | null; participant_id?: number | null }

const emptyStats = (id: string): PlayerStats => ({
  playerId: id, minutes: 0, appearances: 0, goals: 0, assists: 0, xG: 0, xA: 0,
  shots: 0, shotsOnTarget: 0, bigChancesCreated: 0, bigChancesMissed: 0,
  passes: 0, passesCompleted: 0, progressivePasses: 0, progressiveCarries: 0,
  keyPasses: 0, tackles: 0, interceptions: 0, ballRecoveries: 0, duelsWon: 0,
  duelsTotal: 0, pressuresApplied: 0, pressRegains: 0, touches: 0, touchesInBox: 0,
  yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsWon: 0, saves: 0,
  goalsConceded: 0, cleanSheets: 0, formIndex: 50,
});

export async function fetchSportMonksSnapshot(apiKey: string): Promise<DatasetSnapshot> {
  // 1) All WC2026 fixtures with teams, scores, state, group/round.
  const fixturesRaw = await smList<SMFixture>(
    `/fixtures?filters=fixtureSeasons:${WC_SEASON}&include=participants;scores;state;group;round&per_page=50`,
    apiKey,
  );

  // Drop knockout PLACEHOLDER fixtures ("2nd Group D vs 2nd Group G", "Winner
  // Match 85") — their participants are fake and would inflate the team count.
  const isRealName = (n: string) =>
    !!n && !/group|winner|loser|runner|\bplace\b|qualif|\bvs\b|\d\s*(st|nd|rd|th)\b/i.test(n);
  const fixtures = fixturesRaw.filter(
    (f) => !f.placeholder && (f.participants ?? []).length === 2 && (f.participants ?? []).every((p) => isRealName(p.name)),
  );

  // 2) Teams (from participants) + group assignment (from group-stage fixtures).
  const teamById = new Map<number, Team>();
  const codeByApiId = new Map<number, string>();
  const groupByCode = new Map<string, string>();
  for (const f of fixtures) {
    const groupLetter = f.group?.name?.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() ?? null;
    for (const p of f.participants ?? []) {
      if (!teamById.has(p.id)) {
        const code = codeFor(p);
        const e = enrichTeam(code);
        codeByApiId.set(p.id, code.toLowerCase());
        teamById.set(p.id, {
          id: code.toLowerCase(), name: p.name, code, flag: e.flag,
          confederation: e.confederation, groupId: null, fifaRanking: e.fifaRanking,
          elo: e.elo, preTournamentTitleOdds: e.preTournamentTitleOdds, manager: '—',
          attackRating: e.attackRating, defenseRating: e.defenseRating,
          primaryColor: e.primaryColor, squadIds: [],
        });
      }
      if (groupLetter) groupByCode.set(codeByApiId.get(p.id)!, groupLetter);
    }
  }
  for (const [code, letter] of groupByCode) {
    const t = [...teamById.values()].find((x) => x.id === code);
    if (t) t.groupId = letter;
  }

  // 3) Matches.
  const matches: Match[] = fixtures
    .map((f): Match | null => {
      const home = (f.participants ?? []).find((p) => p.meta?.location === 'home');
      const away = (f.participants ?? []).find((p) => p.meta?.location === 'away');
      if (!home || !away) return null; // placeholder bracket fixture (TBD)
      const homeId = codeByApiId.get(home.id);
      const awayId = codeByApiId.get(away.id);
      if (!homeId || !awayId) return null; // unresolved team — skip rather than crash
      const cur = (f.scores ?? []).filter((s) => s.description === 'CURRENT');
      const ht = (f.scores ?? []).filter((s) => s.description === '1ST_HALF');
      const goalsFor = (pid: number, set: SMScore[]) => set.find((s) => s.participant_id === pid)?.score.goals ?? 0;
      const status = mapStatus(f.state?.developer_name);
      const groupLetter = f.group?.name?.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() ?? groupByCode.get(homeId) ?? null;
      return {
        id: `m-${f.id}`, competitionId: 'wc-2026', stage: 'GROUP', groupId: groupLetter,
        matchday: 1, kickoff: f.starting_at ? `${f.starting_at.replace(' ', 'T')}Z` : new Date().toISOString(),
        venue: 'TBD', city: '',
        status, minute: status === 'FINISHED' ? 90 : 0,
        homeTeamId: homeId, awayTeamId: awayId,
        homeScore: goalsFor(home.id, cur), awayScore: goalsFor(away.id, cur),
        homeScoreHT: goalsFor(home.id, ht), awayScoreHT: goalsFor(away.id, ht),
        penalties: null, teamStats: {}, events: [], shots: [], bracketSlot: null,
      };
    })
    .filter((m): m is Match => m !== null);

  // 4) Per-player stats aggregated from PLAYED fixtures' lineups, plus events.
  const players: Player[] = [];
  const playerStats: Record<string, PlayerStats> = {};
  const byId = new Map<string, Player>();
  const ratingSum = new Map<string, { sum: number; n: number }>();

  const played = fixtures.filter((f) => mapStatus(f.state?.developer_name) === 'FINISHED');
  for (const f of played) {
    const detail = await smGet<SMFixture & { lineups?: SMLineup[]; events?: SMEvent[] }>(
      `/fixtures/${f.id}?include=lineups.details;events.type`,
      apiKey,
    ).catch(() => null);
    if (!detail?.data) continue;
    const m = matches.find((x) => x.id === `m-${f.id}`);

    for (const lp of detail.data.lineups ?? []) {
      const code = codeByApiId.get(lp.team_id);
      if (!code) continue;
      const pid = `${code}-${lp.player_id}`;
      if (!byId.has(pid)) {
        const p: Player = {
          id: pid, name: lp.player_name, teamId: code, shirtNumber: lp.jersey_number ?? 0,
          position: mapPosition(lp.position_id), detailedPosition: DETAIL[mapPosition(lp.position_id)],
          age: 0, heightCm: 182, foot: 'right', club: '—', marketValueEur: 0,
          rating: { overall: 76, pace: 76, shooting: 76, passing: 76, dribbling: 76, defending: 76, physical: 76 },
        };
        players.push(p);
        byId.set(pid, p);
        playerStats[pid] = emptyStats(pid);
      }
      const s = playerStats[pid]!;
      const v = (id: number) => (lp.details ?? []).find((d) => d.type_id === id)?.data?.value ?? 0;
      s.appearances += 1;
      s.minutes += v(T.minutes);
      s.goals += v(T.goals);
      s.assists += v(T.assists);
      s.xG += v(T.xG);
      s.shots += v(T.shots);
      s.shotsOnTarget += v(T.sot);
      s.bigChancesCreated += v(T.bigChancesCreated);
      s.keyPasses += v(T.keyPasses);
      s.passes += v(T.passes);
      s.passesCompleted += v(T.accuratePasses);
      s.progressivePasses += v(T.finalThirdPasses); // real metric, honest proxy for progression
      s.progressiveCarries += v(T.dribbles); // successful dribbles ≈ ball carrying
      s.tackles += v(T.tackles);
      s.interceptions += v(T.interceptions);
      s.ballRecoveries += v(T.ballRecovery);
      s.duelsWon += v(T.duelsWon);
      s.duelsTotal += v(T.duelsTotal);
      s.touches += v(T.touches);
      s.yellowCards += v(T.yellow);
      s.redCards += v(T.red);
      s.saves += v(T.saves);
      s.goalsConceded += v(T.conceded);
      s.foulsCommitted += v(T.fouls);
      s.foulsWon += v(T.foulsDrawn);
      // xA: modeled transparently (SportMonks has no xA) — big chances are worth
      // more than ordinary key passes. Surfaced as "xA (est.)" in the UI.
      s.xA += 0.3 * v(T.bigChancesCreated) + 0.05 * Math.max(0, v(T.keyPasses) - v(T.bigChancesCreated));
      const r = v(T.rating);
      if (r > 0) {
        const acc = ratingSum.get(pid) ?? { sum: 0, n: 0 };
        acc.sum += r; acc.n += 1;
        ratingSum.set(pid, acc);
      }
    }

    // Match events (goals, cards, subs, VAR).
    if (m) {
      const evs: MatchEvent[] = [];
      (detail.data.events ?? []).forEach((e, i) => {
        const code = e.participant_id != null ? codeByApiId.get(e.participant_id) : undefined;
        const pid = e.player_id != null && code ? `${code}-${e.player_id}` : null;
        evs.push({
          id: `m-${f.id}-e${i}`, matchId: `m-${f.id}`, minute: e.minute ?? 0, addedTime: 0,
          type: mapEventType(e.type?.name ?? ''), teamId: code ?? '',
          playerId: pid && byId.has(pid) ? pid : null, relatedPlayerId: null, detail: e.type?.name ?? '',
        });
      });
      m.events = evs;
    }
  }

  // formIndex from average SportMonks match rating (×10), clamped.
  for (const [pid, acc] of ratingSum) {
    if (acc.n > 0 && playerStats[pid]) {
      playerStats[pid]!.formIndex = Math.max(1, Math.min(100, Math.round((acc.sum / acc.n) * 10)));
    }
  }

  // squadIds per team.
  const teams = [...teamById.values()];
  teams.forEach((t) => (t.squadIds = players.filter((p) => p.teamId === t.id).map((p) => p.id)));

  const groupLetters = [...new Set(teams.map((t) => t.groupId).filter(Boolean))].sort() as string[];
  const groups: Group[] = groupLetters.map((letter) => ({
    id: letter, competitionId: 'wc-2026', name: `Group ${letter}`,
    teamIds: teams.filter((t) => t.groupId === letter).map((t) => t.id),
  }));

  const competition: Competition = {
    id: 'wc-2026', name: 'FIFA World Cup 2026', season: '2026',
    hostCountries: ['United States', 'Canada', 'Mexico'], startDate: '2026-06-11',
    endDate: '2026-07-19', numTeams: teams.length, numGroups: groups.length,
    currentMatchday: 1, logoEmoji: '🏆',
  };

  return {
    competition, groups, teams, players, playerStats, matches,
    generatedAt: new Date().toISOString(),
    // We now have real xG + advanced stats; no shot-coordinate data (xgfixture
    // is a separate add-on), so shot maps stay off.
    meta: { source: 'sportmonks', hasAdvancedMetrics: true, hasShotData: false },
  };
}
