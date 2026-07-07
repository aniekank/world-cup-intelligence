import 'server-only';
import { getMatches, getTeam, getPlayerViews } from '@/data/store';
import { engine } from '@/analytics';
import { predictMatch } from '@/analytics/poisson';
import { advanceProbabilities, stageName } from '@/lib/format';
import type { Match, Team, TeamForecast, PlayerView } from '@/domain/types';

/**
 * "The Business End" — comprehensive previews for the deep knockout rounds
 * (quarter-finals, semi-finals, final) with the CONDITIONAL title picture.
 *
 * For a team already in a tie, winning the title requires winning this tie, so
 *   P(title | win this tie) = P(title) / P(reach the next round)
 * — both taken from the same Monte Carlo forecast, so they're self-consistent
 * (the ratio is always ≤ 1). P(win THIS tie) comes from the per-match Poisson
 * model the match cards already use. Nothing is re-simulated or fabricated; it's
 * a probability identity over numbers the engine already produced.
 */

// Deepest active round first — the "business end" is whatever's furthest along.
const KO_DEEP: Match['stage'][] = ['FINAL', 'SF', 'QF', 'R16', 'R32'];
// The reach-probability you achieve by WINNING a tie at each stage (final → the title itself).
const REACH_AFTER_WIN: Partial<Record<Match['stage'], keyof TeamForecast>> = {
  R32: 'reachR16', R16: 'reachQF', QF: 'reachSF', SF: 'reachFinal', FINAL: 'winTitle',
};

export interface DeepSide {
  id: string; name: string; code: string; flag: string; color: string;
  advance: number;      // P(win this tie) — per-match Poisson model
  title: number;        // unconditional title odds — Monte Carlo
  titleIfWin: number;   // conditional title odds if they win this tie (MC-consistent)
  topScorer: { id: string; name: string; goals: number } | null;
  path: { opp: string; score: string }[]; // knockout wins so far
}
export interface DeepTie {
  id: string; stage: Match['stage']; kickoff: string; venue: string; city: string;
  home: DeepSide; away: DeepSide;
  egHome: number; egAway: number;
  likely: { home: number; away: number; prob: number } | null;
  atStake: number;                       // combined title probability on the line
  favorite: 'home' | 'away' | 'even';
}

const isUpcoming = (m: Match): boolean => m.status === 'SCHEDULED' || m.status === 'LIVE' || m.status === 'HALFTIME';

function buildSide(team: Team, f: TeamForecast | undefined, advance: number, stage: Match['stage'], matches: Match[], players: PlayerView[]): DeepSide {
  const winTitle = f?.winTitle ?? 0;
  const reachField = REACH_AFTER_WIN[stage];
  const reachAfter = reachField ? ((f?.[reachField] as number | undefined) ?? 0) : 0;
  // If winning this tie makes them champions (final), the conditional is 1.
  const titleIfWin = stage === 'FINAL' ? 1 : reachAfter > 0 ? Math.min(1, winTitle / reachAfter) : 0;

  let topScorer: DeepSide['topScorer'] = null;
  for (const p of players) {
    if (p.teamId !== team.id) continue;
    if (p.stats.goals > 0 && (!topScorer || p.stats.goals > topScorer.goals)) topScorer = { id: p.id, name: p.name, goals: p.stats.goals };
  }

  const path: DeepSide['path'] = [];
  for (const m of matches) {
    if (m.stage === 'GROUP' || m.status !== 'FINISHED') continue;
    if (m.homeTeamId !== team.id && m.awayTeamId !== team.id) continue;
    const home = m.homeTeamId === team.id;
    const gf = home ? m.homeScore : m.awayScore, ga = home ? m.awayScore : m.homeScore;
    const won = gf > ga || (gf === ga && !!m.penalties && (home ? m.penalties.home > m.penalties.away : m.penalties.away > m.penalties.home));
    if (!won) continue;
    const opp = getTeam(home ? m.awayTeamId : m.homeTeamId);
    if (!opp) continue;
    const pens = m.penalties && gf === ga ? ` (${Math.max(m.penalties.home, m.penalties.away)}-${Math.min(m.penalties.home, m.penalties.away)}p)` : '';
    path.push({ opp: opp.code, score: `${gf}-${ga}${pens}` });
  }

  return { id: team.id, name: team.name, code: team.code, flag: team.flag, color: team.primaryColor, advance, title: winTitle, titleIfWin, topScorer, path };
}

export function deepRoundsView() {
  const eng = engine();
  const matches = getMatches();
  const players = getPlayerViews();

  const stage = KO_DEEP.find((st) => matches.some((m) => m.stage === st && isUpcoming(m) && getTeam(m.homeTeamId) && getTeam(m.awayTeamId)));
  if (!stage) return { stage: null as Match['stage'] | null, stageLabel: null as string | null, ties: [] as DeepTie[], biggestId: null as string | null };

  const ties: DeepTie[] = [];
  for (const m of matches) {
    if (m.stage !== stage || !isUpcoming(m)) continue;
    const home = getTeam(m.homeTeamId), away = getTeam(m.awayTeamId);
    if (!home || !away) continue;
    const pred = predictMatch(home, away);
    const adv = advanceProbabilities(pred);
    const top = pred.scoreline[0] ?? null;
    const hs = buildSide(home, eng.forecasts.get(home.id), adv.home, stage, matches, players);
    const as = buildSide(away, eng.forecasts.get(away.id), adv.away, stage, matches, players);
    ties.push({
      id: m.id, stage, kickoff: m.kickoff, venue: m.venue, city: m.city,
      home: hs, away: as,
      egHome: pred.expectedGoals.home, egAway: pred.expectedGoals.away,
      likely: top ? { home: top.home, away: top.away, prob: top.prob } : null,
      atStake: hs.title + as.title,
      favorite: adv.home >= 0.56 ? 'home' : adv.away >= 0.56 ? 'away' : 'even',
    });
  }
  ties.sort((a, b) => b.atStake - a.atStake || a.kickoff.localeCompare(b.kickoff));
  return { stage, stageLabel: stageName[stage] ?? 'Knockouts', ties, biggestId: ties[0]?.id ?? null };
}

export type DeepRoundsData = ReturnType<typeof deepRoundsView>;
