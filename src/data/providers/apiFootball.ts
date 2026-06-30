/**
 * API-Football (api-sports.io v3) adapter — live 2026 World Cup with xG and
 * per-player/per-match statistics. Requires API_FOOTBALL_KEY (paid tier, from
 * ~$19/mo). Provides advanced metrics (xG totals, shots, passing, tackles) but
 * NOT per-shot coordinates, so `hasShotData = false` (shot maps degrade).
 *
 * Built to the documented v3 schema. Never throws into the render path; callers
 * fall back to simulation on failure.
 */

import type {
  Competition,
  Group,
  Team,
  Player,
  PlayerStats,
  Match,
  MatchTeamStats,
  DatasetSnapshot,
  Position,
  DetailedPosition,
} from '@/domain/types';
import { enrichTeam } from '@/data/enrichment';

const BASE = 'https://v3.football.api-sports.io';
const WORLD_CUP_LEAGUE = 1;
const SEASON = 2026;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * API-Football fetch with rate-limit resilience. Retries on HTTP 429 and on the
 * provider's body-level rate-limit error (it sometimes returns 200 + an errors
 * object), with increasing backoff. Without this, a startup burst silently
 * drops responses (e.g. empty squads).
 */
async function af<T>(path: string, apiKey: string, attempt = 0): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-apisports-key': apiKey },
      next: { revalidate: 300 },
    });
    if (res.status === 429) {
      if (attempt < 5) {
        await sleep(2000 * (attempt + 1));
        return af<T>(path, apiKey, attempt + 1);
      }
      throw new Error('api-football 429 (rate limit)');
    }
    if (!res.ok) {
      if (attempt < 3) {
        await sleep(600 * (attempt + 1));
        return af<T>(path, apiKey, attempt + 1);
      }
      throw new Error(`api-football ${path} → ${res.status}`);
    }
    const json = (await res.json()) as { response: T; errors?: unknown };
    const errs = json.errors;
    const hasErr = errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs as object).length > 0);
    if (hasErr && attempt < 5) {
      await sleep(2000 * (attempt + 1)); // usually a rate-limit message
      return af<T>(path, apiKey, attempt + 1);
    }
    return json.response;
  } catch (e) {
    if (attempt < 3) {
      await sleep(600 * (attempt + 1));
      return af<T>(path, apiKey, attempt + 1);
    }
    throw e;
  }
}

// ── External shapes (subset) ─────────────────────────────────
interface AFTeam { team: { id: number; name: string; code: string | null; logo: string }; }
interface AFFixture {
  fixture: { id: number; date: string; referee?: string | null; status: { short: string; elapsed: number | null }; venue: { name: string | null; city: string | null } };
  league: { round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null }; penalty: { home: number | null; away: number | null } };
}
interface AFPlayerRow {
  player: { id: number; name: string; firstname: string | null; lastname: string | null; age: number | null; height: string | null; photo: string };
  statistics: {
    team: { id: number };
    games: { appearences: number | null; minutes: number | null; position: string | null; number: number | null };
    goals: { total: number | null; assists: number | null; saves: number | null; conceded: number | null };
    shots: { total: number | null; on: number | null };
    passes: { total: number | null; key: number | null; accuracy: number | null };
    tackles: { total: number | null; interceptions: number | null };
    duels: { total: number | null; won: number | null };
    dribbles: { attempts: number | null; success: number | null };
    cards: { yellow: number | null; red: number | null };
    expected?: { goals?: number | null; assists?: number | null };
  }[];
}

function codeFor(name: string, code: string | null): string {
  return (code ?? name.slice(0, 3)).toUpperCase();
}

function mapStatus(short: string): Match['status'] {
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  if (['1H', '2H', 'ET', 'BT', 'LIVE', 'P'].includes(short)) return 'LIVE';
  if (short === 'HT') return 'HALFTIME';
  return 'SCHEDULED';
}

/** A single fixture's live state, keyed by our match id (`m-<fixtureId>`). */
export interface FixtureUpdate {
  id: string;
  status: Match['status'];
  minute: number;
  homeScore: number;
  awayScore: number;
  homeScoreHT: number;
  awayScoreHT: number;
  penalties: { home: number; away: number } | null;
  livePhase?: 'ET' | 'PEN' | 'BREAK';
}

