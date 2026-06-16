/**
 * Enrichment table for live feeds. Free data providers (football-data.org) give
 * scores/fixtures/standings/scorers but omit flags, brand colors, confederation
 * and strength ratings. We enrich by FIFA 3-letter code from our calibrated team
 * table so live teams render with the same visual identity and so the analytics
 * engine (ELO/Poisson) has rating priors to work with.
 */

import { SEED_TEAMS } from './teams';
import type { Confederation } from '@/domain/types';

export interface TeamEnrichment {
  flag: string;
  primaryColor: string;
  confederation: Confederation;
  fifaRanking: number;
  elo: number;
  attackRating: number;
  defenseRating: number;
  preTournamentTitleOdds: number;
}

// Real 2026 World Cup teams not in the simulation field (flags/colors/priors).
const EXTRA: Record<string, Omit<TeamEnrichment, 'preTournamentTitleOdds'>> = {
  SWE: { flag: '🇸🇪', primaryColor: '#006aa7', confederation: 'UEFA', fifaRanking: 25, elo: 1820, attackRating: 78, defenseRating: 76 },
  CZE: { flag: '🇨🇿', primaryColor: '#11457e', confederation: 'UEFA', fifaRanking: 40, elo: 1800, attackRating: 76, defenseRating: 75 },
  TUR: { flag: '🇹🇷', primaryColor: '#e30a17', confederation: 'UEFA', fifaRanking: 27, elo: 1835, attackRating: 80, defenseRating: 75 },
  BIH: { flag: '🇧🇦', primaryColor: '#002395', confederation: 'UEFA', fifaRanking: 74, elo: 1760, attackRating: 75, defenseRating: 72 },
  CGO: { flag: '🇨🇩', primaryColor: '#007fff', confederation: 'CAF', fifaRanking: 60, elo: 1720, attackRating: 74, defenseRating: 71 },
  COD: { flag: '🇨🇩', primaryColor: '#007fff', confederation: 'CAF', fifaRanking: 60, elo: 1720, attackRating: 74, defenseRating: 71 },
  RSA: { flag: '🇿🇦', primaryColor: '#007a4d', confederation: 'CAF', fifaRanking: 58, elo: 1700, attackRating: 72, defenseRating: 70 },
  CPV: { flag: '🇨🇻', primaryColor: '#003893', confederation: 'CAF', fifaRanking: 70, elo: 1690, attackRating: 71, defenseRating: 70 },
  IRQ: { flag: '🇮🇶', primaryColor: '#ce1126', confederation: 'AFC', fifaRanking: 56, elo: 1700, attackRating: 71, defenseRating: 71 },
  HAI: { flag: '🇭🇹', primaryColor: '#00209f', confederation: 'CONCACAF', fifaRanking: 82, elo: 1660, attackRating: 70, defenseRating: 67 },
  CUR: { flag: '🇨🇼', primaryColor: '#002b7f', confederation: 'CONCACAF', fifaRanking: 88, elo: 1640, attackRating: 68, defenseRating: 66 },
};

const BY_CODE = new Map<string, TeamEnrichment>(
  SEED_TEAMS.map((t) => [
    t.code.toUpperCase(),
    {
      flag: t.flag,
      primaryColor: t.color,
      confederation: t.conf,
      fifaRanking: t.fifa,
      elo: t.elo,
      attackRating: t.attack,
      defenseRating: t.defense,
      preTournamentTitleOdds: t.odds,
    },
  ]),
);
for (const [code, e] of Object.entries(EXTRA)) {
  if (!BY_CODE.has(code)) BY_CODE.set(code, { ...e, preTournamentTitleOdds: 0 });
}

const FALLBACK_COLORS = ['#ff2e9a', '#9d3df0', '#6d4dff', '#ff8a1e', '#22e0d0', '#a8e020', '#1fe5c4'];

export function enrichTeam(code: string): TeamEnrichment {
  const hit = BY_CODE.get(code.toUpperCase());
  if (hit) return hit;
  // Deterministic color per code so unmapped teams still look distinct
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return {
    flag: '🏳️',
    primaryColor: FALLBACK_COLORS[h % FALLBACK_COLORS.length] as string,
    confederation: 'UEFA',
    fifaRanking: 0,
    elo: 1750,
    attackRating: 74,
    defenseRating: 74,
    preTournamentTitleOdds: 0,
  };
}
