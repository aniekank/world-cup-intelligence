/**
 * Domain model for the World Cup Intelligence Platform.
 *
 * These types are the single source of truth shared by the data layer,
 * the analytics engine, the AI layer, the API, and the UI. They mirror the
 * production Prisma schema (see prisma/schema.prisma) so that swapping the
 * seeded in-memory store for Postgres is a drop-in change.
 */

// ─────────────────────────────────────────────────────────────
// Primitives & enums
// ─────────────────────────────────────────────────────────────

export type ID = string;
export type ISODate = string;

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export type DetailedPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'DM'
  | 'CM'
  | 'AM'
  | 'LW'
  | 'RW'
  | 'CF'
  | 'ST';

export type Foot = 'left' | 'right' | 'both';

export type MatchStage =
  | 'GROUP'
  | 'R32'
  | 'R16'
  | 'QF'
  | 'SF'
  | 'FINAL'
  | 'THIRD_PLACE';

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HALFTIME' | 'FINISHED';

export type EventType =
  | 'GOAL'
  | 'OWN_GOAL'
  | 'PENALTY_GOAL'
  | 'PENALTY_MISS'
  | 'ASSIST'
  | 'YELLOW_CARD'
  | 'SECOND_YELLOW'
  | 'RED_CARD'
  | 'SUBSTITUTION'
  | 'SHOT'
  | 'SHOT_ON_TARGET'
  | 'CHANCE'
  | 'VAR';

export type ShotBodyPart = 'left_foot' | 'right_foot' | 'head' | 'other';
export type ShotOutcome =
  | 'goal'
  | 'saved'
  | 'blocked'
  | 'off_target'
  | 'post'
  | 'penalty_goal'
  | 'penalty_missed';
export type ShotSituation =
  | 'open_play'
  | 'fast_break'
  | 'set_piece'
  | 'corner'
  | 'free_kick'
  | 'penalty'
  | 'direct_free_kick';

// ─────────────────────────────────────────────────────────────
// Competition / Tournament structure
// ─────────────────────────────────────────────────────────────

export interface Competition {
  id: ID;
  name: string; // "FIFA World Cup 2026"
  season: string; // "2026"
  hostCountries: string[]; // ["USA", "Canada", "Mexico"]
  startDate: ISODate;
  endDate: ISODate;
  numTeams: number; // 48
  numGroups: number; // 12
  currentMatchday: number;
  logoEmoji: string;
}

export interface Group {
  id: ID; // "A".."L"
  competitionId: ID;
  name: string; // "Group A"
  teamIds: ID[];
}

/** A single line in a group table (computed by the standings engine). */
export interface StandingRow {
  groupId: ID;
  teamId: ID;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  // Tournament-grade tiebreakers
  disciplinaryPoints: number; // FIFA fair-play
  xGFor: number;
  xGAgainst: number;
  form: MatchResultLetter[]; // most recent last
  qualificationProbability: number; // 0..1, Monte Carlo derived
  /** "Q" qualified, "E" eliminated, "T" thirds race, null if undecided */
  status: 'Q' | 'E' | 'T' | null;
}

export type MatchResultLetter = 'W' | 'D' | 'L';

// ─────────────────────────────────────────────────────────────
// Teams
// ─────────────────────────────────────────────────────────────

export interface Team {
  id: ID;
  name: string;
  code: string; // FIFA 3-letter, e.g. "BRA"
  flag: string; // emoji
  confederation: Confederation;
  groupId: ID | null;
  fifaRanking: number;
  elo: number; // pre-tournament ELO, updated live by the engine
  // Pre-tournament market expectations (for over/under-performance analytics)
  preTournamentTitleOdds: number; // implied probability 0..1
  manager: string;
  // Latent strength ratings (Poisson rate parameters), 0..100 scale
  attackRating: number;
  defenseRating: number;
  primaryColor: string;
  squadIds: ID[];
}

// ─────────────────────────────────────────────────────────────
// Players
// ─────────────────────────────────────────────────────────────

export interface Player {
  id: ID;
  name: string;
  teamId: ID;
  shirtNumber: number;
  position: Position;
  detailedPosition: DetailedPosition;
  age: number;
  birthDate?: string; // ISO yyyy-mm-dd when known (live); used to join club affiliations (WC-024)
  photo?: string; // real head-shot URL when the source provides one (live); else procedural portrait
  heightCm: number;
  foot: Foot;
  club: string;
  marketValueEur: number; // millions
  // Latent per-90 ability ratings (0..100), drive the simulation
  rating: {
    overall: number;
    // Per-attribute scouting ratings are modeled (seeded / historical only).
    // Live data (SportMonks) has no FIFA-style attributes, so these are omitted
    // there and the UI shows the real match rating instead. (WC-023)
    pace?: number;
    shooting?: number;
    passing?: number;
    dribbling?: number;
    defending?: number;
    physical?: number;
  };
}