/** One raw event from /fixtures/events, normalized but not yet mapped to our ids. */
export interface RawFixtureEvent {
  minute: number;
  extra: number;
  apiType: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string; // e.g. "Normal Goal", "Penalty", "Goal Disallowed - offside", "Yellow Card"
  teamName: string;
  playerApiId: number | null;
  assistApiId: number | null;
}

interface AFEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

/** Per-fixture timeline (goals, cards, subs, VAR). One API call per fixture. */
export async function fetchFixtureEvents(apiKey: string, fixtureId: number): Promise<RawFixtureEvent[]> {
  const res = await af<AFEvent[]>(`/fixtures/events?fixture=${fixtureId}`, apiKey).catch(() => [] as AFEvent[]);
  return (res ?? []).map((e) => ({
    minute: e.time?.elapsed ?? 0,
    extra: e.time?.extra ?? 0,
    apiType: e.type ?? '',
    detail: e.detail ?? '',
    teamName: e.team?.name ?? '',
    playerApiId: e.player?.id ?? null,
    assistApiId: e.assist?.id ?? null,
  }));
}

/**
 * Just the fixtures feed (one API call) — current status, score and minute for
 * every match. Used by the periodic live refresh so in-play games flip to LIVE
 * and scores update without re-fetching the heavy squad/player data.
 */
export async function fetchApiFootballFixtures(apiKey: string): Promise<FixtureUpdate[]> {
  const afFixtures = await af<AFFixture[]>(`/fixtures?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`, apiKey);
  return afFixtures.map((f) => {
    const status = mapStatus(f.fixture.status.short);
    return {
      id: `m-${f.fixture.id}`,
      status,
      minute: f.fixture.status.elapsed ?? (status === 'FINISHED' ? 90 : 0),
      homeScore: f.goals.home ?? 0,
      awayScore: f.goals.away ?? 0,
      homeScoreHT: f.score.halftime.home ?? 0,
      awayScoreHT: f.score.halftime.away ?? 0,
      penalties: f.score.penalty.home != null ? { home: f.score.penalty.home, away: f.score.penalty.away ?? 0 } : null,
    };
  });
}

function mapStage(round: string): Match['stage'] {
  const r = round.toLowerCase();
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'FINAL';
  if (r.includes('semi')) return 'SF';
  if (r.includes('quarter')) return 'QF';
  if (r.includes('16')) return 'R16';
  if (r.includes('32')) return 'R32';
  if (r.includes('3rd') || r.includes('third')) return 'THIRD_PLACE';
  return 'GROUP';
}

function matchdayFromRound(round: string): number {
  const m = round.match(/-\s*(\d+)/); // "Group Stage - 2" → 2
  return m ? Number(m[1]) : 1;
}

interface AFStandingsResp {
  league: { standings: { group: string; team: { id: number } }[][] };
}

function mapPosition(p: string | null): Position {
  const v = (p ?? '').toLowerCase();
  if (v === 'g' || v.includes('goal')) return 'GK';
  if (v === 'd' || v.includes('def')) return 'DF';
  if (v === 'm' || v.includes('mid')) return 'MF';
  if (v === 'f' || v.includes('att') || v.includes('forward') || v.includes('striker')) return 'FW';
  return 'MF';
}

interface AFSquad {
  players: { id: number; name: string; age: number | null; number: number | null; position: string | null }[];
}

function emptyStats(id: string): PlayerStats {
  return {
    playerId: id, minutes: 0, appearances: 0, goals: 0, assists: 0, xG: 0, xA: 0,
    shots: 0, shotsOnTarget: 0, bigChancesCreated: 0, bigChancesMissed: 0,
    passes: 0, passesCompleted: 0, progressivePasses: 0, progressiveCarries: 0,
    keyPasses: 0, tackles: 0, interceptions: 0, ballRecoveries: 0, duelsWon: 0,
    duelsTotal: 0, pressuresApplied: 0, pressRegains: 0, touches: 0, touchesInBox: 0,
    yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsWon: 0, saves: 0,
    goalsConceded: 0, cleanSheets: 0, formIndex: 50,
  };
}

