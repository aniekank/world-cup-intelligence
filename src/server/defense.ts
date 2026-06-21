import 'server-only';
import { getTeams, getMatches, getPlayerViews } from '@/data/store';
import { engine } from '@/analytics';
import type { Team } from '@/domain/types';

/**
 * The defensive showcase — gives stifling defenses the spotlight the attack
 * already gets (Golden Boot, scorers). Three boards, all built from real data:
 *   1. Meanest Defenses (teams)   — goals/xG conceded + clean sheets
 *   2. Golden Glove (goalkeepers) — saves, clean sheets, save %
 *   3. Top Ball-Winners (outfield) — tackles/interceptions/duels/pressures per 90
 *
 * Availability is derived from the data itself (not assumed), so xG-conceded and
 * pressures hide gracefully on sources that don't carry them (e.g. the historical
 * archive, or live team-xG), the same WC-016 degradation pattern.
 */
export function defenseView() {
  const eng = engine();
  const teams = getTeams();
  const standMap = new Map(eng.standingsByGroup.flat().map((s) => [s.teamId, s]));

  // Clean sheets per team, counted off finished matches.
  const cs = new Map<string, number>();
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    if (m.awayScore === 0) cs.set(m.homeTeamId, (cs.get(m.homeTeamId) ?? 0) + 1);
    if (m.homeScore === 0) cs.set(m.awayTeamId, (cs.get(m.awayTeamId) ?? 0) + 1);
  }

  // ── 1. Meanest defenses ──
  const meanest = teams
    .map((t: Team) => {
      const s = standMap.get(t.id);
      const played = s?.played ?? 0;
      const ga = s?.goalsAgainst ?? 0;
      const xga = s?.xGAgainst ?? 0;
      return {
        team: t,
        played,
        goalsAgainst: ga,
        gaPerGame: played ? ga / played : 0,
        xGA: xga,
        xgaPerGame: played ? xga / played : 0,
        cleanSheets: cs.get(t.id) ?? 0,
        defenseRating: t.defenseRating,
      };
    })
    .filter((d) => d.played > 0);
  const xgaAvailable = meanest.some((d) => d.xGA > 0);
  meanest.sort((a, b) => {
    const pa = xgaAvailable ? a.xgaPerGame : a.gaPerGame;
    const pb = xgaAvailable ? b.xgaPerGame : b.gaPerGame;
    if (pa !== pb) return pa - pb;
    if (a.gaPerGame !== b.gaPerGame) return a.gaPerGame - b.gaPerGame;
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    return b.defenseRating - a.defenseRating;
  });

  // ── 2. Golden Glove (goalkeepers) ──
  const goldenGlove = getPlayerViews()
    .filter((p) => p.position === 'GK' && p.stats.appearances > 0)
    .map((p) => {
      const saves = p.stats.saves;
      const conceded = p.stats.goalsConceded;
      const faced = saves + conceded;
      return {
        player: p,
        saves,
        conceded,
        cleanSheets: p.stats.cleanSheets,
        savePct: faced > 0 ? saves / faced : 0,
        minutes: p.stats.minutes,
      };
    })
    .sort((a, b) => b.cleanSheets - a.cleanSheets || b.savePct - a.savePct || b.saves - a.saves)
    .slice(0, 10);

  // ── 3. Top ball-winners (outfield, per 90) ──
  const pressuresAvailable = getPlayerViews().some((p) => (p.stats.pressuresApplied ?? 0) > 0);
  const ballWinners = getPlayerViews()
    .filter((p) => p.position !== 'GK' && p.stats.minutes >= 90)
    .map((p) => {
      const per90 = (n: number) => (n / p.stats.minutes) * 90;
      const tackles = p.stats.tackles;
      const interceptions = p.stats.interceptions;
      const duelsWon = p.stats.duelsWon;
      const pressures = p.stats.pressuresApplied ?? 0;
      const actions = tackles + interceptions + duelsWon + (pressuresAvailable ? pressures : 0);
      return {
        player: p,
        score: per90(actions),
        tackles: per90(tackles),
        interceptions: per90(interceptions),
        duelsWon: per90(duelsWon),
        pressures: per90(pressures),
        minutes: p.stats.minutes,
      };
    })
    .filter((b) => b.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    meanest: meanest.slice(0, 12),
    goldenGlove,
    ballWinners,
    xgaAvailable,
    pressuresAvailable,
    hasResults: meanest.length > 0,
  };
}
