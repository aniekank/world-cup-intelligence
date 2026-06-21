/**
 * Deterministic tournament generator.
 *
 * From a single seed this builds the entire dataset: competition, 12 groups,
 * 48 teams, 26-man squads, the full group fixture list, and a match-by-match
 * simulation that emits per-shot xG, event streams, team stats, and updates
 * ELO live. Player tournament stats are aggregated from the simulated streams,
 * so goals, xG, assists and the golden-boot race are all internally consistent.
 */

import { Rng, hashSeed } from './prng';
import { SEED_TEAMS, type SeedTeam } from './teams';
import { NAME_BANKS, TEAM_REGION, CLUBS, VENUES } from './pool';
import type {
  Competition,
  Group,
  Team,
  Player,
  PlayerStats,
  Match,
  MatchEvent,
  Shot,
  MatchTeamStats,
  DetailedPosition,
  Position,
  ShotSituation,
  ShotBodyPart,
  ShotOutcome,
  DatasetSnapshot,
} from '@/domain/types';

const SEED = 20260611; // World Cup 2026 opening day
const SQUAD_SIZE = 26;
const HOME_ADV = 0.18; // ELO/finishing edge for the nominal "home" side

// Formation template — detailed positions for a 26-man squad
const SQUAD_TEMPLATE: { pos: Position; detailed: DetailedPosition }[] = [
  { pos: 'GK', detailed: 'GK' }, { pos: 'GK', detailed: 'GK' }, { pos: 'GK', detailed: 'GK' },
  { pos: 'DF', detailed: 'CB' }, { pos: 'DF', detailed: 'CB' }, { pos: 'DF', detailed: 'CB' },
  { pos: 'DF', detailed: 'CB' }, { pos: 'DF', detailed: 'LB' }, { pos: 'DF', detailed: 'RB' },
  { pos: 'DF', detailed: 'LWB' }, { pos: 'DF', detailed: 'RWB' },
  { pos: 'MF', detailed: 'DM' }, { pos: 'MF', detailed: 'DM' }, { pos: 'MF', detailed: 'CM' },
  { pos: 'MF', detailed: 'CM' }, { pos: 'MF', detailed: 'CM' }, { pos: 'MF', detailed: 'AM' },
  { pos: 'MF', detailed: 'AM' },
  { pos: 'FW', detailed: 'LW' }, { pos: 'FW', detailed: 'RW' }, { pos: 'FW', detailed: 'LW' },
  { pos: 'FW', detailed: 'RW' }, { pos: 'FW', detailed: 'CF' }, { pos: 'FW', detailed: 'ST' },
  { pos: 'FW', detailed: 'ST' }, { pos: 'MF', detailed: 'CM' },
];

const STARTING_DETAILED: DetailedPosition[] = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'ST', 'LW'];

