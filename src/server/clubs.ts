import 'server-only';
import { getPlayerViews, getTeams, getActiveTournamentId } from '@/data/store';
import { getClubMap, type ClubAffiliation } from '@/data/clubAffiliations';

/**
 * Joins the active tournament's squads to the club-affiliation map, producing
 * the "Club Connections" views: by league, by club, and by country. Only
 * meaningful for the live edition (historical StatsBomb data has no player ids
 * that map to clubs).
 */

export interface ClubPlayerLink {
  playerId: string;
  name: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  club: string;
  clubLogo: string;
  league: string;
  leagueShort: string;
  leagueColor: string;
  leagueFlag: string;
  goals: number;
}

function apiId(playerId: string): number | null {
  const n = Number(playerId.split('-')[1]);
  return Number.isFinite(n) ? n : null;
}

export async function clubConnections() {
  const activeId = getActiveTournamentId();
  const isLive = activeId === 'live-2026';
  const clubMap = isLive ? await getClubMap() : new Map<number, ClubAffiliation>();

  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  const links: ClubPlayerLink[] = [];

  for (const p of getPlayerViews()) {
    const aid = apiId(p.id);
    if (aid == null) continue;
    const club = clubMap.get(aid);
    if (!club) continue;
    const team = teamMap.get(p.teamId);
    if (!team) continue;
    links.push({
      playerId: p.id, name: p.name,
      countryCode: team.code, countryName: team.name, countryFlag: team.flag,
      club: club.club, clubLogo: club.clubLogo, league: club.league,
      leagueShort: club.leagueShort, leagueColor: club.leagueColor, leagueFlag: club.leagueFlag,
      goals: p.stats.goals,
    });
  }

  // By league — derived from the actual links (every league with a WC player)
  const leagueGroups = new Map<string, ClubPlayerLink[]>();
  for (const l of links) {
    const arr = leagueGroups.get(l.league) ?? [];
    arr.push(l);
    leagueGroups.set(l.league, arr);
  }
  const byLeague = [...leagueGroups.entries()]
    .map(([name, players]) => ({
      name,
      short: players[0]!.leagueShort,
      flag: players[0]!.leagueFlag,
      color: players[0]!.leagueColor,
      players: players.length,
      clubs: new Set(players.map((x) => x.club)).size,
      countries: new Set(players.map((x) => x.countryCode)).size,
    }))
    .sort((a, b) => b.players - a.players);

  // By club (giants and minnows alike)
  const clubGroups = new Map<string, ClubPlayerLink[]>();
  for (const l of links) {
    const arr = clubGroups.get(l.club) ?? [];
    arr.push(l);
    clubGroups.set(l.club, arr);
  }
  const clubs = [...clubGroups.entries()]
    .map(([club, players]) => ({
      club,
      clubLogo: players[0]!.clubLogo,
      league: players[0]!.league,
      leagueShort: players[0]!.leagueShort,
      leagueColor: players[0]!.leagueColor,
      count: players.length,
      players: players.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count || a.club.localeCompare(b.club));

  // By country
  const countryGroups = new Map<string, ClubPlayerLink[]>();
  for (const l of links) {
    const arr = countryGroups.get(l.countryCode) ?? [];
    arr.push(l);
    countryGroups.set(l.countryCode, arr);
  }
  const countries = [...countryGroups.entries()]
    .map(([code, players]) => {
      const team = getTeams().find((t) => t.code === code)!;
      const clubsForCountry = new Map<string, { club: string; logo: string; leagueShort: string; color: string; count: number }>();
      for (const p of players) {
        const c = clubsForCountry.get(p.club) ?? { club: p.club, logo: p.clubLogo, leagueShort: p.leagueShort, color: p.leagueColor, count: 0 };
        c.count++;
        clubsForCountry.set(p.club, c);
      }
      return {
        code, name: team.name, flag: team.flag, teamId: team.id,
        total: players.length,
        clubs: [...clubsForCountry.values()].sort((a, b) => b.count - a.count),
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    available: isLive && links.length > 0,
    isLive,
    totalLinked: links.length,
    byLeague,
    clubs,
    countries,
  };
}