export async function fetchApiFootballSnapshot(apiKey: string): Promise<DatasetSnapshot> {
  const [afTeams, afFixtures, afStandings] = await Promise.all([
    af<AFTeam[]>(`/teams?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`, apiKey),
    af<AFFixture[]>(`/fixtures?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`, apiKey),
    af<AFStandingsResp[]>(`/standings?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`, apiKey).catch(() => []),
  ]);

  const idToCode = new Map<number, string>();
  afTeams.forEach((t) => idToCode.set(t.team.id, codeFor(t.team.name, t.team.code)));
  const key = (id: number) => (idToCode.get(id) ?? `T${id}`).toLowerCase();

  // Group assignments come from the standings endpoint (rounds are matchdays)
  const groupByTeam = new Map<string, string>();
  for (const grp of afStandings?.[0]?.league?.standings ?? []) {
    const letter = (grp[0]?.group ?? '').match(/Group\s+([A-L])/i)?.[1]?.toUpperCase();
    if (!letter) continue;
    for (const row of grp) groupByTeam.set(key(row.team.id), letter);
  }

  const teams: Team[] = afTeams.map((t) => {
    const code = codeFor(t.team.name, t.team.code);
    const e = enrichTeam(code);
    return {
      id: code.toLowerCase(), name: t.team.name, code, flag: e.flag,
      confederation: e.confederation, groupId: groupByTeam.get(code.toLowerCase()) ?? null, fifaRanking: e.fifaRanking,
      elo: e.elo, preTournamentTitleOdds: e.preTournamentTitleOdds, manager: '—',
      attackRating: e.attackRating, defenseRating: e.defenseRating,
      primaryColor: e.primaryColor, squadIds: [],
    };
  });

  // Head coaches (best-effort, batched). The /coachs endpoint is per-team.
  try {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const batchSize = 8;
    for (let i = 0; i < afTeams.length; i += batchSize) {
      const batch = afTeams.slice(i, i + batchSize);
      const coaches = await Promise.all(
        batch.map((t) =>
          af<{ name: string; team?: { id: number } }[]>(`/coachs?team=${t.team.id}`, apiKey).catch(() => []),
        ),
      );
      batch.forEach((t, b) => {
        const current = (coaches[b] ?? []).find((c) => c.team?.id === t.team.id) ?? coaches[b]?.[0];
        const team = teamById.get(key(t.team.id));
        if (team && current?.name) team.manager = current.name;
      });
    }
  } catch {
    /* coaches are best-effort */
  }

  const matches: Match[] = afFixtures.map((f) => {
    const homeId = key(f.teams.home.id);
    const awayId = key(f.teams.away.id);
    const stage = mapStage(f.league.round);
    const groupId = stage === 'GROUP' ? groupByTeam.get(homeId) ?? null : null;
    const status = mapStatus(f.fixture.status.short);
    return {
      id: `m-${f.fixture.id}`, competitionId: 'wc-2026', stage,
      groupId, matchday: matchdayFromRound(f.league.round), kickoff: f.fixture.date, venue: f.fixture.venue.name ?? 'TBD',
      city: f.fixture.venue.city ?? '', status, minute: f.fixture.status.elapsed ?? (status === 'FINISHED' ? 90 : 0),
      homeTeamId: homeId, awayTeamId: awayId, homeScore: f.goals.home ?? 0, awayScore: f.goals.away ?? 0,
      homeScoreHT: f.score.halftime.home ?? 0, awayScoreHT: f.score.halftime.away ?? 0,
      penalties: f.score.penalty.home != null ? { home: f.score.penalty.home, away: f.score.penalty.away ?? 0 } : null,
      teamStats: {}, events: [], shots: [], bracketSlot: null,
    };
  });

  const players: Player[] = [];
  const playerStats: Record<string, PlayerStats> = {};
  const playerById = new Map<string, Player>();

  // API-Football's squad feed only exposes the broad role (GK/DF/MF/FW), not a
  // granular slot. Map each role to its representative detailed position so the
  // label is at least correct for the line — never a goalkeeper shown as 'CM'.
  const DETAIL: Record<Position, DetailedPosition> = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' };
  const newPlayer = (pid: string, name: string, tid: string, num: number, pos: Position, age: number, height: number): Player => ({
    id: pid, name, teamId: tid, shirtNumber: num, position: pos, detailedPosition: DETAIL[pos],
    age, heightCm: height, foot: 'right', club: '—', marketValueEur: 0,
    rating: { overall: 78, pace: 78, shooting: 78, passing: 78, dribbling: 78, defending: 78, physical: 78 },
  });

  // 1) Complete rosters from per-team squads (so EVERY player is present and
  //    searchable, not just those who've already played). Chunked to respect
  //    the API rate limit.
  for (let i = 0; i < afTeams.length; i += 5) {
    const batch = afTeams.slice(i, i + 5);
    const squads = await Promise.all(
      batch.map((t) => af<AFSquad[]>(`/players/squads?team=${t.team.id}`, apiKey).catch(() => [] as AFSquad[])),
    );
    if (i + 5 < afTeams.length) await sleep(250);
    batch.forEach((t, b) => {
      const tid = key(t.team.id);
      for (const sp of squads[b]?.[0]?.players ?? []) {
        const pid = `${tid}-${sp.id}`;
        if (playerById.has(pid)) continue;
        const p = newPlayer(pid, sp.name, tid, sp.number ?? 0, mapPosition(sp.position), sp.age ?? 0, 182);
        players.push(p);
        playerById.set(pid, p);
        playerStats[pid] = emptyStats(pid);
      }
    });
  }

  // 2) Overlay stats + full names from the league players endpoint (paginated)
  try {
    for (let page = 1; page <= 15; page++) {
      const res = await fetch(`${BASE}/players?league=${WORLD_CUP_LEAGUE}&season=${SEASON}&page=${page}`, {
        headers: { 'x-apisports-key': apiKey },
        next: { revalidate: 30 },
      });
      if (!res.ok) break;
      const json = (await res.json()) as { response: AFPlayerRow[]; paging: { current: number; total: number } };
      for (const row of json.response) {
        const stat = row.statistics[0];
        if (!stat) continue;
        const tid = key(stat.team.id);
        const pid = `${tid}-${row.player.id}`;
        const fullName = [row.player.firstname, row.player.lastname].filter(Boolean).join(' ').trim();
        let p = playerById.get(pid);
        if (!p) {
          p = newPlayer(pid, fullName || row.player.name, tid, stat.games.number ?? 0, mapPosition(stat.games.position), row.player.age ?? 0, parseInt(row.player.height ?? '182') || 182);
          players.push(p);
          playerById.set(pid, p);
          playerStats[pid] = emptyStats(pid);
        } else if (fullName) {
          p.name = fullName; // upgrade abbreviated squad name → full name
        }
        const ps = playerStats[pid] ?? emptyStats(pid);
        ps.minutes = stat.games.minutes ?? 0;
        ps.appearances = stat.games.appearences ?? 0;
        ps.goals = stat.goals.total ?? 0;
        ps.assists = stat.goals.assists ?? 0;
        ps.xG = stat.expected?.goals ?? 0;
        ps.xA = stat.expected?.assists ?? 0;
        ps.shots = stat.shots.total ?? 0;
        ps.shotsOnTarget = stat.shots.on ?? 0;
        ps.passes = stat.passes.total ?? 0;
        ps.passesCompleted = Math.round((stat.passes.total ?? 0) * ((stat.passes.accuracy ?? 0) / 100));
        ps.keyPasses = stat.passes.key ?? 0;
        ps.tackles = stat.tackles.total ?? 0;
        ps.interceptions = stat.tackles.interceptions ?? 0;
        ps.duelsTotal = stat.duels.total ?? 0;
        ps.duelsWon = stat.duels.won ?? 0;
        ps.progressiveCarries = stat.dribbles.success ?? 0;
        ps.saves = stat.goals.saves ?? 0;
        ps.goalsConceded = stat.goals.conceded ?? 0;
        ps.yellowCards = stat.cards.yellow ?? 0;
        ps.redCards = stat.cards.red ?? 0;
        playerStats[pid] = ps;
      }
      if (json.paging.current >= json.paging.total) break;
    }
  } catch {
    /* stats are best-effort; rosters from squads remain */
  }

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
    meta: { source: 'api-football', hasAdvancedMetrics: true, hasShotData: false },
  };
}