/**
 * Accumulated tournament statistics for a player. Computed by aggregating
 * the event/shot streams. Per-90 and percentile values are derived in the
 * analytics layer.
 */
export interface PlayerStats {
  playerId: ID;
  minutes: number;
  appearances: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  shots: number;
  shotsOnTarget: number;
  bigChancesCreated: number;
  bigChancesMissed: number;
  passes: number;
  passesCompleted: number;
  progressivePasses: number;
  progressiveCarries: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  ballRecoveries: number;
  duelsWon: number;
  duelsTotal: number;
  pressuresApplied: number;
  pressRegains: number;
  touches: number;
  touchesInBox: number;
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  foulsWon: number;
  // GK-only (0 for outfield)
  saves: number;
  goalsConceded: number;
  cleanSheets: number;
  // Derived/loaded by analytics
  formIndex: number; // 0..100 rolling form
}

// ─────────────────────────────────────────────────────────────
// Matches
// ─────────────────────────────────────────────────────────────

export interface Match {
  id: ID;
  competitionId: ID;
  stage: MatchStage;
  groupId: ID | null;
  matchday: number;
  kickoff: ISODate;
  venue: string;
  city: string;
  status: MatchStatus;
  minute: number; // live clock; 0 if scheduled, 90/120 if finished
  homeTeamId: ID;
  awayTeamId: ID;
  homeScore: number;
  awayScore: number;
  homeScoreHT: number;
  awayScoreHT: number;
  penalties: { home: number; away: number } | null;
  // Team-level match statistics (one record per side)
  teamStats: Record<ID, MatchTeamStats>;
  events: MatchEvent[];
  shots: Shot[];
  // Bracket linkage for knockout matches
  bracketSlot: string | null; // e.g. "QF1"
  // Starting formations per side (live source only), e.g. { home: '4-3-3', away: '5-3-2' }.
  formations?: { home: string; away: string };
  // International broadcast listings, grouped by country (live source only).
  tvListings?: MatchTvCountry[];
}

/** A broadcaster carrying a fixture. */
export interface TvBroadcaster {
  name: string;
  logo: string;
  url: string;
}

/** Broadcasters for one country, for the "Where to watch" panel. */
export interface MatchTvCountry {
  code: string; // ISO-3166 alpha-2 (uppercase)
  country: string;
  flag: string; // emoji
  stations: TvBroadcaster[];
}

