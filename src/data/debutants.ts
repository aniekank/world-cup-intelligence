/**
 * World Cup debutant nations by edition (first-ever appearance), keyed by year.
 * Well-known records; codes match our team codes.
 */
export const DEBUTANTS: Record<number, string[]> = {
  2026: ['CPV', 'CUR', 'CUW', 'JOR', 'UZB'], // Cape Verde, Curaçao, Jordan, Uzbekistan
  2022: ['QAT'], // Qatar (hosts)
  2018: ['ICE', 'ISL', 'PAN'], // Iceland, Panama
  2014: ['BIH'], // Bosnia & Herzegovina
};

export function debutantsForYear(year: number | undefined): Set<string> {
  return new Set((DEBUTANTS[year ?? 0] ?? []).map((c) => c.toUpperCase()));
}

export function isDebutant(code: string, year: number | undefined): boolean {
  return debutantsForYear(year).has(code.toUpperCase());
}
