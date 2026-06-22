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
  formation?: string; // most-used starting shape (live source)
  bars?: { label: string; value: number; suffix?: string }[];
  stats?: { label: string; value: string }[];
  note?: string;
  sampleMatches?: number;
}

/** Most-used starting formation for a team across its played matches. */
function commonFormation(finished: { homeTeamId: string; formations?: { home: string; away: string } }[], teamId: string): string | undefined {
  const tally = new Map<string, number>();
  for (const m of finished) {
    if (!m.formations) continue;
    const f = m.homeTeamId === teamId ? m.formations.home : m.formations.away;
    if (f) tally.set(f, (tally.get(f) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function tacticalProfile(teamId: string): TacticalProfile {
  const finished = getTeamMatches(teamId).filter((m) => m.status === 'FINISHED');
  if (finished.length === 0) return { available: false };
  const nm = getTeam(teamId)?.name ?? 'They';

  // ── Path A: team-level match stats (seeded / historical / live since WC-027) ──
  let n = 0, poss = 0, ppda = 0, tilt = 0, passAcc = 0, shotsSum = 0;
  let nd = 0, directSum = 0, counterSum = 0; // richer axes, live-only (optional fields)
  for (const m of finished) {
    const ts = m.teamStats[teamId];
    if (ts && (ts.possession || ts.ppda || ts.fieldTilt)) {
      n++; poss += ts.possession; ppda += ts.ppda; tilt += ts.fieldTilt; passAcc += ts.passAccuracy; shotsSum += ts.shots;
      if (typeof ts.directness === 'number') { nd++; directSum += ts.directness; counterSum += ts.counterAttacks ?? 0; }
    }
  }
  if (n > 0) {
    const possession = poss / n;
    const fieldTilt = tilt / n;
    const passAccuracy = passAcc / n;
    const shotsPerGame = shotsSum / n;
    const press = clamp(((16 - ppda / n) / (16 - 7)) * 100, 0, 100);
    const hasDir = nd > 0;
    const directness = hasDir ? directSum / nd : 0;
    const countersPerGame = hasDir ? counterSum / nd : 0;
    const possHigh = possession >= 53, possLow = possession <= 47;
    const pressHigh = press >= 60, pressLow = press <= 40;
    const direct = hasDir && directness >= 16; // long-ball share notably high
    let label: string, tag: string, blurb: string;
    if (possHigh && pressHigh) {
      label = 'Dominant high press'; tag = 'Control + press';
      blurb = `${nm} dominate the ball (${possession.toFixed(0)}%) and win it back high — a front-foot, suffocating style.`;
    } else if (pressHigh) {
      label = 'High press'; tag = 'Win it back fast';
      blurb = `${nm} press aggressively to win the ball back high up the pitch (press index ${press.toFixed(0)}/100), playing ${possession.toFixed(0)}% possession.`;
    } else if (possHigh) {
      label = direct ? 'Vertical possession' : 'Patient possession'; tag = direct ? 'Control, then strike fast' : 'Keep the ball';
      blurb = `${nm} control games through possession (${possession.toFixed(0)}%)${direct ? ', but break vertically once they win it — a direct streak through the build-up' : ' without an aggressive press — a measured build-up game'}.`;
    } else if (possLow && pressLow) {
      label = 'Deep block, counter-attacking'; tag = 'Soak and strike';
      blurb = `${nm} sit deep (${possession.toFixed(0)}% possession, low press) and threaten on the counter${hasDir && countersPerGame >= 1.5 ? ` — ${countersPerGame.toFixed(1)} counter-attacks a game` : ''}.`;
    } else if (possLow) {
      label = direct ? 'Direct counter-attacking' : 'Counter-attacking'; tag = 'Cede ball, break fast';
      blurb = `${nm} concede possession (${possession.toFixed(0)}%) and look to hurt teams in transition${direct ? `, going long early (${directness.toFixed(0)}% of passes)` : ''}.`;
    } else {
      label = 'Balanced'; tag = 'No single identity';
      blurb = `${nm} mix their approach — neither possession-dominant nor a pure press or low block.`;
    }
    const bars = [
      { label: 'Possession', value: possession, suffix: '%' },
      { label: 'Press intensity', value: press },
      { label: 'Field tilt', value: fieldTilt, suffix: '%' },
      hasDir
        ? { label: 'Directness', value: clamp((directness / 28) * 100, 0, 100), suffix: '' }
        : { label: 'Pass accuracy', value: passAccuracy, suffix: '%' },
    ];
    const stats: { label: string; value: string }[] = [{ label: 'Pass accuracy', value: `${passAccuracy.toFixed(0)}%` }, { label: 'Shots / game', value: shotsPerGame.toFixed(1) }];
    if (hasDir) stats.push({ label: 'Counters / game', value: countersPerGame.toFixed(1) });
    return {
      available: true, source: 'team-stats', label, tag, blurb, sampleMatches: n,
      formation: commonFormation(finished, teamId),
      bars, stats,
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
export function stylesClash(homeId: string, awayId: string): { home: string; away: string; line: string; homeFormation?: string; awayFormation?: string } | null {
  const h = tacticalProfile(homeId);
  const a = tacticalProfile(awayId);
  if (!h.available || !a.available || !h.label || !a.label) return null;
  const hn = getTeam(homeId)?.name ?? 'Home';
  const an = getTeam(awayId)?.name ?? 'Away';
  const fm = h.formation && a.formation ? ` Shapes: ${h.formation} v ${a.formation}.` : '';
  const line =
    (h.label === a.label
      ? `A tactical mirror — both ${hn} and ${an} are ${h.label.toLowerCase()} sides.`
      : `${hn}'s ${h.label.toLowerCase()} against ${an}'s ${a.label.toLowerCase()} — a contrast in approach.`) + fm;
  return { home: h.label, away: a.label, line, homeFormation: h.formation, awayFormation: a.formation };
}
