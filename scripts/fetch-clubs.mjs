#!/usr/bin/env node
/**
 * Precompute club affiliations for "Club Connections". Pulls full squads for
 * ~30 leagues worldwide from API-Football and writes a player-id → club map to
 * src/data/cache/clubs.json. World Cup squads (sharing API-Football player ids)
 * are joined against this at page time. Run: `npm run data:clubs`.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = 'https://v3.football.api-sports.io';

// Read API key from .env (node doesn't auto-load it)
function readKey() {
  if (process.env.API_FOOTBALL_KEY) return process.env.API_FOOTBALL_KEY;
  const envPath = `${ROOT}/.env`;
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/API_FOOTBALL_KEY=(.+)/);
    if (m) return m[1].trim();
  }
  return null;
}
const KEY = readKey();
if (!KEY) {
  console.error('API_FOOTBALL_KEY not found (set it in .env)');
  process.exit(1);
}

const SEASONS = [2025, 2026, 2024];

const LEAGUES = [
  { id: 39, short: 'EPL', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#3d195b' },
  { id: 140, short: 'La Liga', name: 'La Liga', country: 'Spain', flag: '🇪🇸', color: '#ee8707' },
  { id: 78, short: 'Bundesliga', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', color: '#d20515' },
  { id: 135, short: 'Serie A', name: 'Serie A', country: 'Italy', flag: '🇮🇹', color: '#008fd7' },
  { id: 61, short: 'Ligue 1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', color: '#dae025' },
  { id: 88, short: 'Eredivisie', name: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', color: '#e3170a' },
  { id: 94, short: 'Liga PT', name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹', color: '#006600' },
  { id: 144, short: 'Belgium', name: 'Pro League', country: 'Belgium', flag: '🇧🇪', color: '#e30613' },
  { id: 203, short: 'Türkiye', name: 'Süper Lig', country: 'Turkey', flag: '🇹🇷', color: '#e30a17' },
  { id: 207, short: 'Swiss', name: 'Super League', country: 'Switzerland', flag: '🇨🇭', color: '#d52b1e' },
  { id: 218, short: 'Austria', name: 'Bundesliga', country: 'Austria', flag: '🇦🇹', color: '#ed2939' },
  { id: 119, short: 'Denmark', name: 'Superliga', country: 'Denmark', flag: '🇩🇰', color: '#c60c30' },
  { id: 103, short: 'Norway', name: 'Eliteserien', country: 'Norway', flag: '🇳🇴', color: '#ba0c2f' },
  { id: 113, short: 'Sweden', name: 'Allsvenskan', country: 'Sweden', flag: '🇸🇪', color: '#006aa7' },
  { id: 106, short: 'Poland', name: 'Ekstraklasa', country: 'Poland', flag: '🇵🇱', color: '#dc143c' },
  { id: 197, short: 'Greece', name: 'Super League', country: 'Greece', flag: '🇬🇷', color: '#0d5eaf' },
  { id: 179, short: 'Scotland', name: 'Premiership', country: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', color: '#0065bf' },
  { id: 210, short: 'Croatia', name: 'HNL', country: 'Croatia', flag: '🇭🇷', color: '#ff0000' },
  { id: 345, short: 'Czechia', name: 'First League', country: 'Czechia', flag: '🇨🇿', color: '#11457e' },
  { id: 286, short: 'Serbia', name: 'SuperLiga', country: 'Serbia', flag: '🇷🇸', color: '#c6363c' },
  { id: 40, short: 'EFL Ch.', name: 'Championship', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#1b1f6b' },
  { id: 307, short: 'Saudi', name: 'Pro League', country: 'Saudi Arabia', flag: '🇸🇦', color: '#006c35' },
  { id: 253, short: 'MLS', name: 'Major League Soccer', country: 'USA', flag: '🇺🇸', color: '#0a3161' },
  { id: 262, short: 'Liga MX', name: 'Liga MX', country: 'Mexico', flag: '🇲🇽', color: '#006847' },
  { id: 71, short: 'Brazil', name: 'Série A', country: 'Brazil', flag: '🇧🇷', color: '#ffdf00' },
  { id: 128, short: 'Argentina', name: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', color: '#75aadb' },
  { id: 98, short: 'Japan', name: 'J1 League', country: 'Japan', flag: '🇯🇵', color: '#0b2265' },
  { id: 292, short: 'Korea', name: 'K League 1', country: 'South Korea', flag: '🇰🇷', color: '#cd2e3a' },
  { id: 305, short: 'Qatar', name: 'Stars League', country: 'Qatar', flag: '🇶🇦', color: '#8a1538' },
  { id: 301, short: 'UAE', name: 'Pro League', country: 'UAE', flag: '🇦🇪', color: '#00732f' },
  { id: 233, short: 'Egypt', name: 'Premier League', country: 'Egypt', flag: '🇪🇬', color: '#ce1126' },
  { id: 188, short: 'Australia', name: 'A-League', country: 'Australia', flag: '🇦🇺', color: '#fedd00' },
];

async function af(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': KEY } });
      if (res.ok) return (await res.json()).response ?? [];
      if (res.status === 429) await new Promise((r) => setTimeout(r, 1500));
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return [];
}

async function teamsForLeague(id) {
  for (const s of SEASONS) {
    const r = await af(`/teams?league=${id}&season=${s}`);
    if (r.length) return { teams: r, season: s };
  }
  return { teams: [], season: null };
}

async function main() {
  const map = {};
  const leagueStats = [];
  let calls = 0;

  for (const lg of LEAGUES) {
    const { teams, season } = await teamsForLeague(lg.id);
    calls++;
    if (!teams.length) {
      console.log(`  ${lg.short.padEnd(12)} — no data`);
      continue;
    }
    let players = 0;
    const batchSize = 10;
    for (let i = 0; i < teams.length; i += batchSize) {
      const batch = teams.slice(i, i + batchSize);
      const squads = await Promise.all(batch.map((t) => af(`/players/squads?team=${t.team.id}`)));
      calls += batch.length;
      squads.forEach((sq, b) => {
        const team = batch[b].team;
        for (const p of sq?.[0]?.players ?? []) {
          map[p.id] = {
            club: team.name, clubId: team.id, clubLogo: team.logo,
            league: lg.name, leagueShort: lg.short, leagueColor: lg.color, leagueFlag: lg.flag, country: lg.country,
          };
          players++;
        }
      });
    }
    leagueStats.push({ ...lg, season, clubs: teams.length, players });
    console.log(`  ${lg.short.padEnd(12)} ${String(teams.length).padStart(2)} clubs · ${String(players).padStart(3)} players (season ${season})`);
  }

  const out = `${ROOT}/src/data/cache/clubs.json`;
  mkdirSync(dirname(out), { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), leagues: leagueStats, map };
  writeFileSync(out, JSON.stringify(payload));
  console.log(`\n✓ ${Object.keys(map).length} players across ${leagueStats.length} leagues · ${calls} API calls`);
  console.log(`✓ wrote ${out} (${(JSON.stringify(payload).length / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
