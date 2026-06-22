/**
 * Match preview & "stakes" engine.
 *
 * Turns the raw analytics (predictions, forecasts, standings, momentum, squads)
 * into editorial context for UPCOMING matches: what's at stake, how close the
 * model thinks it is, who to watch, and a ranked "matches that matter" feed.
 * Deterministic + grounded; every claim traces to a number. The prose can be
 * upgraded to Claude via narrate() (see narratives.ts) — this is the fallback.
 */

import { getTeam, getMatches, getMatch, getPlayerViews } from '@/data/store';
import { engine } from '@/analytics';
import { stylesClash } from '@/server/tactics';
import type { Match, PlayerView, StandingRow, H2HMeeting } from '@/domain/types';

export interface PreviewTag {
  label: string;
  tone: 'hot' | 'high' | 'mid';
}

export interface MatchPreview {
  matchId: string;
  kickoff: string;
  stage: Match['stage'];
  groupId: string | null;
  stakesScore: number;
  headline: string;
  tags: PreviewTag[];
  blurb: string;
  edge: { side: 'home' | 'away' | 'even'; prob: number };
  keyHome: { id: string; name: string } | null;
  keyAway: { id: string; name: string } | null;
  qualification?: string;                 // group-stage "what each result means"
  tactical?: string;                      // styles contrast (+ shapes when known)
  h2h?: { line: string; meetings: H2HMeeting[] }; // recent head-to-head
}

/**
 * Group-stage qualification scenarios for the FINAL round (1 game left each),
 * where the maths is crisp. Sound + conservative: it never claims "through" or
 * "out" unless it's mathematically guaranteed (others' max / current points).
 */
function qualScenario(group: StandingRow[], homeId: string, awayId: string): string | null {
  const GP = 3; // group games per team
  const sh = group.find((r) => r.teamId === homeId);
  const sa = group.find((r) => r.teamId === awayId);
  if (!sh || !sa) return null;
  if (sh.played !== GP - 1 || sa.played !== GP - 1) return null; // only the decisive round

  const lineFor = (s: StandingRow): string | null => {
    const nm = getTeam(s.teamId)?.name ?? 'They';
    if (s.status === 'Q') return `${nm} are already through`;
    if (s.status === 'E') return `${nm} are out`;
    const others = group.filter((r) => r.teamId !== s.teamId);
    const securedAt = (fp: number) => others.filter((r) => r.points + 3 * (GP - r.played) >= fp).length <= 1;
    const eliminatedAt = (fp: number) => others.filter((r) => r.points > fp).length >= 2;
    const win = s.points + 3, draw = s.points + 1, loss = s.points;
    if (securedAt(draw)) return `${nm} are through with a draw or better`;
    if (securedAt(win)) return `a win sends ${nm} through`;
    if (eliminatedAt(draw)) return `${nm} must win to survive`;
    if (eliminatedAt(loss)) return `${nm} need at least a draw`;
    return `${nm} hold their own fate`;
  };
  const parts = [lineFor(sh), lineFor(sa)].filter(Boolean);
  return parts.length ? parts.join('; ') + '.' : null;
}

/** Recent head-to-head record, framed for the two sides meeting now. */
function h2hSummary(m: Match): { line: string; meetings: H2HMeeting[] } | null {
  if (!m.h2h?.length) return null;
  const A = m.homeTeamId, B = m.awayTeamId;
  let aw = 0, d = 0, bw = 0;
  for (const g of m.h2h) {
    const winner = g.homeScore > g.awayScore ? g.homeCode : g.awayScore > g.homeScore ? g.awayCode : null;
    if (winner === null) d++; else if (winner === A) aw++; else if (winner === B) bw++;
  }
  const aN = getTeam(A)?.name ?? A.toUpperCase();
  const bN = getTeam(B)?.name ?? B.toUpperCase();
  const n = m.h2h.length;
  const lead = aw > bw ? `${aN} lead ${aw}-${d}-${bw}` : bw > aw ? `${bN} lead ${bw}-${d}-${aw}` : `honours even (${aw}-${d}-${bw})`;
  return { line: `Last ${n} meeting${n === 1 ? '' : 's'}: ${lead}.`, meetings: m.h2h };
}

const STAGE_LABEL: Record<string, string> = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  FINAL: 'Final',
  THIRD_PLACE: 'Third-place play-off',
};

