/**
 * World Cup honours per nation (men's), curated from well-known records.
 * Used in the globe country panel. Keyed by FIFA 3-letter code.
 */

export interface WCHistory {
  titles: number;
  titleYears: number[];
  runnerUp: number;
  bestFinish: string;
  firstAppearance?: number;
}

export const WC_HISTORY: Record<string, WCHistory> = {
  BRA: { titles: 5, titleYears: [1958, 1962, 1970, 1994, 2002], runnerUp: 2, bestFinish: 'Champions ×5', firstAppearance: 1930 },
  GER: { titles: 4, titleYears: [1954, 1974, 1990, 2014], runnerUp: 4, bestFinish: 'Champions ×4', firstAppearance: 1934 },
  ITA: { titles: 4, titleYears: [1934, 1938, 1982, 2006], runnerUp: 2, bestFinish: 'Champions ×4', firstAppearance: 1934 },
  ARG: { titles: 3, titleYears: [1978, 1986, 2022], runnerUp: 3, bestFinish: 'Champions ×3', firstAppearance: 1930 },
  FRA: { titles: 2, titleYears: [1998, 2018], runnerUp: 2, bestFinish: 'Champions ×2', firstAppearance: 1930 },
  URU: { titles: 2, titleYears: [1930, 1950], runnerUp: 0, bestFinish: 'Champions ×2', firstAppearance: 1930 },
  ENG: { titles: 1, titleYears: [1966], runnerUp: 0, bestFinish: 'Champions (1966)', firstAppearance: 1950 },
  ESP: { titles: 1, titleYears: [2010], runnerUp: 0, bestFinish: 'Champions (2010)', firstAppearance: 1934 },
  NED: { titles: 0, titleYears: [], runnerUp: 3, bestFinish: 'Runners-up ×3', firstAppearance: 1934 },
  CRO: { titles: 0, titleYears: [], runnerUp: 1, bestFinish: 'Runners-up (2018)', firstAppearance: 1998 },
  POR: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '3rd (1966)', firstAppearance: 1966 },
  BEL: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '2nd not reached — 3rd (2018)', firstAppearance: 1930 },
  MEX: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals ×2', firstAppearance: 1930 },
  USA: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '3rd (1930)', firstAppearance: 1930 },
  SWE: { titles: 0, titleYears: [], runnerUp: 1, bestFinish: 'Runners-up (1958)', firstAppearance: 1934 },
  HUN: { titles: 0, titleYears: [], runnerUp: 2, bestFinish: 'Runners-up ×2', firstAppearance: 1934 },
  POL: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '3rd ×2', firstAppearance: 1938 },
  CZE: { titles: 0, titleYears: [], runnerUp: 2, bestFinish: 'Runners-up ×2', firstAppearance: 1934 },
  AUT: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '3rd (1954)', firstAppearance: 1934 },
  CHI: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '3rd (1962)', firstAppearance: 1930 },
  COL: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals (2014)', firstAppearance: 1962 },
  MAR: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '4th (2022)', firstAppearance: 1970 },
  KOR: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: '4th (2002)', firstAppearance: 1954 },
  JPN: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Round of 16 ×4', firstAppearance: 1998 },
  SEN: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals (2002)', firstAppearance: 2002 },
  GHA: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals (2010)', firstAppearance: 2006 },
  CMR: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals (1990)', firstAppearance: 1982 },
  NGA: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Round of 16 ×3', firstAppearance: 1994 },
  SUI: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals ×3', firstAppearance: 1934 },
  DEN: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Quarter-finals (1998)', firstAppearance: 1986 },
  ECU: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Round of 16 (2006)', firstAppearance: 2002 },
  AUS: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Round of 16 ×2', firstAppearance: 1974 },
  CAN: { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Group stage', firstAppearance: 1986 },
};

const FALLBACK: WCHistory = { titles: 0, titleYears: [], runnerUp: 0, bestFinish: 'Group stage', firstAppearance: undefined };

export function wcHistory(code: string): WCHistory {
  return WC_HISTORY[code.toUpperCase()] ?? FALLBACK;
}
