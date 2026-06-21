import 'server-only';
import { getTeam, getTeamMatches, getPlayerViews } from '@/data/store';

/**
 * Tactical identity — a derived playing-style read for a team.
 *
 * Two paths, picked by what the source actually carries:
 *  - team-stats (seeded / historical): possession, press index (PPDA), field
 *    tilt, pass accuracy → a full style label.
 *  - player-derived (live): the live feed has no team-level tactical stats, but
 *    it does aggregate player passing — so we give a coarser BUILD-UP read from
 *    pass accuracy + progression, honestly labelled (no pressing/possession).
 * Returns `available: false` rather than inventing anything when neither exists.
 * No formations or spatial maps — the feed has no coordinates.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface TacticalProfile {
  available: boolean;
  source?: 'team-stats' | 'player-derived';
  label?: string;
  tag?: string;
  blurb?: string;
  bars?: { label: string; value: number; suffix?: string }[];
  stats?: { label: string; value: string }[];
  note?: string;
  sampleMatches?: number;
}

export function tacticalProfile(teamId: string): TacticalProfile {
  const finished = getTeamMatches(teamId).filter((m) => m.status === 'FINISHED');
  if (finished.length === 0) return { available: false };
  const nm = getTeam(teamId)?.name ?? 'They';

  // ── Path A: team-level match stats (seeded / historical) ──
  let n = 0, poss = 0, ppda = 0, tilt = 0, passAcc = 0;
  for (const m of finished) {
    const ts = m.teamStats[teamId];
    if (ts && (ts.possession || ts.ppda || ts.fieldTilt)) {
      n++; poss += ts.possession; ppda += ts.ppda; tilt += ts.fieldTilt; passAcc += ts.passAccuracy;
    }
  }
  if (n > 0) {
    const possession = poss / n;
    const fieldTilt = tilt / n;
    const passAccuracy = passAcc / n;
    const press = clamp(((16 - ppda / n) / (16 - 7)) * 100, 0, 100);
    const possHigh = possession >= 53, possLow = possession <= 47;
    const pressHigh = press >= 60, pressLow = press <= 40;
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
    return {
      available: true, source: 'team-stats', label, tag, blurb, sampleMatches: n,
      bars: [
        { label: 'Possession', value: possession, suffix: '%' },
        { label: 'Press intensity', value: press },
        { label: 'Field tilt', value: fieldTilt, suffix: '%' },
        { label: 'Pass accuracy', value: passAccuracy, suffix: '%' },
      ],
    };
  }

  // ── Path B: player-aggregated build-up read (live) ──
  const games = finished.length;
  let passes = 0, completed = 0, prog = 0;
  for (const p of getPlayerViews()) {
    if (p.teamId !== teamId) continue;
    passes += p.stats.passes;
    completed += p.stats.passesCompleted;
    prog += p.stats.progressivePasses;
  }
  if (passes < 50) return { available: false };
  const passAccuracy = (completed / passes) * 100;
  const passesPerGame = passes / games;
  const progPerGame = prog / games;
  let label: string, tag: string, blurb: string;
  if (passAccuracy >= 84) {
    label = 'Patient build-up'; tag = 'Keep it on the floor';
    blurb = `${nm} build patiently — ${passAccuracy.toFixed(0)}% pass accuracy on ${Math.round(passesPerGame)} passes a game, working it forward (${Math.round(progPerGame)} into the final third).`;
  } else if (passAccuracy <= 77) {
    label = 'Direct / vertical'; tag = 'Get it forward';
    blurb = `${nm} play more directly — ${passAccuracy.toFixed(0)}% pass accuracy, going forward early rather than holding the ball (${Math.round(progPerGame)} final-third passes a game).`;
  } else {
    label = 'Balanced build-up'; tag = 'Mix it up';
    blurb = `${nm} mix short and direct — ${passAccuracy.toFixed(0)}% pass accuracy on ${Math.round(passesPerGame)} passes a game.`;
  }
  return {
    available: true, source: 'player-derived', label, tag, blurb, sampleMatches: games,
    note: 'Build-up read — the live feed has no team possession or pressing data, so this is from passing only.',
    stats: [
      { label: 'Pass accuracy', value: `${passAccuracy.toFixed(0)}%` },
      { label: 'Passes / game', value: String(Math.round(passesPerGame)) },
      { label: 'Final-third passes / game', value: String(Math.round(progPerGame)) },
    ],
  };
}

/** A one-line "styles clash" framing for a fixture, when both teams have a read. */
export function stylesClash(homeId: string, awayId: string): { home: string; away: string; line: string } | null {
  const h = tacticalProfile(homeId);
  const a = tacticalProfile(awayId);
  if (!h.available || !a.available || !h.label || !a.label) return null;
  const hn = getTeam(homeId)?.name ?? 'Home';
  const an = getTeam(awayId)?.name ?? 'Away';
  const line =
    h.label === a.label
      ? `A tactical mirror — both ${hn} and ${an} are ${h.label.toLowerCase()} sides.`
      : `${hn}'s ${h.label.toLowerCase()} against ${an}'s ${a.label.toLowerCase()} — a contrast in approach.`;
  return { home: h.label, away: a.label, line };
}
