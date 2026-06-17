/**
 * Historical World Cup importer — the Fjelstul World Cup Database via datahub.io.
 *
 * Builds one bundled DatasetSnapshot per tournament (1930–2022 men, 1991–2019
 * women) into src/data/cache/datahub-<id>.json, plus an editions index the
 * registry reads. This is BREADTH, not depth: results, goals, cards, squads,
 * appearances, managers — no xG/advanced metrics (they don't exist pre-tracking).
 * meta.hasAdvancedMetrics = false, so the app's WC-016 degradation hides the
 * advanced surfaces automatically.
 *
 * Run: node scripts/fetch-datahub.mjs   (excludes editions already on StatsBomb)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, 'src/data/cache');
const BASE = 'https://datahub.io/football/worldcup/r';

// Editions already covered with full StatsBomb event data — skip (keep the deep ones).
const skipEdition = (gender, year) =>
  (gender === 'men' && (year === 2018 || year === 2022)) || (gender === 'women' && (year === 2019 || year === 2023));

// ISO-3 code → flag (the Fjelstul DB uses ISO-3, e.g. DEU/SUN/NLD/URY); default white.
const FLAG = {
  ARG: '🇦🇷', BRA: '🇧🇷', DEU: '🇩🇪', ITA: '🇮🇹', FRA: '🇫🇷', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ESP: '🇪🇸', NLD: '🇳🇱', URY: '🇺🇾', PRT: '🇵🇹',
  BEL: '🇧🇪', HRV: '🇭🇷', MEX: '🇲🇽', USA: '🇺🇸', SWE: '🇸🇪', CHE: '🇨🇭', POL: '🇵🇱', CZE: '🇨🇿', CSK: '🇨🇿', HUN: '🇭🇺',
  AUT: '🇦🇹', RUS: '🇷🇺', SUN: '🇷🇺', SRB: '🇷🇸', YUG: '🇷🇸', COL: '🇨🇴', CHL: '🇨🇱', PER: '🇵🇪', PRY: '🇵🇾', JPN: '🇯🇵',
  KOR: '🇰🇷', PRK: '🇰🇵', AUS: '🇦🇺', GHA: '🇬🇭', NGA: '🇳🇬', CMR: '🇨🇲', SEN: '🇸🇳', MAR: '🇲🇦', TUN: '🇹🇳', DZA: '🇩🇿',
  EGY: '🇪🇬', ZAF: '🇿🇦', CRI: '🇨🇷', ECU: '🇪🇨', IRN: '🇮🇷', SAU: '🇸🇦', QAT: '🇶🇦', TUR: '🇹🇷', DNK: '🇩🇰', NOR: '🇳🇴',
  SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', IRL: '🇮🇪', GRC: '🇬🇷', UKR: '🇺🇦', CHN: '🇨🇳', NZL: '🇳🇿', CAN: '🇨🇦', JAM: '🇯🇲', ROU: '🇷🇴', BGR: '🇧🇬',
  SVK: '🇸🇰', SVN: '🇸🇮', ISL: '🇮🇸', PAN: '🇵🇦', HND: '🇭🇳', BOL: '🇧🇴', ISR: '🇮🇱', AGO: '🇦🇴', CIV: '🇨🇮', TOG: '🇹🇬',
  TTO: '🇹🇹', SLV: '🇸🇻', HTI: '🇭🇹', KWT: '🇰🇼', IRQ: '🇮🇶', ARE: '🇦🇪', ZAI: '🇨🇩', COD: '🇨🇩', NIR: '🇬🇧', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
};
const flagFor = (code) => FLAG[code] || '🏳️';
const realName = (g, f) => `${g && g.toLowerCase() !== 'not applicable' ? g : ''} ${f || ''}`.trim() || f || 'Unknown';

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function fetchCSV(name) {
  const res = await fetch(`${BASE}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}.csv → ${res.status}`);
  return parseCSV(await res.text());
}

const truthy = (v) => v === '1' || v === 'true' || v === 'TRUE';
const tcode = (c) => (c || '').toUpperCase();
const tid = (c) => (c || '').toLowerCase();

function mapStage(name = '') {
  const s = name.toLowerCase();
  if (s.includes('final') && !s.includes('semi') && !s.includes('quarter') && !s.includes('third')) return 'FINAL';
  if (s.includes('third')) return 'THIRD_PLACE';
  if (s.includes('semi')) return 'SF';
  if (s.includes('quarter')) return 'QF';
  if (s.includes('16')) return 'R16';
  if (s.includes('32')) return 'R32';
  return 'GROUP';
}
function mapPos(code = '', p = {}) {
  const c = code.toUpperCase();
  if (c.startsWith('GK') || truthy(p.goal_keeper)) return 'GK';
  if (c.startsWith('DF') || c.startsWith('D') || truthy(p.defender)) return 'DF';
  if (c.startsWith('FW') || c.startsWith('F') || truthy(p.forward)) return 'FW';
  if (c.startsWith('MF') || c.startsWith('M') || truthy(p.midfielder)) return 'MF';
  return 'MF';
}
const DETAIL = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' };
const emptyStats = (id) => ({
  playerId: id, minutes: 0, appearances: 0, goals: 0, assists: 0, xG: 0, xA: 0, shots: 0, shotsOnTarget: 0,
  bigChancesCreated: 0, bigChancesMissed: 0, passes: 0, passesCompleted: 0, progressivePasses: 0, progressiveCarries: 0,
  keyPasses: 0, tackles: 0, interceptions: 0, ballRecoveries: 0, duelsWon: 0, duelsTotal: 0, pressuresApplied: 0,
  pressRegains: 0, touches: 0, touchesInBox: 0, yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsWon: 0,
  saves: 0, goalsConceded: 0, cleanSheets: 0, formIndex: 50,
});

function build() {
  return (async () => {
    console.log('Downloading Fjelstul World Cup Database…');
    const [tournaments, teams, squads, players, goals, bookings, appearances, matches, standings, mgrs] =
      await Promise.all(['tournaments', 'teams', 'squads', 'players', 'goals', 'bookings', 'player_appearances', 'matches', 'group_standings', 'manager_appointments'].map(fetchCSV));

    const playerById = new Map(players.map((p) => [p.player_id, p]));
    const confByCode = new Map(teams.map((x) => [tid(x.team_code), x.confederation_code]));
    const editions = [];
    mkdirSync(CACHE, { recursive: true });

    for (const t of tournaments) {
      const TID = t.tournament_id;
      const year = Number(t.year);
      const gender = /women/i.test(t.tournament_name || '') ? 'women' : 'men';
      const editionId = `dh-${gender === 'women' ? 'w' : 'm'}${year}`;
      if (skipEdition(gender, year)) continue;

      const tSquads = squads.filter((s) => s.tournament_id === TID);
      const tMatches = matches.filter((m) => m.tournament_id === TID && !truthy(m.replay));
      const tGoals = goals.filter((g) => g.tournament_id === TID);
      const tBookings = bookings.filter((b) => b.tournament_id === TID);
      const tApps = appearances.filter((a) => a.tournament_id === TID);
      const tStand = standings.filter((g) => g.tournament_id === TID);
      const tMgr = mgrs.filter((g) => g.tournament_id === TID);
      if (!tSquads.length || !tMatches.length) continue;

      // Teams from squads (real codes). groupId from standings.
      const groupByTeam = new Map();
      for (const s of tStand) if (s.group_name) groupByTeam.set(tid(s.team_code), s.group_name.replace(/^Group\s*/i, '').trim());
      const mgrByTeam = new Map(tMgr.map((m) => [tid(m.team_code), realName(m.given_name, m.family_name)]));
      const teamMap = new Map();
      for (const s of tSquads) {
        const id = tid(s.team_code);
        if (!id || teamMap.has(id)) continue;
        teamMap.set(id, {
          id, name: s.team_name, code: tcode(s.team_code), flag: flagFor(tcode(s.team_code)),
          confederation: confByCode.get(id) || '', groupId: groupByTeam.get(id) ?? null, fifaRanking: 0, elo: 1700,
          preTournamentTitleOdds: 0, manager: mgrByTeam.get(id) || '—', attackRating: 70, defenseRating: 70,
          primaryColor: '#7c7c8a', squadIds: [],
        });
      }

      // Players + stats.
      const playerList = [];
      const playerStats = {};
      const goalsByPlayer = new Map();
      for (const g of tGoals) if (!truthy(g.own_goal) && g.player_id) goalsByPlayer.set(`${tid(g.player_team_code || g.team_code)}-${g.player_id}`, (goalsByPlayer.get(`${tid(g.player_team_code || g.team_code)}-${g.player_id}`) || 0) + 1);
      const appsByPlayer = new Map();
      const minsByPlayer = new Map();
      for (const a of tApps) {
        const pid = `${tid(a.team_code)}-${a.player_id}`;
        appsByPlayer.set(pid, (appsByPlayer.get(pid) || 0) + 1);
        minsByPlayer.set(pid, (minsByPlayer.get(pid) || 0) + (truthy(a.starter) ? 90 : 25));
      }
      const cardsByPlayer = new Map();
      for (const b of tBookings) {
        const pid = `${tid(b.team_code)}-${b.player_id}`;
        const c = cardsByPlayer.get(pid) || { y: 0, r: 0 };
        if (truthy(b.yellow_card)) c.y++;
        if (truthy(b.red_card) || truthy(b.sending_off)) c.r++;
        cardsByPlayer.set(pid, c);
      }
      for (const s of tSquads) {
        const teamId = tid(s.team_code);
        if (!teamMap.has(teamId)) continue;
        const pid = `${teamId}-${s.player_id}`;
        if (playerStats[pid]) continue;
        const meta = playerById.get(s.player_id) || {};
        const pos = mapPos(s.position_code, meta);
        const age = meta.birth_date && t.year ? Math.max(0, Number(t.year) - Number(meta.birth_date.slice(0, 4))) : 0;
        playerList.push({
          id: pid, name: realName(s.given_name, s.family_name),
          teamId, shirtNumber: Number(s.shirt_number) || 0, position: pos, detailedPosition: DETAIL[pos],
          age, heightCm: 180, foot: 'right', club: '—', marketValueEur: 0,
          rating: { overall: 72, pace: 72, shooting: 72, passing: 72, dribbling: 72, defending: 72, physical: 72 },
        });
        const st = emptyStats(pid);
        st.goals = goalsByPlayer.get(pid) || 0;
        st.appearances = appsByPlayer.get(pid) || 0;
        st.minutes = minsByPlayer.get(pid) || 0;
        const c = cardsByPlayer.get(pid) || { y: 0, r: 0 };
        st.yellowCards = c.y; st.redCards = c.r;
        playerStats[pid] = st;
      }
      teamMap.forEach((tm) => (tm.squadIds = playerList.filter((p) => p.teamId === tm.id).map((p) => p.id)));

      // Matches.
      const built = tMatches.map((m, i) => {
        const stage = mapStage(m.stage_name);
        const groupId = m.group_name ? m.group_name.replace(/^Group\s*/i, '').trim() : null;
        const pen = truthy(m.penalty_shootout);
        return {
          id: `dh-${TID}-${m.match_id || i}`, competitionId: editionId, stage, groupId,
          matchday: 1, kickoff: (m.match_date || `${t.year}-06-01`) + 'T15:00:00Z', venue: m.stadium_name || 'TBD', city: m.city_name || '',
          status: 'FINISHED', minute: 90, homeTeamId: tid(m.home_team_code), awayTeamId: tid(m.away_team_code),
          homeScore: Number(m.home_team_score) || 0, awayScore: Number(m.away_team_score) || 0,
          homeScoreHT: 0, awayScoreHT: 0,
          penalties: pen ? { home: Number(m.home_team_score_penalties) || 0, away: Number(m.away_team_score_penalties) || 0 } : null,
          teamStats: {}, events: [], shots: [], bracketSlot: null,
        };
      }).filter((m) => teamMap.has(m.homeTeamId) && teamMap.has(m.awayTeamId));

      // Groups.
      const groupLetters = [...new Set([...teamMap.values()].map((t2) => t2.groupId).filter(Boolean))].sort();
      const groups = groupLetters.map((g) => ({ id: g, competitionId: editionId, name: `Group ${g}`, teamIds: [...teamMap.values()].filter((t2) => t2.groupId === g).map((t2) => t2.id) }));

      const teamsArr = [...teamMap.values()];
      const snapshot = {
        competition: {
          id: editionId, name: t.tournament_name, season: String(t.year),
          hostCountries: [t.host_country].filter(Boolean), startDate: t.start_date || `${t.year}-06-01`, endDate: t.end_date || `${t.year}-07-01`,
          numTeams: teamsArr.length, numGroups: groups.length, currentMatchday: 1, logoEmoji: '🏆',
        },
        groups, teams: teamsArr, players: playerList, playerStats, matches: built,
        generatedAt: new Date().toISOString(),
        meta: { source: 'datahub', hasAdvancedMetrics: false, hasShotData: false },
      };

      const file = `datahub-${gender === 'women' ? 'w' : 'm'}${year}.json`;
      writeFileSync(join(CACHE, file), JSON.stringify(snapshot));
      const winnerCode = teamsArr.find((x) => x.name === t.winner)?.code;
      editions.push({
        id: editionId, label: t.tournament_name, short: String(t.year), year: Number(t.year), gender,
        host: t.host_country || '', cacheFile: file, champion: t.winner || undefined,
        championFlag: winnerCode ? flagFor(winnerCode) : '🏆', coverage: 'historical',
        blurb: `${t.winner ? t.winner + ' champions · ' : ''}results, scorers & squads`,
      });
      console.log(`  ${TID}: ${teamsArr.length} teams, ${playerList.length} players, ${built.length} matches → ${file}`);
    }

    editions.sort((a, b) => b.year - a.year || a.gender.localeCompare(b.gender));
    writeFileSync(join(ROOT, 'src/data/datahub-editions.json'), JSON.stringify(editions, null, 2));
    console.log(`\nWrote ${editions.length} historical editions + index.`);
  })();
}

build().catch((e) => { console.error(e); process.exit(1); });
