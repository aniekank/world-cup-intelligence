#!/usr/bin/env node
/**
 * Precompute a DatasetSnapshot from StatsBomb open data (free, real, full
 * shot-level). Fetches every match's event stream for a World Cup, aggregates
 * into the platform's exact shapes (real shots with xG + coordinates, player
 * stats, team match stats) and writes a compact JSON the app loads instantly.
 *
 * Usage:  node scripts/fetch-statsbomb.mjs [competitionId] [seasonId] [maxMatches]
 * Default: 43 106  → FIFA World Cup 2022.  Output: src/data/cache/statsbomb.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metaFor, GROUP_OF, STAGE_MAP } from './statsbomb-meta.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
const [, , compArg = '43', seasonArg = '106', maxArg] = process.argv;
const COMP = Number(compArg);
const SEASON = Number(seasonArg);
const MAX = maxArg ? Number(maxArg) : Infinity;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`fetch failed: ${url}`);
}

function mapOutcome(name, isPen) {
  if (name === 'Goal') return isPen ? 'penalty_goal' : 'goal';
  if (name === 'Saved' || name === 'Saved to Post' || name === 'Saved Off Target') return 'saved';
  if (name === 'Post') return 'post';
  if (name === 'Blocked') return 'blocked';
  return 'off_target';
}
function mapBody(name) {
  if (name === 'Head') return 'head';
  if (name === 'Left Foot') return 'left_foot';
  if (name === 'Right Foot') return 'right_foot';
  return 'other';
}
function mapSituation(t) {
  if (t === 'Penalty') return 'penalty';
  if (t === 'Free Kick') return 'free_kick';
  if (t === 'Corner') return 'corner';
  return 'open_play';
}
function mapPos(name = '') {
  if (/goalkeeper/i.test(name)) return ['GK', 'GK'];
  if (/back|defen/i.test(name)) return ['DF', /center|centre/i.test(name) ? 'CB' : 'LB'];
  if (/midfield|wing back/i.test(name)) return ['MF', 'CM'];
  if (/wing|forward|striker|center forward/i.test(name)) return ['FW', /wing/i.test(name) ? 'LW' : 'ST'];
  return ['MF', 'CM'];
}

function emptyStats(id) {
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

async function main() {
  console.log(`Fetching StatsBomb competition ${COMP} season ${SEASON}…`);
  const rawMatches = await getJSON(`${BASE}/matches/${COMP}/${SEASON}.json`);
  rawMatches.sort((a, b) => a.match_date.localeCompare(b.match_date));
  const matchList = rawMatches.slice(0, MAX);
  console.log(`${matchList.length} matches.`);

  const teams = new Map(); // id -> team
  const players = new Map(); // id -> player
  const stats = new Map(); // id -> stats
  const matches = [];
  const groupStagePairs = []; // [homeId, awayId, date] — used to infer groups

  const ensureTeam = (sbTeam) => {
    const name = typeof sbTeam === 'string' ? sbTeam : (sbTeam.name ?? sbTeam.home_team_name ?? sbTeam.away_team_name ?? '');
    const m = metaFor(name);
    const id = m.code.toLowerCase();
    if (!teams.has(id)) {
      teams.set(id, {
        id, name, code: m.code, flag: m.flag,
        confederation: m.conf, groupId: null, // inferred after all matches are read
        fifaRanking: 0, elo: m.elo, preTournamentTitleOdds: 0, manager: '—',
        attackRating: m.atk, defenseRating: m.def, primaryColor: m.color, squadIds: [],
      });
    }
    return teams.get(id);
  };

  for (let i = 0; i < matchList.length; i++) {
    const mt = matchList[i];
    const home = ensureTeam(mt.home_team);
    const away = ensureTeam(mt.away_team);
    // Manager / head coach is in the StatsBomb match data
    const setMgr = (team, side) => {
      const mg = side?.managers?.[0];
      if (mg && (team.manager === '—' || !team.manager)) team.manager = mg.name || mg.nickname || '—';
    };
    setMgr(home, mt.home_team);
    setMgr(away, mt.away_team);
    process.stdout.write(`\r  [${i + 1}/${matchList.length}] ${home.code} v ${away.code}        `);
    let events;
    try {
      events = await getJSON(`${BASE}/events/${mt.match_id}.json`);
    } catch {
      continue;
    }
    const teamId = (t) => ensureTeam(t).id;

    // pass id -> { playerId, teamId } for assist/xA linkage
    const passById = new Map();
    for (const e of events) {
      if (e.type?.name === 'Pass' && e.player) passById.set(e.id, { pid: `${teamId(e.team)}-${e.player.id}`, tid: teamId(e.team) });
    }

    const matchEnd = events.reduce((mx, e) => Math.max(mx, e.minute ?? 0), 90);
    const onPitch = new Map(); // pid -> { start, end }
    const ensurePlayer = (sbPlayer, sbTeam, positionName) => {
      const tid = teamId(sbTeam);
      const pid = `${tid}-${sbPlayer.id}`;
      if (!players.has(pid)) {
        const [pos, det] = mapPos(positionName);
        players.set(pid, {
          id: pid, name: sbPlayer.name, teamId: tid, shirtNumber: 0,
          position: pos, detailedPosition: det, age: 0, heightCm: 182, foot: 'right',
          club: '—', marketValueEur: 0,
          rating: { overall: 78, pace: 78, shooting: 78, passing: 78, dribbling: 78, defending: 78, physical: 78 },
        });
        stats.set(pid, emptyStats(pid));
      }
      return pid;
    };

    const teamStats = {
      [home.id]: blankTeamStats(home.id),
      [away.id]: blankTeamStats(away.id),
    };
    const shots = [];
    const keyEvents = [];
    const goalsByTeam = { [home.id]: 0, [away.id]: 0 };
    const htByTeam = { [home.id]: 0, [away.id]: 0 };
    const shootout = { [home.id]: 0, [away.id]: 0 };
    let hasShootout = false;
    const apps = new Set();

    for (const e of events) {
      const tname = e.type?.name;
      const tid = e.team ? teamId(e.team) : null;

      // Penalty shootout (period 5) is NOT part of regulation stats — capture
      // it as the actual penalties result, exclude from goals/shots/xG.
      if (e.period === 5) {
        if (tname === 'Shot' && e.shot?.outcome?.name === 'Goal' && tid) {
          shootout[tid]++;
          hasShootout = true;
        }
        continue;
      }
      const ts = tid ? teamStats[tid] : null;

      if (tname === 'Starting XI' && e.tactics?.lineup) {
        for (const l of e.tactics.lineup) {
          const pid = ensurePlayer(l.player, e.team, l.position?.name);
          players.get(pid).shirtNumber = l.jersey_number ?? 0;
          onPitch.set(pid, { start: 0, end: matchEnd });
          if (!apps.has(pid)) { stats.get(pid).appearances++; apps.add(pid); }
        }
        continue;
      }
      if (!e.player) continue;
      const pid = ensurePlayer(e.player, e.team, e.position?.name);
      const st = stats.get(pid);

      if (tname === 'Pass' && e.pass) {
        st.passes++; if (ts) ts.passes++;
        const complete = !e.pass.outcome;
        if (complete) { st.passesCompleted++; if (ts) ts.passesCompleted++; }
        const dx = (e.pass.end_location?.[0] ?? 0) - (e.location?.[0] ?? 0);
        if (complete && dx >= 15 && (e.location?.[0] ?? 0) < 102) st.progressivePasses++;
        if (e.pass.shot_assist || e.pass.goal_assist) st.keyPasses++;
        if (e.pass.type?.name === 'Corner' && ts) ts.corners++;
        st.touches++;
      } else if (tname === 'Carry' && e.carry) {
        const dx = (e.carry.end_location?.[0] ?? 0) - (e.location?.[0] ?? 0);
        if (dx >= 10) st.progressiveCarries++;
        st.touches++;
      } else if (tname === 'Pressure') {
        st.pressuresApplied++;
      } else if (tname === 'Ball Recovery') {
        st.ballRecoveries++;
      } else if (tname === 'Interception') {
        st.interceptions++;
      } else if (tname === 'Duel' && e.duel?.type?.name === 'Tackle') {
        st.tackles++; st.duelsTotal++;
        if (/won|success/i.test(e.duel?.outcome?.name ?? '')) st.duelsWon++;
      } else if (tname === 'Goal Keeper' && /saved|shot saved/i.test(e.goalkeeper?.type?.name ?? '')) {
        st.saves++; if (ts) ts.saves++;
      } else if (tname === 'Foul Committed') {
        st.foulsCommitted++; if (ts) ts.fouls++;
        const card = e.foul_committed?.card?.name;
        if (card === 'Yellow Card') { st.yellowCards++; if (ts) ts.yellowCards++; pushCard(keyEvents, mt, e, tid, pid, 'YELLOW_CARD'); }
        if (/red/i.test(card ?? '')) { st.redCards++; if (ts) ts.redCards++; pushCard(keyEvents, mt, e, tid, pid, 'RED_CARD'); }
      } else if (tname === 'Bad Behaviour' && e.bad_behaviour?.card) {
        const card = e.bad_behaviour.card.name;
        if (card === 'Yellow Card') { st.yellowCards++; if (ts) ts.yellowCards++; }
        if (/red/i.test(card)) { st.redCards++; if (ts) ts.redCards++; }
      } else if (tname === 'Substitution' && e.substitution) {
        const op = onPitch.get(pid);
        if (op) op.end = e.minute;
        const rep = e.substitution.replacement;
        if (rep) {
          const rpid = ensurePlayer(rep, e.team, e.position?.name);
          onPitch.set(rpid, { start: e.minute, end: matchEnd });
          if (!apps.has(rpid)) { stats.get(rpid).appearances++; apps.add(rpid); }
          pushEvent(keyEvents, mt, e.minute, 'SUBSTITUTION', tid, rpid, pid, 'Substitution');
        }
      } else if (tname === 'Shot' && e.shot) {
        const isPen = e.shot.type?.name === 'Penalty';
        const xg = e.shot.statsbomb_xg ?? 0;
        const isGoal = e.shot.outcome?.name === 'Goal';
        const onTarget = ['Goal', 'Saved', 'Saved to Post'].includes(e.shot.outcome?.name);
        const loc = e.location ?? [100, 40];
        const big = xg >= 0.35;
        st.shots++; st.xG = r2(st.xG + xg);
        if (onTarget) st.shotsOnTarget++;
        if ((loc[0] ?? 0) >= 102) st.touchesInBox++;
        if (big && !isGoal) st.bigChancesMissed++;
        if (ts) { ts.shots++; ts.xG = r2(ts.xG + xg); if (onTarget) ts.shotsOnTarget++; if (big) ts.bigChances++; }
        shots.push({
          id: `${mt.match_id}-${e.id}`, matchId: `m-${mt.match_id}`, minute: e.minute ?? 0,
          teamId: tid, playerId: pid, x: r1(clamp((loc[0] / 120) * 100, 50, 99)),
          y: r1(clamp((loc[1] / 80) * 100, 2, 98)), xG: r2(xg), bodyPart: mapBody(e.shot.body_part?.name),
          situation: mapSituation(e.shot.type?.name), outcome: mapOutcome(e.shot.outcome?.name, isPen), isBigChance: big,
        });
        if (isGoal) {
          st.goals++; goalsByTeam[tid]++; if ((e.minute ?? 0) <= 45) htByTeam[tid]++;
          // assist via key pass
          let assistPid = null;
          if (e.shot.key_pass_id && passById.has(e.shot.key_pass_id)) {
            const kp = passById.get(e.shot.key_pass_id);
            assistPid = kp.pid;
            const ast = stats.get(assistPid);
            if (ast) { ast.assists++; ast.xA = r2(ast.xA + xg); if (big) ast.bigChancesCreated++; }
          }
          pushEvent(keyEvents, mt, e.minute, isPen ? 'PENALTY_GOAL' : 'GOAL', tid, pid, assistPid, 'Goal', xg);
        } else if (e.shot.key_pass_id && passById.has(e.shot.key_pass_id)) {
          const ast = stats.get(passById.get(e.shot.key_pass_id).pid);
          if (ast) ast.xA = r2(ast.xA + xg);
        }
        st.touches++;
      }
    }

    // minutes
    for (const [pid, span] of onPitch) {
      const st = stats.get(pid);
      if (st) st.minutes += Math.max(0, (span.end ?? matchEnd) - (span.start ?? 0));
    }

    // possession + field tilt from passes (approx)
    const totalPass = teamStats[home.id].passes + teamStats[away.id].passes || 1;
    for (const id of [home.id, away.id]) {
      const ts = teamStats[id];
      ts.possession = r1(clamp((ts.passes / totalPass) * 100, 20, 80));
      ts.fieldTilt = ts.possession;
      ts.passAccuracy = ts.passes ? r1((ts.passesCompleted / ts.passes) * 100) : 0;
      ts.ppda = r1(clamp(18 - (ts.possession - 50) / 5, 5, 22));
      ts.offsides = 0;
      ts.xG = r2(ts.xG);
    }
    // saves = opp on-target - goals conceded
    teamStats[home.id].saves = Math.max(0, teamStats[away.id].shotsOnTarget - goalsByTeam[away.id]);
    teamStats[away.id].saves = Math.max(0, teamStats[home.id].shotsOnTarget - goalsByTeam[home.id]);

    keyEvents.sort((a, b) => a.minute - b.minute);
    const stage = STAGE_MAP[mt.competition_stage?.name] ?? 'GROUP';
    if (stage === 'GROUP') groupStagePairs.push([home.id, away.id, mt.match_date]);
    matches.push({
      id: `m-${mt.match_id}`, competitionId: 'wc', stage,
      groupId: null, // assigned after group inference
      matchday: 1, kickoff: `${mt.match_date}T${(mt.kick_off ?? '18:00:00').slice(0, 8)}Z`,
      venue: mt.stadium?.name ?? 'Stadium', city: '', status: 'FINISHED', minute: 90,
      homeTeamId: home.id, awayTeamId: away.id, homeScore: mt.home_score, awayScore: mt.away_score,
      homeScoreHT: htByTeam[home.id], awayScoreHT: htByTeam[away.id],
      penalties: hasShootout ? { home: shootout[home.id], away: shootout[away.id] } : null,
      teamStats, events: keyEvents, shots, bracketSlot: null,
    });
  }
  process.stdout.write('\n');

  // ── Infer groups from group-stage pairings (StatsBomb doesn't label them) ──
  // Teams that all played each other in the group stage form a group; cluster by
  // shared opponent set and assign letters by earliest kickoff.
  {
    const opp = new Map(); // teamId -> Set(opponentIds)
    const firstDate = new Map(); // teamId -> earliest group-stage date
    for (const [a, b, date] of groupStagePairs) {
      (opp.get(a) ?? opp.set(a, new Set()).get(a)).add(b);
      (opp.get(b) ?? opp.set(b, new Set()).get(b)).add(a);
      if (!firstDate.has(a) || date < firstDate.get(a)) firstDate.set(a, date);
      if (!firstDate.has(b) || date < firstDate.get(b)) firstDate.set(b, date);
    }
    // cluster key = sorted member set (team + its opponents)
    const clusters = new Map(); // key -> { members:Set, date }
    for (const [team, opps] of opp) {
      const members = [team, ...opps].sort();
      const key = members.join('|');
      if (!clusters.has(key)) clusters.set(key, { members: new Set(members), date: firstDate.get(team) ?? '9999' });
      else clusters.get(key).date = Math.min(clusters.get(key).date, firstDate.get(team) ?? '9999');
    }
    const ordered = [...clusters.values()].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    ordered.forEach((cl, i) => {
      const letter = String.fromCharCode(65 + i);
      for (const tid of cl.members) { const t = teams.get(tid); if (t && !t.groupId) t.groupId = letter; }
    });
    // backfill match.groupId for group-stage matches
    for (const m of matches) if (m.stage === 'GROUP') m.groupId = teams.get(m.homeTeamId)?.groupId ?? null;
  }

  // squads + form index
  for (const t of teams.values()) t.squadIds = [...players.values()].filter((p) => p.teamId === t.id).map((p) => p.id);
  for (const st of stats.values()) {
    const inv = st.goals * 3 + st.assists * 2 + st.xG + st.xA;
    const per90 = st.minutes ? (inv / st.minutes) * 90 : 0;
    st.formIndex = r1(clamp(45 + per90 * 22 + (st.minutes > 90 ? 6 : 0), 20, 99));
  }

  const groupLetters = [...new Set([...teams.values()].map((t) => t.groupId).filter(Boolean))].sort();
  const groups = groupLetters.map((letter) => ({
    id: letter, competitionId: 'wc', name: `Group ${letter}`,
    teamIds: [...teams.values()].filter((t) => t.groupId === letter).map((t) => t.id),
  }));

  const playerStats = {};
  for (const [k, v] of stats) playerStats[k] = v;

  // Champion = winner of the Final (penalties resolved from our mapped match)
  let champion = null;
  const finalRaw = matchList.find((m) => m.competition_stage?.name === 'Final');
  if (finalRaw) {
    const hn = finalRaw.home_team.home_team_name, an = finalRaw.away_team.away_team_name;
    if (finalRaw.home_score > finalRaw.away_score) champion = hn;
    else if (finalRaw.away_score > finalRaw.home_score) champion = an;
    else {
      const fm = matches.find((x) => x.id === `m-${finalRaw.match_id}`);
      if (fm?.penalties) champion = fm.penalties.home > fm.penalties.away ? hn : an;
    }
  }
  const champTeam = champion ? [...teams.values()].find((t) => t.name === champion) : null;
  const totalGoals = [...stats.values()].reduce((s, p) => s + p.goals, 0);
  const topScorer = [...stats.values()].sort((a, b) => b.goals - a.goals)[0];
  const topScorerName = topScorer ? players.get(topScorer.playerId)?.name : null;
  const gender = COMP === 72 ? 'women' : 'men';
  const year = seasonName(SEASON);
  const coverage = matches.length >= 16 ? 'full' : 'classics';

  const snapshot = {
    competition: {
      id: `sb-${COMP}-${SEASON}`,
      name: `${gender === 'women' ? "FIFA Women's World Cup" : 'FIFA World Cup'} ${year}`,
      season: year, hostCountries: hostFor(SEASON),
      startDate: matchList[0]?.match_date ?? `${year}-01-01`,
      endDate: matchList[matchList.length - 1]?.match_date ?? `${year}-12-31`,
      numTeams: teams.size, numGroups: groups.length, currentMatchday: 3, logoEmoji: '🏆',
    },
    groups, teams: [...teams.values()], players: [...players.values()], playerStats, matches,
    generatedAt: new Date().toISOString(),
    meta: {
      source: 'statsbomb-open-data', hasAdvancedMetrics: true, hasShotData: true,
      gender, year: Number(year), coverage,
      champion: champTeam ? { code: champTeam.code, name: champTeam.name, flag: champTeam.flag } : null,
      topScorer: topScorerName ? { name: topScorerName, goals: topScorer.goals } : null,
      totalGoals, totalMatches: matches.length,
    },
  };

  const out = `${ROOT}/src/data/cache/statsbomb-${COMP}-${SEASON}.json`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot));
  const totalShots = matches.reduce((s, m) => s + m.shots.length, 0);
  console.log(`✓ ${teams.size} teams · ${players.size} players · ${matches.length} matches · ${totalShots} shots · ${totalGoals} goals · champion ${champion ?? '—'}`);
  console.log(`✓ wrote ${out} (${(JSON.stringify(snapshot).length / 1e6).toFixed(1)} MB)`);
}

function blankTeamStats(teamId) {
  return { teamId, possession: 50, shots: 0, shotsOnTarget: 0, xG: 0, corners: 0, fouls: 0, offsides: 0, passes: 0, passesCompleted: 0, passAccuracy: 0, fieldTilt: 50, ppda: 12, bigChances: 0, saves: 0, yellowCards: 0, redCards: 0 };
}
function pushEvent(arr, mt, minute, type, teamId, playerId, relatedPlayerId, detail, xG) {
  arr.push({ id: `${mt.match_id}-e${arr.length}`, matchId: `m-${mt.match_id}`, minute: minute ?? 0, addedTime: 0, type, teamId, playerId, relatedPlayerId: relatedPlayerId ?? null, detail, ...(xG != null ? { xG: Math.round(xG * 100) / 100 } : {}) });
}
function pushCard(arr, mt, e, teamId, playerId, type) {
  pushEvent(arr, mt, e.minute, type, teamId, playerId, null, type === 'RED_CARD' ? 'Red card' : 'Yellow card');
}
function seasonName(sid) {
  return { 106: '2022', 3: '2018', 55: '1990', 54: '1986', 51: '1974', 272: '1970', 270: '1962', 269: '1958', 107: '2023', 30: '2019' }[sid] ?? String(sid);
}
function hostFor(sid) {
  return {
    106: ['Qatar'], 3: ['Russia'], 55: ['Italy'], 54: ['Mexico'], 51: ['West Germany'],
    272: ['Mexico'], 270: ['Chile'], 269: ['Sweden'], 107: ['Australia', 'New Zealand'], 30: ['France'],
  }[sid] ?? ['—'];
}

main().catch((e) => { console.error(e); process.exit(1); });