// ── Real team xG overlay ─────────────────────────────────────
// SportMonks (our primary live feed) gates xG behind a tier we don't have, but
// API-Football exposes `expected_goals` per fixture. We pull it and overlay it
// onto the SportMonks matches, joined by team + kickoff date. Player-level xG has
// no source for the WC (neither provider exposes it), so it stays absent.

interface AFStatRow { team: { id: number; name: string }; statistics: { type: string; value: number | string | null }[]; }

// API-Football spellings that differ from ours (normalized: lowercase, letters
// only). Verified by comparing both squads' 48 names for WC2026.
const AF_XG_NAME_ALIASES: Record<string, string> = {
  southkorea: 'korearepublic',
  czechia: 'czechrepublic',
  bosniaherzegovina: 'bosniaandherzegovina',
  usa: 'unitedstates',
  ivorycoast: 'cotedivoire',
};
const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

/**
 * Overlay real team xG onto `matches` (mutates `teamStats[id].xG` in place).
 * Best-effort; skips matches that already carry real xG. Returns #updated.
 */
export async function attachApiFootballXg(matches: Match[], teams: Team[], apiKey: string): Promise<number> {
  const byNorm = new Map<string, Team>();
  for (const t of teams) byNorm.set(normName(t.name), t);
  const resolve = (afName: string): Team | undefined => {
    const n = normName(afName);
    return byNorm.get(n) ?? byNorm.get(AF_XG_NAME_ALIASES[n] ?? ' ');
  };
  const day = (iso: string) => iso.slice(0, 10);
  const pair = (a: string, b: string) => [a, b].sort().join('|');
  const byKeyDate = new Map<string, Match>();
  const byPair = new Map<string, Match[]>();
  for (const m of matches) {
    byKeyDate.set(`${pair(m.homeTeamId, m.awayTeamId)}|${day(m.kickoff)}`, m);
    const arr = byPair.get(pair(m.homeTeamId, m.awayTeamId));
    if (arr) arr.push(m); else byPair.set(pair(m.homeTeamId, m.awayTeamId), [m]);
  }

  const fixtures = await af<AFFixture[]>(`/fixtures?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`, apiKey);
  const jobs: { fx: AFFixture; m: Match; home: Team; away: Team }[] = [];
  for (const fx of fixtures) {
    if (!['FT', 'AET', 'PEN'].includes(fx.fixture.status.short)) continue; // finished only
    const home = resolve(fx.teams.home.name);
    const away = resolve(fx.teams.away.name);
    if (!home || !away) continue;
    let m = byKeyDate.get(`${pair(home.id, away.id)}|${day(fx.fixture.date)}`);
    if (!m) { const c = byPair.get(pair(home.id, away.id)); if (c && c.length === 1) m = c[0]; } // unique-pair fallback (tz date slip)
    if (!m) continue;
    if ((m.teamStats?.[m.homeTeamId]?.xG ?? 0) > 0) continue; // already enriched
    jobs.push({ fx, m, home, away });
  }

  let updated = 0;
  const BATCH = 4; // small concurrency — `af()` already retries on 429
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(jobs.slice(i, i + BATCH).map(async ({ fx, m, home, away }) => {
      let stats: AFStatRow[];
      try { stats = await af<AFStatRow[]>(`/fixtures/statistics?fixture=${fx.fixture.id}`, apiKey); } catch { return; }
      const xgOf = (afId: number): number | null => {
        const v = stats.find((s) => s.team.id === afId)?.statistics.find((x) => x.type === 'expected_goals')?.value;
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
      };
      const hx = xgOf(fx.teams.home.id);
      const ax = xgOf(fx.teams.away.id);
      if (hx == null && ax == null) return;
      const ts = (m.teamStats ?? (m.teamStats = {})) as Record<string, MatchTeamStats>;
      const put = (id: string, xg: number | null) => { if (xg == null) return; const cur = ts[id] ?? ({ teamId: id } as MatchTeamStats); cur.xG = xg; ts[id] = cur; };
      put(home.id, hx); // xG belongs to the team, not the home/away slot
      put(away.id, ax);
      updated++;
    }));
  }
  return updated;
}

