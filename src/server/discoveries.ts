import 'server-only';
import { getTeams, getActiveTournamentId, getPlayerViews, getSquad } from '@/data/store';
import { engine } from '@/analytics';
import { getClubKeyMap, clubMatchKeys, type ClubAffiliation } from '@/data/clubAffiliations';
import { debutantsForYear } from '@/data/debutants';
import { getTournament } from '@/data/tournaments';

const POS: Record<string, string> = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };
const CONF_LABEL: Record<string, string> = {
  UEFA: 'Europe (UEFA)', CONMEBOL: 'South America (CONMEBOL)', CONCACAF: 'N. & C. America (CONCACAF)',
  CAF: 'Africa (CAF)', AFC: 'Asia (AFC)', OFC: 'Oceania (OFC)',
};

// Marquee clubs get the top tier; any top-5-league club gets tier 2.
const MARQUEE = ['real madrid', 'barcelona', 'bayern', 'manchester city', 'paris', 'liverpool', 'arsenal', 'chelsea', 'inter', 'juventus', 'atletico', 'atlético', 'dortmund', 'napoli', 'tottenham', 'manchester united', 'milan', 'newcastle', 'aston villa', 'leverkusen', 'atalanta', 'benfica', 'porto', 'sporting', 'ajax', 'leipzig'];
const TOP5 = new Set(['EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1']);

function clubTier(c: ClubAffiliation): number {
  const n = c.club.toLowerCase();
  if (MARQUEE.some((m) => n.includes(m))) return 3;
  if (TOP5.has(c.leagueShort)) return 2;
  return 1;
}

export interface UnderratedPlayer {
  id: string;
  name: string;
  position: string;
  positionFull: string;
  nation: string;
  nationFlag: string;
  nationId: string;
  club: string;
  clubLogo: string;
  league: string;
  leagueColor: string;
  titleOdds: number;
  blurb: string;
}

export async function discoveries() {
  const activeId = getActiveTournamentId();
  const tournament = getTournament(activeId);
  const isLive = activeId === 'live-2026';
  const eng = engine();
  const teamByCode = new Map(getTeams().map((t) => [t.code, t]));
  const teamById = new Map(getTeams().map((t) => [t.id, t]));
  // WC-024: join by surname+DOB (SportMonks ↔ API-Football share no id namespace).
  const keyMap = isLive ? await getClubKeyMap() : new Map<string, ClubAffiliation>();

  // ── Underrated by continent ──
  const candidates: (UnderratedPlayer & { score: number; conf: string })[] = [];
  for (const p of getPlayerViews()) {
    let club: ClubAffiliation | undefined;
    for (const key of clubMatchKeys(p.name, p.birthDate)) {
      club = keyMap.get(key);
      if (club) break;
    }
    if (!club) continue;
    const team = teamById.get(p.teamId);
    if (!team) continue;
    const tier = clubTier(club);
    if (tier < 2) continue; // proven at a top-5 league or marquee club only
    const win = eng.forecasts.get(team.id)?.winTitle ?? 0;
    if (win > 0.06) continue; // skip players of the tournament favourites
    const last = p.name.split(' ').slice(-1)[0];
    candidates.push({
      id: p.id, name: p.name, position: p.position, positionFull: POS[p.position] ?? p.position,
      nation: team.name, nationFlag: team.flag, nationId: team.id,
      club: club.club, clubLogo: club.clubLogo, league: club.league, leagueColor: club.leagueColor,
      titleOdds: win,
      blurb: `${tier === 3 ? 'A standout at' : 'Proven at'} ${club.club} in the ${club.league}, ${last} is ${team.name}'s class act — yet the model gives ${team.name} just ${(win * 100).toFixed(1)}% to win it all. One of ${team.confederation}'s genuine under-the-radar difference-makers.`,
      score: tier * (1 - Math.min(win * 6, 0.9)) + (p.stats.goals + p.stats.assists) * 0.05,
      conf: team.confederation,
    });
  }
  // dedupe by club×nation is fine; group by confederation, top per group
  const byContinent = Object.entries(CONF_LABEL).map(([conf, label]) => {
    const players = candidates
      .filter((c) => c.conf === conf)
      .sort((a, b) => b.score - a.score)
      // one per nation for spread, then take 3
      .filter((c, i, arr) => arr.findIndex((x) => x.nationId === c.nationId) === i)
      .slice(0, 3);
    return { conf, label, players };
  }).filter((g) => g.players.length > 0);

  // ── Debutant nations ──
  const debutCodes = debutantsForYear(tournament?.year);
  const debutants = getTeams()
    .filter((t) => debutCodes.has(t.code))
    .map((t) => {
      const squad = getSquad(t.id);
      // Europe/top-league based players for the spotlight
      const keyPlayers = squad
        .map((p) => {
          let club;
          for (const k of clubMatchKeys(p.name, p.birthDate)) { club = keyMap.get(k); if (club) break; }
          return club ? { id: p.id, name: p.name, club: club.club, league: club.leagueShort } : null;
        })
        .filter((x): x is { id: string; name: string; club: string; league: string } => Boolean(x))
        .slice(0, 6);
      return {
        id: t.id, code: t.code, name: t.name, flag: t.flag, confederation: t.confederation,
        group: t.groupId, coach: t.manager && t.manager !== '—' ? t.manager : null,
        squadSize: squad.length, keyPlayers,
        blurb: `${t.name} reach the World Cup for the very first time${t.groupId ? `, drawn into Group ${t.groupId}` : ''}. ${
          keyPlayers.length ? `Their campaign leans on European-based talent like ${keyPlayers[0]!.name} (${keyPlayers[0]!.club}).` : 'A historic debut on the game’s biggest stage.'
        }`,
      };
    });

  return {
    isLive,
    year: tournament?.year,
    byContinent,
    debutants,
    historyNote: tournament ? `${tournament.label}` : '',
  };
}
