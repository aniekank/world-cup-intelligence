import type { Confederation } from '@/domain/types';

/**
 * The 48-team field for the FIFA World Cup 2026 (USA / Canada / Mexico).
 *
 * Ratings (attack/defense 0..100, ELO) are calibrated to reflect real
 * pre-tournament strength so the simulation produces believable results.
 * `odds` is the implied pre-tournament title probability used as the baseline
 * for over/under-performance analytics. Teams are pre-drawn into 12 groups
 * (A..L) respecting confederation-separation constraints.
 */

export interface SeedTeam {
  code: string;
  name: string;
  flag: string;
  conf: Confederation;
  group: string;
  fifa: number;
  elo: number;
  odds: number; // implied title probability 0..1 (un-normalized vig removed)
  manager: string;
  attack: number;
  defense: number;
  color: string;
}

export const SEED_TEAMS: SeedTeam[] = [
  // Group A
  { code: 'MEX', name: 'Mexico', flag: '🇲🇽', conf: 'CONCACAF', group: 'A', fifa: 14, elo: 1885, odds: 0.012, manager: 'Javier Aguirre', attack: 78, defense: 76, color: '#006847' },
  { code: 'CRO', name: 'Croatia', flag: '🇭🇷', conf: 'UEFA', group: 'A', fifa: 10, elo: 1955, odds: 0.020, manager: 'Zlatko Dalić', attack: 81, defense: 80, color: '#ff0000' },
  { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', conf: 'CONMEBOL', group: 'A', fifa: 31, elo: 1845, odds: 0.006, manager: 'Sebastián Beccacece', attack: 74, defense: 77, color: '#ffd100' },
  { code: 'QAT', name: 'Qatar', flag: '🇶🇦', conf: 'AFC', group: 'A', fifa: 37, elo: 1680, odds: 0.001, manager: 'Tintín Márquez', attack: 68, defense: 66, color: '#8a1538' },

  // Group B
  { code: 'CAN', name: 'Canada', flag: '🇨🇦', conf: 'CONCACAF', group: 'B', fifa: 30, elo: 1790, odds: 0.004, manager: 'Jesse Marsch', attack: 75, defense: 72, color: '#ff0000' },
  { code: 'BEL', name: 'Belgium', flag: '🇧🇪', conf: 'UEFA', group: 'B', fifa: 6, elo: 1965, odds: 0.028, manager: 'Rudi Garcia', attack: 84, defense: 80, color: '#e30613' },
  { code: 'KOR', name: 'South Korea', flag: '🇰🇷', conf: 'AFC', group: 'B', fifa: 22, elo: 1820, odds: 0.005, manager: 'Hong Myung-bo', attack: 77, defense: 73, color: '#cd2e3a' },
  { code: 'GHA', name: 'Ghana', flag: '🇬🇭', conf: 'CAF', group: 'B', fifa: 68, elo: 1700, odds: 0.002, manager: 'Otto Addo', attack: 73, defense: 69, color: '#006b3f' },

  // Group C
  { code: 'USA', name: 'United States', flag: '🇺🇸', conf: 'CONCACAF', group: 'C', fifa: 16, elo: 1830, odds: 0.013, manager: 'Mauricio Pochettino', attack: 79, defense: 75, color: '#0a3161' },
  { code: 'NED', name: 'Netherlands', flag: '🇳🇱', conf: 'UEFA', group: 'C', fifa: 7, elo: 1975, odds: 0.040, manager: 'Ronald Koeman', attack: 85, defense: 82, color: '#ff6200' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵', conf: 'AFC', group: 'C', fifa: 17, elo: 1870, odds: 0.011, manager: 'Hajime Moriyasu', attack: 80, defense: 77, color: '#0b2265' },
  { code: 'EGY', name: 'Egypt', flag: '🇪🇬', conf: 'CAF', group: 'C', fifa: 33, elo: 1760, odds: 0.004, manager: 'Hossam Hassan', attack: 76, defense: 73, color: '#ce1126' },

  // Group D
  { code: 'FRA', name: 'France', flag: '🇫🇷', conf: 'UEFA', group: 'D', fifa: 2, elo: 2065, odds: 0.110, manager: 'Didier Deschamps', attack: 90, defense: 87, color: '#1e3a8a' },
  { code: 'SEN', name: 'Senegal', flag: '🇸🇳', conf: 'CAF', group: 'D', fifa: 18, elo: 1840, odds: 0.010, manager: 'Pape Thiaw', attack: 80, defense: 78, color: '#00853f' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', conf: 'AFC', group: 'D', fifa: 24, elo: 1775, odds: 0.003, manager: 'Tony Popovic', attack: 73, defense: 74, color: '#fedd00' },
  { code: 'PAN', name: 'Panama', flag: '🇵🇦', conf: 'CONCACAF', group: 'D', fifa: 41, elo: 1700, odds: 0.001, manager: 'Thomas Christiansen', attack: 70, defense: 69, color: '#db0a16' },

  // Group E
  { code: 'ESP', name: 'Spain', flag: '🇪🇸', conf: 'UEFA', group: 'E', fifa: 3, elo: 2055, odds: 0.105, manager: 'Luis de la Fuente', attack: 89, defense: 85, color: '#c60b1e' },
  { code: 'URU', name: 'Uruguay', flag: '🇺🇾', conf: 'CONMEBOL', group: 'E', fifa: 11, elo: 1935, odds: 0.024, manager: 'Marcelo Bielsa', attack: 82, defense: 81, color: '#5cbfeb' },
  { code: 'CIV', name: "Côte d'Ivoire", flag: '🇨🇮', conf: 'CAF', group: 'E', fifa: 40, elo: 1745, odds: 0.003, manager: 'Emerse Faé', attack: 75, defense: 71, color: '#ff8200' },
  { code: 'NZL', name: 'New Zealand', flag: '🇳🇿', conf: 'OFC', group: 'E', fifa: 86, elo: 1620, odds: 0.0005, manager: 'Darren Bazeley', attack: 64, defense: 65, color: '#ffffff' },

  // Group F
  { code: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', conf: 'UEFA', group: 'F', fifa: 4, elo: 2010, odds: 0.090, manager: 'Thomas Tuchel', attack: 87, defense: 84, color: '#ffffff' },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', conf: 'CONMEBOL', group: 'F', fifa: 13, elo: 1920, odds: 0.022, manager: 'Néstor Lorenzo', attack: 82, defense: 79, color: '#fcd116' },
  { code: 'IRN', name: 'Iran', flag: '🇮🇷', conf: 'AFC', group: 'F', fifa: 20, elo: 1815, odds: 0.004, manager: 'Amir Ghalenoei', attack: 75, defense: 76, color: '#239f40' },
  { code: 'NOR', name: 'Norway', flag: '🇳🇴', conf: 'UEFA', group: 'F', fifa: 32, elo: 1860, odds: 0.014, manager: 'Ståle Solbakken', attack: 83, defense: 74, color: '#ba0c2f' },

  // Group G
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷', conf: 'CONMEBOL', group: 'G', fifa: 5, elo: 2045, odds: 0.105, manager: 'Carlo Ancelotti', attack: 89, defense: 83, color: '#ffdf00' },
  { code: 'SUI', name: 'Switzerland', flag: '🇨🇭', conf: 'UEFA', group: 'G', fifa: 19, elo: 1850, odds: 0.008, manager: 'Murat Yakin', attack: 77, defense: 78, color: '#d52b1e' },
  { code: 'NGA', name: 'Nigeria', flag: '🇳🇬', conf: 'CAF', group: 'G', fifa: 39, elo: 1790, odds: 0.006, manager: 'Eric Chelle', attack: 80, defense: 73, color: '#008751' },
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', conf: 'AFC', group: 'G', fifa: 59, elo: 1680, odds: 0.001, manager: 'Hervé Renard', attack: 70, defense: 70, color: '#006c35' },

  // Group H
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', conf: 'UEFA', group: 'H', fifa: 8, elo: 2000, odds: 0.075, manager: 'Roberto Martínez', attack: 87, defense: 82, color: '#006600' },
  { code: 'MAR', name: 'Morocco', flag: '🇲🇦', conf: 'CAF', group: 'H', fifa: 12, elo: 1900, odds: 0.020, manager: 'Walid Regragui', attack: 80, defense: 81, color: '#c1272d' },
  { code: 'PAR', name: 'Paraguay', flag: '🇵🇾', conf: 'CONMEBOL', group: 'H', fifa: 38, elo: 1790, odds: 0.003, manager: 'Gustavo Alfaro', attack: 73, defense: 75, color: '#d52b1e' },
  { code: 'UZB', name: 'Uzbekistan', flag: '🇺🇿', conf: 'AFC', group: 'H', fifa: 57, elo: 1690, odds: 0.001, manager: 'Timur Kapadze', attack: 71, defense: 70, color: '#1eb53a' },

  // Group I
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', conf: 'CONMEBOL', group: 'I', fifa: 1, elo: 2105, odds: 0.130, manager: 'Lionel Scaloni', attack: 90, defense: 86, color: '#75aadb' },
  { code: 'AUT', name: 'Austria', flag: '🇦🇹', conf: 'UEFA', group: 'I', fifa: 23, elo: 1855, odds: 0.009, manager: 'Ralf Rangnick', attack: 79, defense: 77, color: '#ed2939' },
  { code: 'TUN', name: 'Tunisia', flag: '🇹🇳', conf: 'CAF', group: 'I', fifa: 45, elo: 1720, odds: 0.002, manager: 'Sami Trabelsi', attack: 71, defense: 73, color: '#e70013' },
  { code: 'JOR', name: 'Jordan', flag: '🇯🇴', conf: 'AFC', group: 'I', fifa: 64, elo: 1660, odds: 0.0008, manager: 'Jamal Sellami', attack: 69, defense: 68, color: '#007a3d' },

  // Group J
  { code: 'GER', name: 'Germany', flag: '🇩🇪', conf: 'UEFA', group: 'J', fifa: 9, elo: 2005, odds: 0.085, manager: 'Julian Nagelsmann', attack: 87, defense: 82, color: '#000000' },
  { code: 'SCO', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', conf: 'UEFA', group: 'J', fifa: 44, elo: 1780, odds: 0.003, manager: 'Steve Clarke', attack: 73, defense: 74, color: '#0065bf' },
  { code: 'MLI', name: 'Mali', flag: '🇲🇱', conf: 'CAF', group: 'J', fifa: 52, elo: 1730, odds: 0.002, manager: 'Tom Saintfiet', attack: 74, defense: 72, color: '#14b53a' },
  { code: 'CRC', name: 'Costa Rica', flag: '🇨🇷', conf: 'CONCACAF', group: 'J', fifa: 54, elo: 1700, odds: 0.001, manager: 'Miguel Herrera', attack: 70, defense: 71, color: '#002b7f' },

  // Group K
  { code: 'ITA', name: 'Italy', flag: '🇮🇹', conf: 'UEFA', group: 'K', fifa: 15, elo: 1960, odds: 0.045, manager: 'Gennaro Gattuso', attack: 83, defense: 84, color: '#0066cc' },
  { code: 'PER', name: 'Peru', flag: '🇵🇪', conf: 'CONMEBOL', group: 'K', fifa: 49, elo: 1720, odds: 0.002, manager: 'Óscar Ibáñez', attack: 71, defense: 72, color: '#d91023' },
  { code: 'CMR', name: 'Cameroon', flag: '🇨🇲', conf: 'CAF', group: 'K', fifa: 53, elo: 1740, odds: 0.003, manager: 'Marc Brys', attack: 76, defense: 72, color: '#007a5e' },
  { code: 'CUW', name: 'Curaçao', flag: '🇨🇼', conf: 'CONCACAF', group: 'K', fifa: 90, elo: 1610, odds: 0.0004, manager: 'Dick Advocaat', attack: 66, defense: 64, color: '#002b7f' },

  // Group L
  { code: 'DEN', name: 'Denmark', flag: '🇩🇰', conf: 'UEFA', group: 'L', fifa: 21, elo: 1900, odds: 0.018, manager: 'Brian Riemer', attack: 81, defense: 80, color: '#c60c30' },
  { code: 'ALG', name: 'Algeria', flag: '🇩🇿', conf: 'CAF', group: 'L', fifa: 36, elo: 1800, odds: 0.006, manager: 'Vladimir Petković', attack: 79, defense: 75, color: '#007229' },
  { code: 'CHI', name: 'Chile', flag: '🇨🇱', conf: 'CONMEBOL', group: 'L', fifa: 43, elo: 1760, odds: 0.003, manager: 'Ricardo Gareca', attack: 75, defense: 73, color: '#d52b1e' },
  { code: 'JAM', name: 'Jamaica', flag: '🇯🇲', conf: 'CONCACAF', group: 'L', fifa: 60, elo: 1680, odds: 0.001, manager: 'Steve McClaren', attack: 72, defense: 68, color: '#009b3a' },
];