function uniqueName(rng: Rng, region: keyof typeof NAME_BANKS, used: Set<string>): string {
  const bank = NAME_BANKS[region];
  for (let i = 0; i < 40; i++) {
    const name = `${rng.pick(bank.first)} ${rng.pick(bank.last)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // Fallback guarantees uniqueness
  const name = `${rng.pick(bank.first)} ${rng.pick(bank.last)}-${used.size}`;
  used.add(name);
  return name;
}

function buildPlayers(rng: Rng, team: SeedTeam, teamId: string): Player[] {
  const region = TEAM_REGION[team.code] ?? 'anglo';
  const used = new Set<string>();
  const baseQuality = (team.attack + team.defense) / 2; // ~64..88
  const players: Player[] = [];

  // Shuffle template positions but keep first 11 as the strongest by giving
  // template entries that match the starting XI a quality boost.
  SQUAD_TEMPLATE.forEach((tpl, i) => {
    const isStarterSlot = i < 11;
    const ageMean = tpl.pos === 'GK' ? 29 : 27;
    const age = Math.round(rng.gaussian(ageMean, 4));
    const heightCm =
      tpl.pos === 'GK' ? rng.int(186, 196) : tpl.pos === 'DF' ? rng.int(180, 192) : rng.int(170, 188);

    // Quality: starters cluster near team base, bench a bit lower.
    const slotBonus = isStarterSlot ? 4 : -3 - i * 0.2;
    const overall = clamp(rng.gaussian(baseQuality + slotBonus, 4), 58, 94);

    const attackBias = tpl.pos === 'FW' ? 14 : tpl.pos === 'MF' ? 4 : -10;
    const defenseBias = tpl.pos === 'DF' ? 14 : tpl.pos === 'MF' ? 2 : -12;

    players.push({
      id: `${teamId}-p${i + 1}`,
      name: uniqueName(rng, region, used),
      teamId,
      shirtNumber: i + 1,
      position: tpl.pos,
      detailedPosition: tpl.detailed,
      age: clamp(age, 18, 39),
      heightCm,
      foot: rng.weighted(['right', 'left', 'both'] as const, [70, 26, 4]),
      club: rng.pick(CLUBS),
      marketValueEur: Math.round(Math.max(1, Math.pow((overall - 50) / 6, 2.4)) * (isStarterSlot ? 1.4 : 0.7)),
      rating: {
        overall: round1(overall),
        pace: round1(clamp(rng.gaussian(overall - (tpl.pos === 'GK' ? 14 : 0), 6), 40, 99)),
        shooting: round1(clamp(rng.gaussian(overall + attackBias, 6), 30, 99)),
        passing: round1(clamp(rng.gaussian(overall + (tpl.pos === 'MF' ? 8 : 0), 5), 40, 99)),
        dribbling: round1(clamp(rng.gaussian(overall + (tpl.pos === 'FW' ? 8 : 0), 6), 40, 99)),
        defending: round1(clamp(rng.gaussian(overall + defenseBias, 6), 25, 99)),
        physical: round1(clamp(rng.gaussian(overall, 6), 45, 99)),
      },
    });
  });

  return players;
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

// ── Shot model ───────────────────────────────────────────────
// xG is sampled from the shot's location and situation, mirroring how a real
// xG model behaves: central, close shots are high value; long/wide shots low.
function sampleShot(rng: Rng, attackStrength: number): { x: number; y: number; xg: number; situation: ShotSituation; bodyPart: ShotBodyPart; big: boolean } {
  const situation = rng.weighted(
    ['open_play', 'fast_break', 'corner', 'free_kick', 'penalty', 'set_piece'] as const,
    [62, 9, 14, 6, 3, 6],
  );

  if (situation === 'penalty') {
    return { x: 88, y: 50, xg: 0.79, situation, bodyPart: rng.weighted(['right_foot', 'left_foot'] as const, [70, 30]), big: true };
  }

  // Distance from goal: better attacks get closer shots on average
  const dist = clamp(rng.gaussian(18 - attackStrength * 6, 6), 4, 38); // metres
  const angleOffset = Math.abs(rng.gaussian(0, 14)); // degrees from central
  const x = clamp(100 - dist * 1.4, 55, 99);
  const y = clamp(50 + (rng.chance(0.5) ? 1 : -1) * angleOffset * 0.9, 8, 92);

  // Logistic-ish xG from distance & angle
  const distFactor = Math.exp(-dist / 9);
  const angleFactor = Math.exp(-angleOffset / 28);
  let xg = clamp(0.92 * distFactor * angleFactor, 0.01, 0.92);
  if (situation === 'fast_break') xg = clamp(xg * 1.35, 0.02, 0.95);
  if (situation === 'corner' || situation === 'set_piece') xg = clamp(xg * 0.8, 0.01, 0.7);

  const bodyPart: ShotBodyPart =
    situation === 'corner' || situation === 'set_piece'
      ? rng.weighted(['head', 'right_foot', 'left_foot'] as const, [55, 25, 20])
      : rng.weighted(['right_foot', 'left_foot', 'head', 'other'] as const, [55, 33, 9, 3]);

  return { x: round1(x), y: round1(y), xg: round2(xg), situation, bodyPart, big: xg >= 0.35 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

interface SimContext {
  rng: Rng;
  teams: Map<string, Team>;
  playersByTeam: Map<string, Player[]>;
  stats: Map<string, PlayerStats>;
  elo: Map<string, number>;
}

/** Simulate one match in full, mutating accumulators. Returns the Match. */
function simulateMatch(
  ctx: SimContext,
  meta: Omit<Match, 'homeScore' | 'awayScore' | 'homeScoreHT' | 'awayScoreHT' | 'penalties' | 'teamStats' | 'events' | 'shots' | 'minute' | 'status'> & { status: Match['status']; minute: number; play: boolean },
): Match {
  const { rng } = ctx;
  const home = ctx.teams.get(meta.homeTeamId)!;
  const away = ctx.teams.get(meta.awayTeamId)!;

  const events: MatchEvent[] = [];
  const shots: Shot[] = [];
  const teamStats: Record<string, MatchTeamStats> = {};

  if (!meta.play) {
    return { ...meta, status: meta.status, minute: meta.minute, homeScore: 0, awayScore: 0, homeScoreHT: 0, awayScoreHT: 0, penalties: null, teamStats, events, shots };
  }

  const sides = [
    { team: home, opp: away, isHome: true },
    { team: away, opp: home, isHome: false },
  ];

  const scoreline: Record<string, number> = { [home.id]: 0, [away.id]: 0 };
  const htScore: Record<string, number> = { [home.id]: 0, [away.id]: 0 };
  const liveMinute = meta.status === 'LIVE' ? meta.minute : 90;

  for (const side of sides) {
    const atkStr = side.team.attackRating / 100;
    const defStr = side.opp.defenseRating / 100;
    const homeEdge = side.isHome ? HOME_ADV : 0;

    // Expected shot volume scales with attack vs opp defense
    const expShots = clamp(11 + (atkStr - defStr) * 16 + homeEdge * 4, 5, 24);
    const nShots = Math.max(2, Math.round(rng.gaussian(expShots, 2.5)));

    const squad = ctx.playersByTeam.get(side.team.id)!;
    const starters = pickStarters(squad);
    const shooters = squad.filter((p) => p.position !== 'GK');

    let onTarget = 0;
    let bigChances = 0;
    let teamXg = 0;

    for (let s = 0; s < nShots; s++) {
      const minute = rng.int(1, liveMinute);
      const shotMeta = sampleShot(rng, atkStr);
      const shooter = weightedShooter(rng, shooters);
      const finishing = (shooter.rating.shooting ?? shooter.rating.overall) / 100;
      // Goal probability is xG nudged by finisher quality
      const goalP = clamp(shotMeta.xg * (0.78 + finishing * 0.5), 0.01, 0.96);
      const scored = rng.chance(goalP) && minute <= liveMinute;
      const target = scored || rng.chance(0.42 + finishing * 0.2);
      if (target) onTarget++;
      if (shotMeta.big) bigChances++;
      teamXg += shotMeta.xg;

      let outcome: ShotOutcome;
      if (shotMeta.situation === 'penalty') outcome = scored ? 'penalty_goal' : 'penalty_missed';
      else if (scored) outcome = 'goal';
      else if (target) outcome = rng.chance(0.7) ? 'saved' : 'post';
      else outcome = rng.chance(0.5) ? 'blocked' : 'off_target';

      const shot: Shot = {
        id: `${meta.id}-s${side.team.id}-${s}`,
        matchId: meta.id,
        minute,
        teamId: side.team.id,
        playerId: shooter.id,
        x: shotMeta.x,
        y: shotMeta.y,
        xG: shotMeta.xg,
        bodyPart: shotMeta.bodyPart,
        situation: shotMeta.situation,
        outcome,
        isBigChance: shotMeta.big,
      };
      shots.push(shot);

      // Accumulate shooter stats
      const ss = ctx.stats.get(shooter.id)!;
      ss.shots++;
      ss.xG = round2(ss.xG + shotMeta.xg);
      if (target) ss.shotsOnTarget++;
      if (shotMeta.big && !scored) ss.bigChancesMissed++;

      if (scored) {
        scoreline[side.team.id] = (scoreline[side.team.id] ?? 0) + 1;
        if (minute <= 45) htScore[side.team.id] = (htScore[side.team.id] ?? 0) + 1;
        ss.goals++;

        // Assist: weighted by passing among other starters
        let assister: Player | null = null;
        if (shotMeta.situation !== 'penalty' && rng.chance(0.74)) {
          const candidates = starters.filter((p) => p.id !== shooter.id && p.position !== 'GK');
          assister = weightedPasser(rng, candidates);
          const as = ctx.stats.get(assister.id)!;
          as.assists++;
          as.xA = round2(as.xA + shotMeta.xg);
          as.keyPasses++;
          as.bigChancesCreated += shotMeta.big ? 1 : 0;
        }

        events.push({
          id: `${meta.id}-e${events.length}`,
          matchId: meta.id,
          minute,
          addedTime: 0,
          type: shotMeta.situation === 'penalty' ? 'PENALTY_GOAL' : 'GOAL',
          teamId: side.team.id,
          playerId: shooter.id,
          relatedPlayerId: assister?.id ?? null,
          detail: assister ? `Goal — assist ${assister.name}` : 'Goal',
          xG: shotMeta.xg,
        });
      }
    }

    // Team-level match stats
    const possessionBase = 50 + (atkStr - side.opp.attackRating / 100) * 40 + homeEdge * 6;
    teamStats[side.team.id] = {
      teamId: side.team.id,
      possession: round1(clamp(rng.gaussian(possessionBase, 4), 28, 72)),
      shots: nShots,
      shotsOnTarget: onTarget,
      xG: round2(teamXg),
      corners: rng.int(2, 9),
      fouls: rng.int(6, 16),
      offsides: rng.int(0, 5),
      passes: Math.round(rng.gaussian(possessionBase * 9, 60)),
      passAccuracy: round1(clamp(rng.gaussian(82 + (atkStr - 0.75) * 20, 4), 64, 93)),
      fieldTilt: round1(clamp(rng.gaussian(possessionBase, 6), 25, 75)),
      ppda: round1(clamp(rng.gaussian(12 - (side.team.defenseRating - 75) / 6, 2.5), 5, 22)),
      bigChances,
      saves: 0, // filled from opponent shots below
      yellowCards: 0,
      redCards: 0,
    };

    // Distribute outfield contribution stats across the XI for the rich model
    accumulateOutfieldStats(ctx, starters, side.team, liveMinute);
  }

  // Saves = opponent shots on target minus goals conceded
  teamStats[home.id]!.saves = Math.max(0, teamStats[away.id]!.shotsOnTarget - (scoreline[away.id] ?? 0));
  teamStats[away.id]!.saves = Math.max(0, teamStats[home.id]!.shotsOnTarget - (scoreline[home.id] ?? 0));
  creditGoalkeeper(ctx, ctx.playersByTeam.get(home.id)!, teamStats[home.id]!.saves, scoreline[away.id] ?? 0, liveMinute);
  creditGoalkeeper(ctx, ctx.playersByTeam.get(away.id)!, teamStats[away.id]!.saves, scoreline[home.id] ?? 0, liveMinute);

  // Cards
  addCards(ctx, meta.id, home, away, events, teamStats, rng, liveMinute);
  // Substitutions (around 60-80')
  if (meta.status === 'FINISHED') addSubs(ctx, meta.id, [home, away], events, rng);

  // Sort events chronologically
  events.sort((a, b) => a.minute - b.minute);

  // ELO update on finished matches
  if (meta.status === 'FINISHED') {
    updateElo(ctx, home.id, away.id, scoreline[home.id]!, scoreline[away.id]!);
  }

  // Penalty shootout for finished knockout draws
  let penalties: Match['penalties'] = null;
  if (meta.status === 'FINISHED' && meta.stage !== 'GROUP' && scoreline[home.id] === scoreline[away.id]) {
    const hp = rng.int(2, 5);
    let ap = rng.int(2, 5);
    if (ap === hp) ap = rng.chance(0.5) ? ap + 1 : Math.max(0, ap - 1);
    penalties = { home: hp, away: ap };
  }

  return {
    ...meta,
    status: meta.status,
    minute: meta.status === 'FINISHED' ? 90 : meta.minute,
    homeScore: scoreline[home.id] ?? 0,
    awayScore: scoreline[away.id] ?? 0,
    homeScoreHT: htScore[home.id] ?? 0,
    awayScoreHT: htScore[away.id] ?? 0,
    penalties,
    teamStats,
    events,
    shots,
  };
}

function pickStarters(squad: Player[]): Player[] {
  const starters: Player[] = [];
  const byDetail = new Map<DetailedPosition, Player[]>();
  for (const p of squad) {
    const arr = byDetail.get(p.detailedPosition) ?? [];
    arr.push(p);
    byDetail.set(p.detailedPosition, arr);
  }
  const used = new Set<string>();
  for (const slot of STARTING_DETAILED) {
    const pool = (byDetail.get(slot) ?? squad).filter((p) => !used.has(p.id));
    const fallback = squad.filter((p) => !used.has(p.id) && p.position !== 'GK');
    const candidate = (pool.length ? pool : fallback).sort((a, b) => b.rating.overall - a.rating.overall)[0];
    if (candidate) {
      starters.push(candidate);
      used.add(candidate.id);
    }
  }
  // Ensure 11
  if (starters.length < 11) {
    for (const p of squad.sort((a, b) => b.rating.overall - a.rating.overall)) {
      if (starters.length >= 11) break;
      if (!used.has(p.id)) {
        starters.push(p);
        used.add(p.id);
      }
    }
  }
  return starters;
}

function weightedShooter(rng: Rng, players: Player[]): Player {
  const weights = players.map((p) => {
    const posW = p.position === 'FW' ? 3 : p.position === 'MF' ? 1.4 : 0.4;
    return Math.pow((p.rating.shooting ?? p.rating.overall) / 60, 2) * posW;
  });
  return rng.weighted(players, weights);
}

function weightedPasser(rng: Rng, players: Player[]): Player {
  if (!players.length) return players[0]!;
  const weights = players.map((p) => {
    const posW = p.position === 'MF' ? 2.4 : p.position === 'FW' ? 1.8 : 0.7;
    return Math.pow((p.rating.passing ?? p.rating.overall) / 60, 2) * posW;
  });
  return rng.weighted(players, weights);
}

function accumulateOutfieldStats(ctx: SimContext, starters: Player[], team: Team, minutes: number): void {
  const { rng } = ctx;
  for (const p of starters) {
    const st = ctx.stats.get(p.id)!;
    if (st.appearances === 0 || st.minutes < minutes * st.appearances) {
      // increment appearance & minutes once per match
    }
    st.appearances += 1;
    st.minutes += minutes;
    const passVol = p.position === 'MF' ? 70 : p.position === 'DF' ? 62 : 38;
    const passes = Math.max(8, Math.round(rng.gaussian(passVol * (minutes / 90), 12)));
    const acc = clamp((p.rating.passing ?? p.rating.overall) / 100, 0.6, 0.95);
    st.passes += passes;
    st.passesCompleted += Math.round(passes * acc);
    st.progressivePasses += Math.round(rng.gaussian(p.position === 'MF' ? 7 : p.position === 'DF' ? 5 : 4, 2) * (minutes / 90));
    st.progressiveCarries += Math.round(rng.gaussian(p.position === 'FW' ? 6 : p.position === 'MF' ? 5 : 2, 2) * (minutes / 90));
    st.touches += Math.round(passes * 1.5);
    st.touchesInBox += Math.round(rng.gaussian(p.position === 'FW' ? 6 : 1.5, 2) * (minutes / 90));
    st.tackles += Math.max(0, Math.round(rng.gaussian(p.position === 'DF' ? 3 : p.position === 'MF' ? 2.4 : 0.8, 1.4)));
    st.interceptions += Math.max(0, Math.round(rng.gaussian(p.position === 'DF' ? 2.4 : 1.2, 1.2)));
    st.ballRecoveries += Math.max(0, Math.round(rng.gaussian(p.position === 'MF' ? 6 : 4, 2)));
    const duels = Math.max(1, Math.round(rng.gaussian(8, 3)));
    st.duelsTotal += duels;
    st.duelsWon += Math.round(duels * clamp((p.rating.physical ?? p.rating.overall) / 100, 0.4, 0.75));
    st.pressuresApplied += Math.max(0, Math.round(rng.gaussian(14, 5) * (minutes / 90)));
    st.pressRegains += Math.max(0, Math.round(rng.gaussian(3, 1.5)));
    st.foulsCommitted += rng.chance(0.5) ? rng.int(0, 2) : 0;
    st.foulsWon += rng.chance(0.5) ? rng.int(0, 2) : 0;
  }
}

function creditGoalkeeper(ctx: SimContext, squad: Player[], saves: number, conceded: number, minutes: number): void {
  const gk = squad.find((p) => p.position === 'GK')!;
  const st = ctx.stats.get(gk.id)!;
  st.appearances += 1;
  st.minutes += minutes;
  st.saves += saves;
  st.goalsConceded += conceded;
  if (conceded === 0 && minutes >= 90) st.cleanSheets += 1;
  st.passes += Math.round(ctx.rng.gaussian(28, 6));
  st.passesCompleted += Math.round(st.passes * 0.7);
}

function addCards(
  ctx: SimContext,
  matchId: string,
  home: Team,
  away: Team,
  events: MatchEvent[],
  teamStats: Record<string, MatchTeamStats>,
  rng: Rng,
  liveMinute: number,
): void {
  for (const team of [home, away]) {
    const nYellow = rng.weighted([0, 1, 2, 3, 4], [10, 28, 32, 22, 8]);
    const squad = ctx.playersByTeam.get(team.id)!;
    for (let i = 0; i < nYellow; i++) {
      const p = rng.pick(squad.filter((x) => x.position !== 'GK'));
      const minute = rng.int(10, liveMinute);
      events.push({
        id: `${matchId}-y${team.id}-${i}`,
        matchId,
        minute,
        addedTime: 0,
        type: 'YELLOW_CARD',
        teamId: team.id,
        playerId: p.id,
        relatedPlayerId: null,
        detail: 'Yellow card',
      });
      ctx.stats.get(p.id)!.yellowCards++;
      teamStats[team.id]!.yellowCards++;
    }
    if (rng.chance(0.06)) {
      const p = rng.pick(squad.filter((x) => x.position !== 'GK'));
      events.push({
        id: `${matchId}-r${team.id}`,
        matchId,
        minute: rng.int(40, liveMinute),
        addedTime: 0,
        type: 'RED_CARD',
        teamId: team.id,
        playerId: p.id,
        relatedPlayerId: null,
        detail: 'Red card',
      });
      ctx.stats.get(p.id)!.redCards++;
      teamStats[team.id]!.redCards++;
    }
  }
}

function addSubs(ctx: SimContext, matchId: string, teams: Team[], events: MatchEvent[], rng: Rng): void {
  for (const team of teams) {
    const squad = ctx.playersByTeam.get(team.id)!;
    const nSubs = rng.int(3, 5);
    const bench = rng.shuffle(squad.filter((p) => p.position !== 'GK')).slice(0, nSubs);
    bench.forEach((p, i) => {
      const minute = rng.int(58, 88);
      const st = ctx.stats.get(p.id)!;
      // Bench appearance with partial minutes (only if they didn't start)
      if (st.appearances === 0) {
        st.appearances += 1;
        st.minutes += 90 - minute;
      }
      events.push({
        id: `${matchId}-sub${team.id}-${i}`,
        matchId,
        minute,
        addedTime: 0,
        type: 'SUBSTITUTION',
        teamId: team.id,
        playerId: p.id,
        relatedPlayerId: null,
        detail: 'Substitution on',
      });
    });
  }
}

// ELO with margin-of-victory multiplier (World Football Elo style)
function updateElo(ctx: SimContext, homeId: string, awayId: string, hs: number, as_: number): void {
  const K = 40;
  const Rh = ctx.elo.get(homeId)!;
  const Ra = ctx.elo.get(awayId)!;
  const dr = Rh + 100 - Ra; // home advantage in ELO points
  const We = 1 / (Math.pow(10, -dr / 400) + 1);
  const Wh = hs > as_ ? 1 : hs === as_ ? 0.5 : 0;
  const gd = Math.abs(hs - as_);
  const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
  const delta = K * G * (Wh - We);
  ctx.elo.set(homeId, Math.round(Rh + delta));
  ctx.elo.set(awayId, Math.round(Ra - delta));
}

// Single round-robin within a group of 4 → 6 matches over 3 matchdays
const GROUP_PAIRS: [number, number][][] = [
  [[0, 1], [2, 3]], // MD1
  [[0, 2], [3, 1]], // MD2
  [[3, 0], [1, 2]], // MD3
];

/** Build the full dataset. */
export function generateDataset(): DatasetSnapshot {
  const rng = new Rng(SEED);

  const competition: Competition = {
    id: 'wc-2026',
    name: 'FIFA World Cup 2026',
    season: '2026',
    hostCountries: ['United States', 'Canada', 'Mexico'],
    startDate: '2026-06-11',
    endDate: '2026-07-19',
    numTeams: 48,
    numGroups: 12,
    currentMatchday: 3,
    logoEmoji: '🏆',
  };

  const teams: Team[] = [];
  const teamMap = new Map<string, Team>();
  const playersByTeam = new Map<string, Player[]>();
  const allPlayers: Player[] = [];
  const stats = new Map<string, PlayerStats>();
  const elo = new Map<string, number>();

  // Build teams & squads
  for (const s of SEED_TEAMS) {
    const id = s.code.toLowerCase();
    const team: Team = {
      id,
      name: s.name,
      code: s.code,
      flag: s.flag,
      confederation: s.conf,
      groupId: s.group,
      fifaRanking: s.fifa,
      elo: s.elo,
      preTournamentTitleOdds: s.odds,
      manager: s.manager,
      attackRating: s.attack,
      defenseRating: s.defense,
      primaryColor: s.color,
      squadIds: [],
    };
    const squadRng = new Rng(hashSeed(`squad-${id}`));
    const players = buildPlayers(squadRng, s, id);
    team.squadIds = players.map((p) => p.id);
    teams.push(team);
    teamMap.set(id, team);
    playersByTeam.set(id, players);
    allPlayers.push(...players);
    players.forEach((p) => stats.set(p.id, emptyStats(p.id)));
    elo.set(id, s.elo);
  }

  // Build groups
  const groups: Group[] = [];
  const groupLetters = [...new Set(SEED_TEAMS.map((t) => t.group))].sort();
  for (const letter of groupLetters) {
    const teamIds = SEED_TEAMS.filter((t) => t.group === letter).map((t) => t.code.toLowerCase());
    groups.push({ id: letter, competitionId: competition.id, name: `Group ${letter}`, teamIds });
  }

  const ctx: SimContext = { rng, teams: teamMap, playersByTeam, stats, elo };

  // Generate & simulate the group stage.
  // Tournament state: MD1 & MD2 finished; MD3 has a mix of LIVE and SCHEDULED.
  const matches: Match[] = [];
  let venueIdx = 0;
  for (const group of groups) {
    const ids = group.teamIds;
    GROUP_PAIRS.forEach((md, mdIdx) => {
      const matchday = mdIdx + 1;
      md.forEach(([a, b], gameIdx) => {
        const venue = VENUES[venueIdx % VENUES.length]!;
        venueIdx++;
        const dayOffset = mdIdx * 3 + gameIdx;
        const kickoff = new Date(Date.UTC(2026, 5, 11 + dayOffset, 16 + (gameIdx % 3) * 3, 0)).toISOString();
        const id = `m-${group.id}-${matchday}-${gameIdx}`;

        // State machine for tournament progress
        let status: Match['status'] = 'FINISHED';
        let minute = 90;
        let play = true;
        if (matchday === 3) {
          // Final group round: stagger live/scheduled
          const roll = (venueIdx + group.id.charCodeAt(0)) % 4;
          if (roll === 0) {
            status = 'LIVE';
            minute = rng.int(23, 78);
          } else if (roll === 1) {
            status = 'SCHEDULED';
            minute = 0;
            play = false;
          } else {
            status = 'FINISHED';
          }
        }

        const match = simulateMatch(ctx, {
          id,
          competitionId: competition.id,
          stage: 'GROUP',
          groupId: group.id,
          matchday,
          kickoff,
          venue: venue.stadium,
          city: venue.city,
          homeTeamId: ids[a]!,
          awayTeamId: ids[b]!,
          bracketSlot: null,
          status,
          minute,
          play,
        });
        matches.push(match);
      });
    });
  }

  // Sync live ELO back onto team records
  for (const team of teams) {
    team.elo = elo.get(team.id)!;
  }

  // Compute rolling form index from each player's recent xG+goals contribution
  computeFormIndex(stats, matches, playersByTeam);

  const playerStats: Record<string, PlayerStats> = {};
  stats.forEach((v, k) => (playerStats[k] = v));

  return {
    competition,
    groups,
    teams,
    players: allPlayers,
    playerStats,
    matches,
    generatedAt: new Date(Date.UTC(2026, 5, 13, 12, 0)).toISOString(),
    meta: { source: 'simulation', hasAdvancedMetrics: true, hasShotData: true },
  };
}

function computeFormIndex(
  stats: Map<string, PlayerStats>,
  matches: Match[],
  playersByTeam: Map<string, Player[]>,
): void {
  // Form = blend of goals/xG involvement and minutes, normalised per position
  stats.forEach((st) => {
    const involvement = st.goals * 3 + st.assists * 2 + st.xG + st.xA;
    const per90 = st.minutes > 0 ? (involvement / st.minutes) * 90 : 0;
    st.formIndex = round1(clamp(45 + per90 * 22 + (st.minutes > 90 ? 6 : 0), 20, 99));
  });
  void matches;
  void playersByTeam;
}