/** Most "watchable" player on a side — the one a preview should name. */
function starOf(teamId: string): PlayerView | null {
  let best: PlayerView | null = null;
  let bestScore = -Infinity;
  for (const p of getPlayerViews()) {
    if (p.teamId !== teamId) continue;
    const s = p.stats;
    const score =
      s.goals * 4 + s.assists * 2.5 + s.xG * 1.5 + s.xA * 1.2 + (s.formIndex - 50) * 0.1 + (p.rating.overall - 75) * 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

const formStreak = (form: string[] | undefined): string => (form && form.length ? form.slice(-5).join('') : '');

function buildPreview(m: Match): MatchPreview {
  const eng = engine();
  const home = getTeam(m.homeTeamId);
  const away = getTeam(m.awayTeamId);
  const pred = eng.predictions.get(m.id) ?? null;
  const sh = eng.standingsByTeam.get(m.homeTeamId);
  const sa = eng.standingsByTeam.get(m.awayTeamId);
  const fh = eng.forecasts.get(m.homeTeamId);
  const fa = eng.forecasts.get(m.awayTeamId);
  const prh = eng.powerRankings.find((r) => r.teamId === m.homeTeamId);
  const pra = eng.powerRankings.find((r) => r.teamId === m.awayTeamId);
  const hName = home?.name ?? 'TBD';
  const aName = away?.name ?? 'TBD';

  const tags: PreviewTag[] = [];
  let score = 0;
  const knockout = m.stage !== 'GROUP';

  if (knockout) {
    tags.push({ label: STAGE_LABEL[m.stage] ?? 'Knockout', tone: 'high' });
    score += m.stage === 'FINAL' ? 90 : m.stage === 'SF' ? 70 : m.stage === 'QF' ? 55 : 45;
  }

  // Heavyweight clash — two genuine contenders.
  if (fh && fa && fh.winTitle > 0.035 && fa.winTitle > 0.035) {
    tags.push({ label: 'Heavyweight clash', tone: 'high' });
    score += 28 + (fh.winTitle + fa.winTitle) * 120;
  }

  // Group decider — last round, both still alive.
  const alive = (s?: { status: string | null }) => !!s && s.status !== 'Q' && s.status !== 'E';
  if (m.stage === 'GROUP' && m.matchday >= 3 && alive(sh) && alive(sa)) {
    tags.push({ label: `Group ${m.groupId} decider`, tone: 'hot' });
    score += 42;
  }

  // Must-win — a side whose qualification hangs on this result.
  const mustWin = (s?: { qualificationProbability: number; status: string | null }) =>
    !!s && s.status == null && s.qualificationProbability < 0.45 && s.qualificationProbability > 0.05;
  if (m.stage === 'GROUP' && (mustWin(sh) || mustWin(sa))) {
    const who = mustWin(sh) ? hName : aName;
    tags.push({ label: `${who} must win`, tone: 'hot' });
    score += 24;
  }

  // Too close to call — flat model.
  if (pred) {
    const spread = Math.abs(pred.homeWin - pred.awayWin);
    if (spread < 0.08 && pred.draw < 0.4) {
      tags.push({ label: 'Too close to call', tone: 'mid' });
      score += 16;
    }
  }

  // Giant-killing setup — big gap a favourite could slip on.
  const eloGap = Math.abs((home?.elo ?? 1700) - (away?.elo ?? 1700));
  if (m.stage !== 'GROUP' && eloGap > 160) {
    tags.push({ label: 'Upset on the cards', tone: 'mid' });
    score += 12;
  }

  // Form clash — two sides arriving hot.
  if (prh && pra && prh.momentum > 18 && pra.momentum > 18) {
    tags.push({ label: 'Two in-form sides', tone: 'mid' });
    score += 12;
  }

  // Goals expected.
  if (pred && pred.over25Prob > 0.6) {
    tags.push({ label: 'Goals expected', tone: 'mid' });
    score += 6;
  }

  // Soonest matches edge ahead on ties so the feed feels current.
  const hoursOut = (new Date(m.kickoff).getTime() - Date.parse(eng.generatedAt)) / 3_600_000;
  if (hoursOut >= 0 && hoursOut < 30) score += 8;

  const edgeSide: 'home' | 'away' | 'even' = !pred
    ? 'even'
    : pred.homeWin > pred.awayWin + 0.06
      ? 'home'
      : pred.awayWin > pred.homeWin + 0.06
        ? 'away'
        : 'even';
  const edgeProb = pred ? Math.max(pred.homeWin, pred.awayWin) : 0;

  const kpH = starOf(m.homeTeamId);
  const kpA = starOf(m.awayTeamId);

  const headline = tags[0]?.label ?? (knockout ? 'Knockout tie' : 'Group match');

  // ── Enriched context: tactical contrast, qualification, head-to-head ──────
  const clash = stylesClash(m.homeTeamId, m.awayTeamId);
  if (clash && clash.home !== clash.away) {
    tags.push({ label: 'Styles clash', tone: 'mid' });
    score += 8;
  }
  const tactical = clash?.line;
  const groupRows = eng.standingsByGroup.find((g) => g.some((r) => r.teamId === m.homeTeamId));
  const qualification = m.stage === 'GROUP' && groupRows ? qualScenario(groupRows, m.homeTeamId, m.awayTeamId) ?? undefined : undefined;
  const h2h = h2hSummary(m) ?? undefined;

  // ── Deterministic blurb (Claude-upgradable) ─────────────────────────────
  const pctTxt = (v: number) => `${Math.round(v * 100)}%`;
  const parts: string[] = [];

  if (m.stage === 'GROUP' && m.matchday >= 3 && alive(sh) && alive(sa)) {
    parts.push(`${hName} and ${aName} meet with a place in the knockouts on the line.`);
  } else if (knockout) {
    parts.push(`${hName} face ${aName} in the ${(STAGE_LABEL[m.stage] ?? 'knockouts').toLowerCase()} — win or go home.`);
  } else {
    parts.push(`${hName} take on ${aName}.`);
  }

  if (qualification) parts.push(qualification);

  if (pred) {
    if (edgeSide === 'even') {
      parts.push(`The model can't separate them (${pctTxt(pred.homeWin)} / ${pctTxt(pred.draw)} / ${pctTxt(pred.awayWin)}).`);
    } else {
      const favName = edgeSide === 'home' ? hName : aName;
      parts.push(`The model favours ${favName} at ${pctTxt(edgeProb)}, with ${(pred.expectedGoals.home + pred.expectedGoals.away).toFixed(1)} goals expected.`);
    }
  }

  const formH = formStreak(sh?.form);
  const formA = formStreak(sa?.form);
  if (prh && prh.momentum > 18 && formH) {
    parts.push(`${hName} arrive hot (form ${formH}).`);
  } else if (pra && pra.momentum > 18 && formA) {
    parts.push(`${aName} arrive on a surge (form ${formA}).`);
  }

  if (kpH && kpA) {
    parts.push(`Watch ${kpH.name} against ${kpA.name}.`);
  } else if (kpH || kpA) {
    parts.push(`${(kpH ?? kpA)!.name} is the one to watch.`);
  }

  return {
    matchId: m.id,
    kickoff: m.kickoff,
    stage: m.stage,
    groupId: m.groupId,
    stakesScore: Math.round(score),
    headline,
    tags: tags.slice(0, 3),
    blurb: parts.join(' '),
    edge: { side: edgeSide, prob: edgeProb },
    keyHome: kpH ? { id: kpH.id, name: kpH.name } : null,
    keyAway: kpA ? { id: kpA.id, name: kpA.name } : null,
    qualification,
    tactical,
    h2h,
  };
}

/** The single richest preview for a match (used on the match detail page). */
export function matchPreview(matchId: string): MatchPreview | null {
  const m = getMatch(matchId);
  if (!m || m.status !== 'SCHEDULED') return null;
  if (!getTeam(m.homeTeamId) || !getTeam(m.awayTeamId)) return null; // TBD knockout slot
  return buildPreview(m);
}

/** Ranked "matches that matter" — the upcoming fixtures with the most at stake. */
export function criticalMatches(limit = 4): MatchPreview[] {
  return getMatches()
    .filter((m) => m.status === 'SCHEDULED' && getTeam(m.homeTeamId) && getTeam(m.awayTeamId))
    .map(buildPreview)
    .sort((a, b) => b.stakesScore - a.stakesScore || a.kickoff.localeCompare(b.kickoff))
    .slice(0, limit);
}
