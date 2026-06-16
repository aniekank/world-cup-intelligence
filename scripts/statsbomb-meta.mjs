// Team identity (code/flag/color/confederation) + rough strength priors for the
// 2022 World Cup field — StatsBomb open data provides names but not crests/colors.
// Keyed by lowercased team name. Unknown teams fall back gracefully.

export const TEAM_META = {
  argentina: { code: 'ARG', flag: '🇦🇷', color: '#75aadb', conf: 'CONMEBOL', elo: 2030, atk: 88, def: 84 },
  france: { code: 'FRA', flag: '🇫🇷', color: '#1e3a8a', conf: 'UEFA', elo: 2040, atk: 90, def: 85 },
  croatia: { code: 'CRO', flag: '🇭🇷', color: '#ff0000', conf: 'UEFA', elo: 1945, atk: 80, def: 80 },
  morocco: { code: 'MAR', flag: '🇲🇦', color: '#c1272d', conf: 'CAF', elo: 1880, atk: 78, def: 83 },
  netherlands: { code: 'NED', flag: '🇳🇱', color: '#ff6200', conf: 'UEFA', elo: 1970, atk: 84, def: 82 },
  england: { code: 'ENG', flag: '🏴', color: '#ffffff', conf: 'UEFA', elo: 1990, atk: 86, def: 82 },
  brazil: { code: 'BRA', flag: '🇧🇷', color: '#ffdf00', conf: 'CONMEBOL', elo: 2010, atk: 89, def: 82 },
  portugal: { code: 'POR', flag: '🇵🇹', color: '#006600', conf: 'UEFA', elo: 1985, atk: 86, def: 81 },
  spain: { code: 'ESP', flag: '🇪🇸', color: '#c60b1e', conf: 'UEFA', elo: 1980, atk: 86, def: 82 },
  japan: { code: 'JPN', flag: '🇯🇵', color: '#0b2265', conf: 'AFC', elo: 1840, atk: 78, def: 77 },
  senegal: { code: 'SEN', flag: '🇸🇳', color: '#00853f', conf: 'CAF', elo: 1820, atk: 78, def: 77 },
  'united states': { code: 'USA', flag: '🇺🇸', color: '#0a3161', conf: 'CONCACAF', elo: 1800, atk: 77, def: 75 },
  switzerland: { code: 'SUI', flag: '🇨🇭', color: '#d52b1e', conf: 'UEFA', elo: 1850, atk: 77, def: 78 },
  poland: { code: 'POL', flag: '🇵🇱', color: '#dc143c', conf: 'UEFA', elo: 1820, atk: 76, def: 76 },
  australia: { code: 'AUS', flag: '🇦🇺', color: '#fedd00', conf: 'AFC', elo: 1770, atk: 72, def: 74 },
  germany: { code: 'GER', flag: '🇩🇪', color: '#000000', conf: 'UEFA', elo: 1960, atk: 85, def: 80 },
  ecuador: { code: 'ECU', flag: '🇪🇨', color: '#ffd100', conf: 'CONMEBOL', elo: 1820, atk: 74, def: 77 },
  uruguay: { code: 'URU', flag: '🇺🇾', color: '#5cbfeb', conf: 'CONMEBOL', elo: 1910, atk: 80, def: 80 },
  'south korea': { code: 'KOR', flag: '🇰🇷', color: '#cd2e3a', conf: 'AFC', elo: 1810, atk: 76, def: 73 },
  'korea republic': { code: 'KOR', flag: '🇰🇷', color: '#cd2e3a', conf: 'AFC', elo: 1810, atk: 76, def: 73 },
  cameroon: { code: 'CMR', flag: '🇨🇲', color: '#007a5e', conf: 'CAF', elo: 1740, atk: 76, def: 72 },
  ghana: { code: 'GHA', flag: '🇬🇭', color: '#006b3f', conf: 'CAF', elo: 1700, atk: 73, def: 69 },
  mexico: { code: 'MEX', flag: '🇲🇽', color: '#006847', conf: 'CONCACAF', elo: 1880, atk: 78, def: 76 },
  tunisia: { code: 'TUN', flag: '🇹🇳', color: '#e70013', conf: 'CAF', elo: 1720, atk: 71, def: 73 },
  belgium: { code: 'BEL', flag: '🇧🇪', color: '#e30613', conf: 'UEFA', elo: 1940, atk: 84, def: 80 },
  canada: { code: 'CAN', flag: '🇨🇦', color: '#ff0000', conf: 'CONCACAF', elo: 1790, atk: 75, def: 72 },
  denmark: { code: 'DEN', flag: '🇩🇰', color: '#c60c30', conf: 'UEFA', elo: 1900, atk: 81, def: 80 },
  serbia: { code: 'SRB', flag: '🇷🇸', color: '#c6363c', conf: 'UEFA', elo: 1820, atk: 79, def: 74 },
  wales: { code: 'WAL', flag: '🏴', color: '#c8102e', conf: 'UEFA', elo: 1790, atk: 73, def: 74 },
  qatar: { code: 'QAT', flag: '🇶🇦', color: '#8a1538', conf: 'AFC', elo: 1680, atk: 68, def: 66 },
  iran: { code: 'IRN', flag: '🇮🇷', color: '#239f40', conf: 'AFC', elo: 1810, atk: 75, def: 76 },
  'saudi arabia': { code: 'KSA', flag: '🇸🇦', color: '#006c35', conf: 'AFC', elo: 1680, atk: 70, def: 70 },
  'costa rica': { code: 'CRC', flag: '🇨🇷', color: '#002b7f', conf: 'CONCACAF', elo: 1700, atk: 70, def: 71 },
};

export function metaFor(name) {
  const key = name.toLowerCase();
  return (
    TEAM_META[key] ?? {
      code: name.slice(0, 3).toUpperCase(),
      flag: '🏳️',
      color: '#1fe5c4',
      conf: 'UEFA',
      elo: 1750,
      atk: 74,
      def: 74,
    }
  );
}

// 2022 World Cup group assignments (StatsBomb doesn't label groups).
export const GROUP_OF = {
  qatar: 'A', ecuador: 'A', senegal: 'A', netherlands: 'A',
  england: 'B', iran: 'B', 'united states': 'B', wales: 'B',
  argentina: 'C', 'saudi arabia': 'C', mexico: 'C', poland: 'C',
  france: 'D', australia: 'D', denmark: 'D', tunisia: 'D',
  spain: 'E', 'costa rica': 'E', germany: 'E', japan: 'E',
  belgium: 'F', canada: 'F', morocco: 'F', croatia: 'F',
  brazil: 'G', serbia: 'G', switzerland: 'G', cameroon: 'G',
  portugal: 'H', ghana: 'H', uruguay: 'H', 'south korea': 'H', 'korea republic': 'H',
};

export const STAGE_MAP = {
  'Group Stage': 'GROUP',
  'Round of 16': 'R16',
  'Quarter-finals': 'QF',
  'Semi-finals': 'SF',
  Final: 'FINAL',
  '3rd Place Final': 'THIRD_PLACE',
};