export interface MatchTeamStats {
  teamId: ID;
  possession: number; // 0..100
  shots: number;
  shotsOnTarget: number;
  xG: number;
  corners: number;
  fouls: number;
  offsides: number;
  passes: number;
  passAccuracy: number; // 0..100
  fieldTilt: number; // 0..100 share of final-third touches
  ppda: number; // passes allowed per defensive action (press intensity)
  bigChances: number;
  saves: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchEvent {
  id: ID;
  matchId: ID;
  minute: number;
  addedTime: number;
  type: EventType;
  teamId: ID;
  playerId: ID | null;
  relatedPlayerId: ID | null; // assist provider / player subbed off
  detail: string;
  xG?: number;
}

export interface Shot {
  id: ID;
  matchId: ID;
  minute: number;
  teamId: ID;
  playerId: ID;
  /** Pitch coordinates normalised 0..100 (x: own goal→opp goal, y: left→right) */
  x: number;
  y: number;
  xG: number;
  bodyPart: ShotBodyPart;
  situation: ShotSituation;
  outcome: ShotOutcome;
  isBigChance: boolean;
}

// ─────────────────────────────────────────────────────────────
// Predictions / Simulation outputs
// ─────────────────────────────────────────────────────────────

export interface MatchPrediction {
  matchId: ID;
  homeWin: number;
  draw: number;
  awayWin: number;
  // Most likely correct-score grid (top entries)
  scoreline: { home: number; away: number; prob: number }[];
  expectedGoals: { home: number; away: number };
  homeCleanSheet: number;
  awayCleanSheet: number;
  bttsProb: number; // both teams to score
  over25Prob: number;
}

export interface TeamForecast {
  teamId: ID;
  // Monte Carlo probabilities (0..1) of reaching each stage
  reachR32: number;
  reachR16: number;
  reachQF: number;
  reachSF: number;
  reachFinal: number;
  winTitle: number;
  groupWin: number;
  expectedFinish: number; // expected finishing rank
  // Over/under performance vs pre-tournament market
  titleProbabilityDelta: number; // current - preTournament
  powerRating: number; // current tournament power rating
  powerRank: number;
}

export interface BracketNode {
  slot: string; // "R32-1" ... "FINAL"
  stage: MatchStage;
  matchId: ID | null;
  homeTeamId: ID | null;
  awayTeamId: ID | null;
  homeLabel: string; // "1A", "Winner QF1", etc.
  awayLabel: string;
  winnerTeamId: ID | null;
  feedsInto: string | null; // next slot
  // Simulated probability each side advances from this node
  homeAdvanceProb: number;
  awayAdvanceProb: number;
}

export interface GoldenBootProjection {
  playerId: ID;
  currentGoals: number;
  currentXG: number;
  projectedGoals: number; // end-of-tournament expectation
  projectedFinishRank: number;
  winProbability: number; // P(wins golden boot)
}

// ─────────────────────────────────────────────────────────────
// Rankings / Power
// ─────────────────────────────────────────────────────────────

export interface PowerRankingRow {
  teamId: ID;
  rank: number;
  previousRank: number;
  powerRating: number;
  offenseRating: number;
  defenseRating: number;
  elo: number;
  momentum: number; // -100..100 team momentum index
  trend: 'up' | 'down' | 'flat';
}

// ─────────────────────────────────────────────────────────────
// AI layer
// ─────────────────────────────────────────────────────────────

export type InsightKind =
  | 'upset'
  | 'overperformer'
  | 'underperformer'
  | 'breakout'
  | 'form'
  | 'tactical'
  | 'wall'
  | 'milestone'
  | 'prediction';

export interface Insight {
  id: ID;
  kind: InsightKind;
  severity: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  entityType: 'team' | 'player' | 'match' | 'tournament';
  entityId: ID | null;
  metrics: { label: string; value: string }[];
  createdAt: ISODate;
}

export interface NLQueryResult {
  query: string;
  intent: string;
  answer: string;
  // Tabular evidence backing the answer
  columns: string[];
  rows: (string | number)[][];
  entityType: 'team' | 'player' | 'match' | 'tournament' | 'mixed';
  vizHint: 'table' | 'bar' | 'scatter' | 'none';
  followUps: string[];
}

// ─────────────────────────────────────────────────────────────
// User / personalization
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: ID;
  handle: string;
  displayName: string;
  role: 'fan' | 'journalist' | 'scout' | 'analyst' | 'creator' | 'fantasy' | 'bettor';
  favoriteTeamIds: ID[];
  favoritePlayerIds: ID[];
  watchlistMatchIds: ID[];
  createdAt: ISODate;
}

export interface Notification {
  id: ID;
  userId: ID;
  type: 'goal' | 'kickoff' | 'result' | 'lineup' | 'insight' | 'upset';
  title: string;
  body: string;
  entityId: ID | null;
  read: boolean;
  createdAt: ISODate;
}

// ─────────────────────────────────────────────────────────────
// Aggregated, denormalized view models (what the API serves)
// ─────────────────────────────────────────────────────────────

export interface PlayerView extends Player {
  team: Pick<Team, 'id' | 'name' | 'code' | 'flag'> & { confederation?: Confederation };
  stats: PlayerStats;
  per90: Record<string, number>;
  percentiles: Record<string, number>; // 0..100 vs positional peers
}

export interface TeamView extends Team {
  group: Group | null;
  standing: StandingRow | null;
  forecast: TeamForecast | null;
  powerRanking: PowerRankingRow | null;
  recentMatches: Match[];
}

export interface DatasetMeta {
  source: string; // 'simulation' | 'statsbomb-open-data' | 'football-data.org' | 'api-football'
  hasAdvancedMetrics: boolean; // xG, progressive actions, pressures available
  hasShotData: boolean; // per-shot coordinates available (shot maps)
  modeledMetrics?: string[]; // stat keys that are estimated/modeled, not measured (label "est.")
}

export interface DatasetSnapshot {
  competition: Competition;
  groups: Group[];
  teams: Team[];
  players: Player[];
  playerStats: Record<ID, PlayerStats>;
  matches: Match[];
  generatedAt: ISODate;
  meta?: DatasetMeta;
}