// ── Per-match team stats / formations / referee (post-SportMonks) ────────────
// SportMonks supplied these on its snapshot; API-Football has them too, on
// separate endpoints we now call. For matches frozen before the SportMonks trial
// lapsed the overlay already fills these (with PPDA/field-tilt SportMonks derived
// and AF can't); this enrichment covers FUTURE matches — every finished game that
// still lacks possession — so each new knockout round reports live without code
// changes. PPDA/field-tilt aren't in AF's fixture stats, so they stay neutral.

interface AFLineup { team: { id: number }; formation: string | null; startXI?: { player: { id: number; name: string; pos: string | null } }[] }

/**
 * Fill possession/shots/passes/corners/cards/saves + formations + referee on
 * finished `matches` that don't already carry them (mutates in place). Joined by
 * team name + date, like the xG overlay. Best-effort; returns #matches updated.
 */
export async function attachApiFootballMatchStats(matches: Match[], teams: Team[], apiKey: string): Promise<number> {
  const byNorm = new Map<string, Team>();
  for (const t of teams) byNorm.set(normName(t.name), t);
  const resolve = (afName: string): Team | undefined => {
    const n = normName(afName);
    return byNorm.get(n) ?? byNorm.get(AF_XG_NAME_ALIASES[n] ?? ' ');
  };
  const day = (iso: string) => iso.slice(0, 10);
  const pair = (a: string, b: string) => [a, b].sort().join('|');
  const byKeyDate = new Map<string, Match>();
  const byPair = new Map<string, Match[]>();
  for (const m of matches) {
    byKeyDate.set(`${pair(m.homeTeamId, m.awayTeamId)}|${day(m.kickoff)}`, m);
    const arr = byPair.get(pair(m.homeTeamId, m.awayTeamId));
    if (arr) arr.push(m); else byPair.set(pair(m.homeTeamId, m.awayTeamId), [m]);
  }

  const fixtures = await af<AFFixture[]>(`/fixtures?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`, apiKey);
  const jobs: { fx: AFFixture; m: Match; home: Team; away: Team }[] = [];
  for (const fx of fixtures) {
    if (!['FT', 'AET', 'PEN'].includes(fx.fixture.status.short)) continue; // finished only
    const home = resolve(fx.teams.home.name);
    const away = resolve(fx.teams.away.name);
    if (!home || !away) continue;
    let m = byKeyDate.get(`${pair(home.id, away.id)}|${day(fx.fixture.date)}`);
    if (!m) { const c = byPair.get(pair(home.id, away.id)); if (c && c.length === 1) m = c[0]; }
    if (!m) continue;
    if ((m.teamStats?.[m.homeTeamId]?.possession ?? 0) > 0) continue; // already has tactical stats (frozen or prior run)
    jobs.push({ fx, m, home, away });
  }

  let updated = 0;
  const BATCH = 3; // 2 calls per job — keep concurrency modest (af() retries 429)
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(jobs.slice(i, i + BATCH).map(async ({ fx, m, home, away }) => {
      const [stats, lineups] = await Promise.all([
        af<AFStatRow[]>(`/fixtures/statistics?fixture=${fx.fixture.id}`, apiKey).catch(() => [] as AFStatRow[]),
        af<AFLineup[]>(`/fixtures/lineups?fixture=${fx.fixture.id}`, apiKey).catch(() => [] as AFLineup[]),
      ]);
      if (!stats.length) return;
      const num = (afId: number, type: string): number => {
        const v = stats.find((s) => s.team.id === afId)?.statistics.find((x) => x.type === type)?.value;
        const n = typeof v === 'string' ? parseFloat(v) : v; // "55%" → 55
        return typeof n === 'number' && Number.isFinite(n) ? n : 0;
      };
      const build = (afId: number, teamId: string): MatchTeamStats => ({
        teamId,
        possession: num(afId, 'Ball Possession'),
        shots: num(afId, 'Total Shots'),
        shotsOnTarget: num(afId, 'Shots on Goal'),
        xG: m.teamStats?.[teamId]?.xG ?? (() => { const v = num(afId, 'expected_goals'); return v; })(),
        corners: num(afId, 'Corner Kicks'),
        fouls: num(afId, 'Fouls'),
        offsides: num(afId, 'Offsides'),
        passes: num(afId, 'Total passes'),
        passAccuracy: num(afId, 'Passes %'),
        fieldTilt: 50, // AF fixture stats lack dangerous-attacks → neutral (SportMonks-only)
        ppda: 0, // AF fixture stats lack tackles/interceptions → press index degrades
        bigChances: 0,
        saves: num(afId, 'Goalkeeper Saves'),
        yellowCards: num(afId, 'Yellow Cards'),
        redCards: num(afId, 'Red Cards'),
      });
      const ts: Record<string, MatchTeamStats> = {};
      if (num(fx.teams.home.id, 'Ball Possession') > 0 || num(fx.teams.away.id, 'Ball Possession') > 0) {
        ts[home.id] = build(fx.teams.home.id, home.id);
        ts[away.id] = build(fx.teams.away.id, away.id);
        m.teamStats = ts;
      }
      // Formations + starting XI.
      const fmHome = lineups.find((l) => l.team.id === fx.teams.home.id);
      const fmAway = lineups.find((l) => l.team.id === fx.teams.away.id);
      if (fmHome?.formation && fmAway?.formation) m.formations = { home: fmHome.formation, away: fmAway.formation };
      if (fx.fixture.referee) m.referee = fx.fixture.referee.trim();
      updated++;
    }));
  }
  return updated;
}
