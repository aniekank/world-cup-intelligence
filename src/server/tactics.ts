import 'server-only';
import { getTeam, getTeamMatches } from '@/data/store';

/**
 * Tactical identity — a derived playing-style read for a team, from the metrics
 * we actually have: possession, press intensity (PPDA), territory (field tilt)
 * and pass accuracy, averaged over played matches. Honest by construction: it
 * needs team-level match stats, which the seeded/historical editions carry but
 * the live feed does not — so it returns `available: false` rather than inventing
 * a style. (No formations or spatial maps — the feed has no coordinates.)
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface TacticalProfile {
  available: boolean;
  label?: string;
  tag?: string;
  blurb?: string;
  metrics?: { possession: number; press: number; fieldTilt: number; passAccuracy: number };
  sampleMatches?: number;
}

export function tacticalProfile(teamId: string): TacticalProfile {
  const matches = getTeamMatches(teamId).filter((m) => m.status === 'FINISHED');
  let n = 0, poss = 0, ppda = 0, tilt = 0, passAcc = 0;
  for (const m of matches) {
    const ts = m.teamStats[teamId];
    if (ts && (ts.possession || ts.ppda || ts.fieldTilt)) {
      n++; poss += ts.possession; ppda += ts.ppda; tilt += ts.fieldTilt; passAcc += ts.passAccuracy;
    }
  }
  if (n === 0) return { available: false };

  const possession = poss / n;
  const avgPpda = ppda / n;
  const fieldTilt = tilt / n;
  const passAccuracy = passAcc / n;
  // PPDA runs ~7 (intense press) to ~16 (passive) — invert to a 0..100 press index.
  const press = clamp(((16 - avgPpda) / (16 - 7)) * 100, 0, 100);

  const possHigh = possession >= 53, possLow = possession <= 47;
  const pressHigh = press >= 60, pressLow = press <= 40;
  const nm = getTeam(teamId)?.name ?? 'They';
  let label: string, tag: string, blurb: string;
  if (possHigh && pressHigh) {
    label = 'Dominant high press'; tag = 'Control + press';
    blurb = `${nm} dominate the ball (${possession.toFixed(0)}%) and win it back high — a front-foot, suffocating style.`;
  } else if (pressHigh) {
    label = 'High press'; tag = 'Win it back fast';
    blurb = `${nm} press aggressively to win the ball back high up the pitch (press index ${press.toFixed(0)}/100), playing ${possession.toFixed(0)}% possession.`;
  } else if (possHigh) {
    label = 'Patient possession'; tag = 'Keep the ball';
    blurb = `${nm} control games through possession (${possession.toFixed(0)}%) without an aggressive press — a measured build-up game.`;
  } else if (possLow && pressLow) {
    label = 'Deep block, counter-attacking'; tag = 'Soak and strike';
    blurb = `${nm} sit deep (${possession.toFixed(0)}% possession, low press) and threaten on the counter.`;
  } else if (possLow) {
    label = 'Counter-attacking'; tag = 'Cede ball, break fast';
    blurb = `${nm} concede possession (${possession.toFixed(0)}%) and look to hurt teams in transition.`;
  } else {
    label = 'Balanced'; tag = 'No single identity';
    blurb = `${nm} mix their approach — neither possession-dominant nor a pure press or low block.`;
  }

  return { available: true, label, tag, blurb, metrics: { possession, press, fieldTilt, passAccuracy }, sampleMatches: n };
}
