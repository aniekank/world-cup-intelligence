/**
 * Narrative & insight generation.
 *
 * The deterministic generators below mine the analytics snapshot for stories —
 * upsets, over/under-performers, breakout players, form swings, milestones —
 * and produce match summaries, scouting reports, and the daily briefing. They
 * run with zero external dependencies.
 *
 * When ANTHROPIC_API_KEY is set, `narrate()` upgrades any structured payload to
 * Claude-authored prose; otherwise it returns the deterministic draft. This
 * keeps the product fully functional offline while supporting a premium AI tier.
 */

import { getTeams, getTeam, getPlayerViews, getMatch, getMatches, getPlayer, datasetMeta } from '@/data/store';
import { engine } from '@/analytics';
import { criticalMatches } from '@/ai/previews';
import type { Match, PlayerView } from '@/domain/types';
import type { Insight } from '@/domain/types';

const NOW = '2026-06-13T12:00:00.000Z';

// Phrasing pools so insights of the same kind don't read identically (no more
// three teams all "defying the odds"). Picked by index within each kind, so
// every card on a render gets distinct wording. Numbers/claims are unchanged —
// only the words vary.
const pick = <T>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length]!;

const upsetTitles = (w: string, l: string) => [
  `Upset: ${w} stun ${l}`,
  `Shock result: ${w} topple ${l}`,
  `Giant-killing: ${w} take down ${l}`,
  `${w} pull off the upset against ${l}`,
  `Against the odds: ${w} beat ${l}`,
];
const upsetShock = [
  "one of the tournament's biggest shocks",
  "a result almost no model saw coming",
  "one of the standout upsets of the round",
  "a genuine bracket-buster",
];
const overTitles = (t: string) => [
  `${t} defying the odds`,
  `The market underrated ${t}`,
  `${t} are punching above their seeding`,
  `${t} keep outrunning the forecast`,
  `${t} are this tournament's overachievers`,
  `${t} have outgrown their pre-tournament price`,
];
const overOpeners = (t: string, win: string, delta: string) => [
  `${t}'s title probability has climbed to ${win}, up ${delta} on the pre-tournament market.`,
  `The model now gives ${t} ${win} to win it — ${delta} above the opening line.`,
  `Longer odds before kickoff, ${t} have surged to ${win} in the model, a ${delta} jump.`,
  `${t} have outrun their billing: ${win} to lift the trophy, ${delta} clear of the market.`,
];
const overTail = (sf: string) => [
  `They reach the semi-finals in ${sf} of simulations.`,
  `The simulations send them to the last four ${sf} of the time.`,
  `A semi-final place lands in ${sf} of runs.`,
];
const breakoutTitles = (p: string) => [
  `Breakout watch: ${p}`,
  `${p} is announcing himself`,
  `Rising fast: ${p}`,
  `${p} is breaking out`,
  `One to watch: ${p}`,
];
const breakoutOpeners = (p: string, age: number) => [
  `At ${age}, ${p}`,
  `Still only ${age}, ${p}`,
  `${p}, ${age},`,
  `At just ${age}, ${p}`,
];
const formTitles = (t: string) => [
  `${t} are surging`,
  `Momentum is with ${t}`,
  `${t} have the wind behind them`,
  `${t} are peaking at the right time`,
  `${t} are trending up`,
];
const formOpeners = (t: string, m: number) => [
  `${t} carry the tournament's hottest momentum (+${m})`,
  `No side is climbing faster than ${t} (+${m} momentum)`,
  `${t} are riding a wave (+${m} momentum)`,
  `Form is firmly with ${t} (+${m})`,
];
const bootTitles = (v: string) => [
  `${v} leads the Golden Boot race`,
  `${v} is out in front for the Golden Boot`,
  `The Golden Boot runs through ${v}`,
];

export function generateInsights(): Insight[] {
  const insights: Insight[] = [];
  // Never let one bad data edge throw and blank the whole home page — build what
  // we can and serve it (the sections that succeeded). The error is logged so the
  // root cause is visible in the server logs. (WC-040)
  try {
  const eng = engine();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));

  // 1. Upset detection — finished matches where a much weaker side won
  let upsetIdx = 0;
  for (const m of getMatches().filter((x) => x.status === 'FINISHED')) {
    const home = teamMap.get(m.homeTeamId);
    const away = teamMap.get(m.awayTeamId);
    if (!home || !away) continue; // unresolved team — skip
    const eloGap = home.elo - away.elo;
    const homeWon = m.homeScore > m.awayScore;
    const awayWon = m.awayScore > m.homeScore;
    const underdogWon = (awayWon && eloGap > 120) || (homeWon && eloGap < -120);
    if (underdogWon) {
      const winner = homeWon ? home : away;
      const loser = homeWon ? away : home;
      insights.push({
        id: `upset-${m.id}`,
        kind: 'upset',
        severity: Math.abs(eloGap) > 220 ? 'high' : 'medium',
        title: pick(upsetTitles(winner.name, loser.name), upsetIdx),
        body: `${winner.name} beat ${loser.name} ${m.homeScore}-${m.awayScore} despite a ${Math.abs(Math.round(eloGap))}-point ELO deficit — ${pick(upsetShock, upsetIdx)}. xG told a ${
          (m.teamStats[winner.id]?.xG ?? 0) > (m.teamStats[loser.id]?.xG ?? 0) ? 'deserved' : 'smash-and-grab'
        } story.`,
        entityType: 'match',
        entityId: m.id,
        metrics: [
          { label: 'Score', value: `${m.homeScore}-${m.awayScore}` },
          { label: 'ELO gap', value: `${Math.abs(Math.round(eloGap))}` },
          { label: `${winner.code} xG`, value: fmt(m.teamStats[winner.id]?.xG ?? 0) },
        ],
        createdAt: NOW,
      });
      upsetIdx++;
    }
  }

  // 2. Overperformers vs market
  const over = getTeams()
    .map((t) => ({ t, f: eng.forecasts.get(t.id)! }))
    .filter((x) => x.f && x.f.titleProbabilityDelta > 0.01)
    .sort((a, b) => b.f.titleProbabilityDelta - a.f.titleProbabilityDelta)
    .slice(0, 3);
  over.forEach((x, i) => {
    insights.push({
      id: `over-${x.t.id}`,
      kind: 'overperformer',
      severity: 'medium',
      title: pick(overTitles(x.t.name), i),
      body: `${pick(overOpeners(x.t.name, pct(x.f.winTitle), pct(x.f.titleProbabilityDelta)), i)} ${pick(overTail(pct(x.f.reachSF)), i)}`,
      entityType: 'team',
      entityId: x.t.id,
      metrics: [
        { label: 'Title now', value: pct(x.f.winTitle) },
        { label: 'Δ vs market', value: '+' + pct(x.f.titleProbabilityDelta) },
        { label: 'Reach SF', value: pct(x.f.reachSF) },
      ],
      createdAt: NOW,
    });
  });

  // 3. Breakout players
  const breakout = getPlayerViews()
    .filter((p) => p.team && p.age >= 17 && p.age <= 23 && p.position !== 'GK' && p.stats.minutes >= 90)
    .map((p) => ({ p, score: p.stats.goals * 3 + p.stats.assists * 2 + p.stats.xG + p.stats.xA }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  breakout.forEach((x, i) => {
    insights.push({
      id: `breakout-${x.p.id}`,
      kind: 'breakout',
      severity: 'low',
      title: pick(breakoutTitles(x.p.name), i),
      // Market value is only present on the seeded edition; omit the clause on
      // live/historical rather than printing "€0m". (WC-026)
      body: `${pick(breakoutOpeners(x.p.name, x.p.age), i)} has ${x.p.stats.goals}G ${x.p.stats.assists}A for ${x.p.team.name}${x.p.marketValueEur > 0 ? ` on a €${x.p.marketValueEur}m valuation` : ''} — outscoring an xG of ${fmt(x.p.stats.xG)} and sitting in the ${ordinalSafe(x.p.percentiles.xG)} percentile for shot quality.`,
      entityType: 'player',
      entityId: x.p.id,
      metrics: [
        { label: 'Goals', value: String(x.p.stats.goals) },
        { label: 'Age', value: String(x.p.age) },
        { label: 'Form', value: String(x.p.stats.formIndex) },
      ],
      createdAt: NOW,
    });
  });

  // 4. Form / momentum movers
  const movers = [...eng.powerRankings].sort((a, b) => b.momentum - a.momentum).slice(0, 2);
  movers.forEach((r, i) => {
    const t = getTeam(r.teamId);
    if (!t) return; // unresolved team — skip
    insights.push({
      id: `form-${r.teamId}`,
      kind: 'form',
      severity: 'low',
      title: pick(formTitles(t.name), i),
      body: `${pick(formOpeners(t.name, r.momentum), i)}, powered by an offense rated ${r.offenseRating}/100. They sit #${r.rank} in the power rankings.`,
      entityType: 'team',
      entityId: r.teamId,
      metrics: [
        { label: 'Momentum', value: '+' + r.momentum },
        { label: 'Power rank', value: '#' + r.rank },
        { label: 'Offense', value: String(r.offenseRating) },
      ],
      createdAt: NOW,
    });
  });

  // 5. Golden boot milestone
  const gb = eng.goldenBoot[0];
  if (gb) {
    const v = getPlayerViews().find((p) => p.id === gb.playerId);
    if (v) {
      insights.push({
        id: `gb-${v.id}`,
        kind: 'milestone',
        severity: 'medium',
        title: pick(bootTitles(v.name), v.name.length),
        body: `${v.name} tops the scoring charts with ${gb.currentGoals} goals and is projected to finish on ${gb.projectedGoals}, with a ${pct(gb.winProbability)} chance of claiming the Golden Boot.`,
        entityType: 'player',
        entityId: v.id,
        metrics: [
          { label: 'Goals', value: String(gb.currentGoals) },
          { label: 'Projected', value: String(gb.projectedGoals) },
          { label: 'Win Boot', value: pct(gb.winProbability) },
        ],
        createdAt: NOW,
      });
    }
  }

  // 6. The wall — tournament's meanest defense (real results, every source)
  const csByTeam = new Map<string, number>();
  for (const m of getMatches().filter((x) => x.status === 'FINISHED')) {
    if (m.awayScore === 0) csByTeam.set(m.homeTeamId, (csByTeam.get(m.homeTeamId) ?? 0) + 1);
    if (m.homeScore === 0) csByTeam.set(m.awayTeamId, (csByTeam.get(m.awayTeamId) ?? 0) + 1);
  }
  const wall = eng.standingsByGroup
    .flat()
    .filter((s) => s.played > 0)
    .map((s) => ({ s, gpg: s.goalsAgainst / s.played, cs: csByTeam.get(s.teamId) ?? 0 }))
    .sort((a, b) => a.gpg - b.gpg || b.cs - a.cs || a.s.goalsAgainst - b.s.goalsAgainst)[0];
  if (wall) {
    const t = teamMap.get(wall.s.teamId);
    if (t) {
      insights.push({
        id: `wall-${t.id}`,
        kind: 'wall',
        severity: 'medium',
        title: `${t.name}: the tournament's meanest defense`,
        body: `${t.name} have conceded just ${wall.s.goalsAgainst} in ${wall.s.played} ${wall.s.played === 1 ? 'game' : 'games'}${
          wall.cs > 0 ? ` with ${wall.cs} clean sheet${wall.cs > 1 ? 's' : ''}` : ''
        } — ${wall.gpg.toFixed(2)} goals against per game, the stingiest at the tournament.`,
        entityType: 'team',
        entityId: t.id,
        metrics: [
          { label: 'Goals against', value: String(wall.s.goalsAgainst) },
          { label: 'Per game', value: wall.gpg.toFixed(2) },
          { label: 'Clean sheets', value: String(wall.cs) },
        ],
        createdAt: NOW,
      });
    }
  }

  // Regional goal-timing pattern (CIV-1)
  const timing = regionalTimingInsight();
  if (timing) insights.push(timing);

  // Hot scoring streak — record watch
  const streak = scoringStreakInsight();
  if (streak) insights.push(streak);
  } catch (err) {
    console.error('[narratives] generateInsights failed; serving partial insights.', err);
  }

  const order = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** The longest active "scored in consecutive matches" run at the tournament. */
function scoringStreakInsight(): Insight | null {
  const finished = getMatches().filter((m) => m.status === 'FINISHED');
  if (finished.length < 2) return null;
  const pv = new Map(getPlayerViews().map((p) => [p.id, p]));
  const scoredIn = new Map<string, Set<string>>();
  for (const m of finished) {
    for (const e of m.events) {
      if ((e.type === 'GOAL' || e.type === 'PENALTY_GOAL') && e.playerId) {
        let s = scoredIn.get(e.playerId);
        if (!s) { s = new Set(); scoredIn.set(e.playerId, s); }
        s.add(m.id);
      }
    }
  }
  let best: { id: string; name: string; team: string; streak: number; goals: number } | null = null;
  for (const [pid, scored] of scoredIn) {
    const p = pv.get(pid);
    if (!p) continue;
    const teamMatches = finished
      .filter((m) => m.homeTeamId === p.teamId || m.awayTeamId === p.teamId)
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
    let streak = 0;
    for (const m of teamMatches) { if (scored.has(m.id)) streak++; else break; } // consecutive from the most recent game
    if (streak >= 2 && (!best || streak > best.streak || (streak === best.streak && p.stats.goals > best.goals))) {
      best = { id: pid, name: p.name, team: p.team.name, streak, goals: p.stats.goals };
    }
  }
  if (!best) return null;
  return {
    id: `streak-${best.id}`,
    kind: 'milestone',
    severity: 'low',
    title: `${best.name} can't stop scoring`,
    body: `${best.name} has found the net in ${best.streak} straight matches for ${best.team} — the hottest scoring run at the tournament, ${best.goals} goals and counting.`,
    entityType: 'player',
    entityId: best.id,
    metrics: [
      { label: 'Scoring streak', value: `${best.streak} games` },
      { label: 'Goals', value: String(best.goals) },
    ],
    createdAt: NOW,
  };
}

// ── Regional goal-timing insight (CIV-1) ─────────────────────────────────────
// Finds the region with the most concentrated scoring window (which 15-minute
// phase it scores the biggest share of its goals in) — "African sides are
// scoring in the final 15 minutes." Drawn from the match event feed.
const REGION_ADJ: Record<string, string> = {
  UEFA: 'European', CONMEBOL: 'South American', CAF: 'African', AFC: 'Asian', CONCACAF: 'North American', OFC: 'Oceanian',
};
const TIMING_PHASES = [
  'the opening 15 minutes', 'minutes 16–30', 'the run-up to half-time',
  'the hour right after the break', 'minutes 61–75', 'the final 15 minutes',
];
function timingPhase(min: number): number {
  if (min <= 15) return 0; if (min <= 30) return 1; if (min <= 45) return 2;
  if (min <= 60) return 3; if (min <= 75) return 4; return 5;
}

export function regionalTimingInsight(): Insight | null {
  const teamConf = new Map(getTeams().map((t) => [t.id, t.confederation]));
  const byConf = new Map<string, number[]>();
  let totalGoals = 0;
  for (const m of getMatches()) {
    for (const ev of m.events) {
      if (ev.type !== 'GOAL' && ev.type !== 'PENALTY_GOAL') continue;
      const conf = teamConf.get(ev.teamId);
      if (!conf) continue;
      let b = byConf.get(conf);
      if (!b) { b = [0, 0, 0, 0, 0, 0]; byConf.set(conf, b); }
      b[timingPhase(ev.minute)]! += 1;
      totalGoals++;
    }
  }
  if (totalGoals < 20) return null;
  let best: { conf: string; phase: number; share: number; total: number; n: number } | null = null;
  for (const [conf, b] of byConf) {
    const total = b.reduce((a, c) => a + c, 0);
    if (total < 8) continue; // need a real sample to claim a pattern
    for (let p = 0; p < 6; p++) {
      const share = b[p]! / total;
      // Surface the single most concentrated (region, window) — needs a real
      // sample and to sit meaningfully above the 1/6 ≈ 17% uniform baseline.
      if (b[p]! >= 3 && share >= 0.24 && (!best || share > best.share)) best = { conf, phase: p, share, total, n: b[p]! };
    }
  }
  if (!best) return null;
  const adj = REGION_ADJ[best.conf] ?? best.conf;
  const phase = TIMING_PHASES[best.phase]!;
  return {
    id: `region-timing-${best.conf}-${best.phase}`,
    kind: 'tactical',
    severity: 'low',
    title: `${adj} sides come alive in ${phase}`,
    body: `${adj} teams have scored ${best.n} of their ${best.total} goals (${Math.round(best.share * 100)}%) in ${phase} — the most concentrated scoring window of any region at this World Cup.`,
    entityType: 'tournament',
    entityId: null,
    metrics: [
      { label: 'Share in window', value: `${Math.round(best.share * 100)}%` },
      { label: 'Goals in window', value: `${best.n}` },
      { label: 'Region goals', value: `${best.total}` },
    ],
    createdAt: NOW,
  };
}

export function generateMatchSummary(matchId: string): string {
  const m = getMatch(matchId);
  if (!m) return 'Match not found.';
  const home = getTeam(m.homeTeamId);
  const away = getTeam(m.awayTeamId);
  if (!home || !away) return 'Match details are not available yet.';
  const hStat = m.teamStats[home.id];
  const aStat = m.teamStats[away.id];
  if (m.status === 'SCHEDULED') {
    return `${home.name} face ${away.name} at ${m.venue}, ${m.city}. ${home.name} enter rated ${home.attackRating}/100 in attack; ${away.name} counter with a defense rated ${away.defenseRating}/100.`;
  }
  const goals = m.events.filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_GOAL');
  const scorers = goals
    .map((g) => {
      const p = g.playerId ? getPlayer(g.playerId) : null;
      return p ? `${p.name} ${g.minute}'` : '';
    })
    .filter(Boolean)
    .join(', ');

  // In progress: present tense, live clock, and NEVER declare a winner.
  if (m.status === 'LIVE' || m.status === 'HALFTIME') {
    const state =
      m.homeScore > m.awayScore
        ? `${home.name} lead ${m.homeScore}–${m.awayScore}`
        : m.awayScore > m.homeScore
          ? `${away.name} lead ${m.awayScore}–${m.homeScore}`
          : `it's level at ${m.homeScore}–${m.awayScore}`;
    const clock = m.status === 'HALFTIME' ? 'Half-time' : `${m.minute}′`;
    return `Live — ${clock}: ${state} at ${m.venue}.${scorers ? ' Scorers: ' + scorers + '.' : ''}`;
  }

  const result = m.homeScore > m.awayScore ? `${home.name} won` : m.homeScore < m.awayScore ? `${away.name} won` : 'It finished level';
  const xgLine =
    hStat && aStat && (hStat.xG > 0 || aStat.xG > 0)
      ? ` Underlying numbers: ${home.code} ${fmt(hStat.xG)} xG, ${away.code} ${fmt(aStat.xG)} xG${
          (hStat.xG > aStat.xG) === m.homeScore > m.awayScore ? ' — the better side won' : ', against the run of expected goals'
        }.`
      : '';
  // WC-023/WC-027: SportMonks DOES provide team match stats (possession, shots,
  // etc.) via the `statistics` include — the adapter now maps them, so this line
  // lights up on live. Still gate on presence so unplayed/feed-gap matches don't
  // fabricate a flat 50/50.
  const possLine =
    typeof hStat?.possession === 'number'
      ? ` ${home.code} held ${fmt(hStat.possession)}% possession${
          typeof hStat?.fieldTilt === 'number' ? ` with a field tilt of ${fmt(hStat.fieldTilt)}%` : ''
        }.`
      : '';
  return `${result} ${m.homeScore}-${m.awayScore} at ${m.venue}. ${scorers ? 'Scorers: ' + scorers + '.' : 'A goalless affair.'}${xgLine}${possLine}`;
}

export function generateScoutingReport(playerId: string): { summary: string; strengths: string[]; weaknesses: string[] } {
  const p = getPlayerViews().find((v) => v.id === playerId);
  if (!p || !p.team) return { summary: 'Player not found.', strengths: [], weaknesses: [] };
  const pct = p.percentiles;
  const modeled = new Set(datasetMeta().modeledMetrics ?? []);
  const lbl = (base: string, key: string) => (modeled.has(key) ? `${base} (est.)` : base);
  // Only traits the active source actually provides (percentile present) — no
  // false "0th percentile" weaknesses for metrics that aren't in the feed.
  const labelled = (
    [
      { label: 'goal threat (xG)', key: 'xG' },
      { label: 'creativity (xA)', key: 'xA' },
      { label: 'progressive passing', key: 'progressivePasses' },
      { label: 'ball carrying', key: 'progressiveCarries' },
      { label: 'pressing volume', key: 'pressuresApplied' },
      { label: 'tackling', key: 'tackles' },
      { label: 'interceptions', key: 'interceptions' },
      { label: 'shot volume', key: 'shots' },
    ] as { label: string; key: string }[]
  )
    .filter((x) => typeof pct[x.key] === 'number')
    .map((x) => ({ label: lbl(x.label, x.key), v: pct[x.key]! }));
  const strengths = labelled.filter((x) => x.v >= 70).sort((a, b) => b.v - a.v).map((x) => `${cap(x.label)} (${x.v}th pct)`);
  const weaknesses = labelled.filter((x) => x.v <= 35).sort((a, b) => a.v - b.v).map((x) => `${cap(x.label)} (${x.v}th pct)`);
  const agePart = p.age ? `${p.age}, ` : '';
  const clubPart = p.club && p.club !== '—' ? ` (${p.club})` : '';
  const valuePart = p.marketValueEur > 0 ? ` Market value €${p.marketValueEur}m.` : '';
  const summary = `${p.name}, ${agePart}${posFull(p.position)} for ${p.team.name}${clubPart}. ${p.stats.goals}G ${p.stats.assists}A across ${p.stats.minutes} minutes. Profiles as ${
    strengths.length ? 'a specialist in ' + strengths[0]!.toLowerCase() : 'a balanced contributor'
  }.${valuePart}`;
  return {
    summary,
    strengths: strengths.length ? strengths : ['Well-rounded — no standout elite trait yet'],
    weaknesses: weaknesses.length ? weaknesses : ['No glaring weaknesses in the sample'],
  };
}

/** Where the tournament actually is right now, from the fixtures themselves. */
function phaseLabel(scheduled: Match[]): string {
  const groupSched = scheduled.filter((m) => m.stage === 'GROUP');
  if (groupSched.length) {
    const md = Math.min(...groupSched.map((m) => m.matchday));
    return `the group stage (matchday ${md})`;
  }
  const order: [Match['stage'], string][] = [
    ['R32', 'the round of 32'],
    ['R16', 'the round of 16'],
    ['QF', 'the quarter-finals'],
    ['SF', 'the semi-finals'],
    ['THIRD_PLACE', 'the third-place play-off'],
    ['FINAL', 'the final'],
  ];
  for (const [stage, label] of order) if (scheduled.some((m) => m.stage === stage)) return label;
  return 'the closing stages';
}

export function generateDailyBriefing(): { headline: string; body: string; bullets: string[] } {
  const eng = engine();
  const all = getMatches();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  const live = all.filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME');
  const scheduled = all.filter((m) => m.status === 'SCHEDULED');
  const finished = all.filter((m) => m.status === 'FINISHED');

  const ranked = getTeams()
    .map((t) => ({ t, f: eng.forecasts.get(t.id) }))
    .filter((x): x is { t: (typeof x)['t']; f: NonNullable<(typeof x)['f']> } => Boolean(x.f))
    .sort((a, b) => b.f.winTitle - a.f.winTitle);
  const fav = ranked[0];

  // No forecasts yet (data still loading) — return a safe, content-free briefing.
  if (!fav) {
    return {
      headline: 'Tournament data is loading',
      body: `${live.length} matches are live right now. Forecasts populate as soon as the feed is ready.`,
      bullets: [`${live.length} live • ${scheduled.length} still to play`],
    };
  }

  const phase = phaseLabel(scheduled);

  // ── Per-team tallies from finished matches (powers result-based stories) ──
  type Tally = { gf: number; ga: number; pld: number; cs: number };
  const tally = new Map<string, Tally>();
  const bump = (id: string): Tally => {
    let v = tally.get(id);
    if (!v) { v = { gf: 0, ga: 0, pld: 0, cs: 0 }; tally.set(id, v); }
    return v;
  };
  let rout: { margin: number; label: string } | null = null;
  let goalFest: { total: number; label: string } | null = null;
  for (const m of finished) {
    const h = teamMap.get(m.homeTeamId), a = teamMap.get(m.awayTeamId);
    if (!h || !a) continue;
    const th = bump(h.id), ta = bump(a.id);
    th.gf += m.homeScore; th.ga += m.awayScore; th.pld++; if (m.awayScore === 0) th.cs++;
    ta.gf += m.awayScore; ta.ga += m.homeScore; ta.pld++; if (m.homeScore === 0) ta.cs++;
    const margin = Math.abs(m.homeScore - m.awayScore), total = m.homeScore + m.awayScore;
    const hi = Math.max(m.homeScore, m.awayScore), lo = Math.min(m.homeScore, m.awayScore);
    const winner = m.homeScore >= m.awayScore ? h : a, loser = m.homeScore >= m.awayScore ? a : h;
    if (margin >= 2 && (!rout || margin > rout.margin)) rout = { margin, label: `${winner.name} ${hi}-${lo} ${loser.name}` };
    if (total >= 4 && (!goalFest || total > goalFest.total)) goalFest = { total, label: `${h.name} ${m.homeScore}-${m.awayScore} ${a.name}` };
  }

  // ── Story pool: each candidate carries a weight, a badge tag, and an
  // optional prose sentence for the body. The richest signals score highest. ──
  type Story = { w: number; tag: string; sentence?: string };
  const pool: Story[] = [];
  const add = (w: number, tag: string, sentence?: string) => pool.push({ w, tag, sentence });

  const second = ranked[1];
  add(100, `${fav.t.name} — ${pct(fav.f.winTitle)} to win it`,
    `${fav.t.name} remain the model's favourites at ${pct(fav.f.winTitle)} to lift the trophy${second ? `, ${pct(fav.f.winTitle - second.f.winTitle)} clear of ${second.t.name}` : ''}.`);

  if (live.length) add(125, `${live.length} live now`, `${live.length} ${live.length === 1 ? 'match is' : 'matches are'} under way right now.`);

  const insights = generateInsights();
  insights.filter((i) => i.kind === 'upset').slice(0, 2).forEach((u, i) =>
    add(i === 0 ? 95 : 68, u.title.replace(/^Upset:\s*/, ''), i === 0 ? `${u.title}.` : undefined));
  const over = insights.find((i) => i.kind === 'overperformer');
  if (over) add(72, over.title, `${over.title}, climbing the model's board against the pre-tournament market.`);
  const breakout = insights.find((i) => i.kind === 'breakout');
  if (breakout) add(54, breakout.title.replace(/^Breakout watch:\s*/, 'Breakout: '));

  const mom = [...eng.powerRankings].sort((a, b) => b.momentum - a.momentum);
  const riser = mom[0], faller = mom[mom.length - 1];
  if (riser && riser.momentum > 0) {
    const t = teamMap.get(riser.teamId);
    if (t) add(76, `Momentum: ${t.name} surging (+${riser.momentum})`,
      `${t.name} carry the tournament's hottest form — +${riser.momentum} momentum, #${riser.rank} in the power rankings.`);
  }
  if (faller && faller.momentum < 0) {
    const t = teamMap.get(faller.teamId);
    if (t) add(50, `${t.name} cooling off (${faller.momentum})`);
  }

  const gb = eng.goldenBoot[0];
  const gbName = gb ? getPlayerViews().find((p) => p.id === gb.playerId)?.name : null;
  if (gb && gbName) add(80, `Golden Boot: ${gbName} on ${gb.currentGoals}`,
    `${gbName} leads the Golden Boot race on ${gb.currentGoals}, projected to finish on ${gb.projectedGoals}.`);
  else add(38, 'Golden Boot race wide open');

  if (rout) add(78, `Biggest rout: ${rout.label}`, `The most emphatic result so far: ${rout.label}.`);
  if (goalFest && (!rout || goalFest.label !== rout.label)) add(56, `Goal fest: ${goalFest.label} (${goalFest.total})`);

  const tallies = [...tally.entries()]
    .map(([id, v]) => ({ t: teamMap.get(id), ...v }))
    .filter((x): x is { t: NonNullable<typeof x.t> } & Tally => Boolean(x.t) && x.pld > 0);
  const meanest = [...tallies].filter((x) => x.pld >= 2).sort((a, b) => a.ga / a.pld - b.ga / b.pld || b.cs - a.cs)[0];
  if (meanest) add(66, `Meanest defense: ${meanest.t.name} (${(meanest.ga / meanest.pld).toFixed(2)} GA/game)`,
    `${meanest.t.name} own the tournament's meanest defense — ${(meanest.ga / meanest.pld).toFixed(2)} goals conceded a game${meanest.cs > 0 ? `, ${meanest.cs} clean sheet${meanest.cs > 1 ? 's' : ''}` : ''}.`);
  const wall = [...tallies].filter((x) => x.cs > 0).sort((a, b) => b.cs - a.cs || a.ga - b.ga)[0];
  if (wall && wall.cs >= 2 && (!meanest || wall.t.id !== meanest.t.id)) add(50, `${wall.t.name}: ${wall.cs} clean sheets`);
  const sharp = [...tallies].sort((a, b) => b.gf - a.gf)[0];
  if (sharp && sharp.gf >= 5) add(48, `${sharp.t.name} top the scoring (${sharp.gf} goals)`);

  // A pre-tournament heavyweight now at real risk of an early exit.
  const brink = ranked.find((x) => x.f.reachR16 < 0.5 && x.f.titleProbabilityDelta < -0.01 && x.f.winTitle > 0.01);
  if (brink) add(70, `${brink.t.name} on the brink`,
    `${brink.t.name} sit on a knife edge — into the last 16 in only ${pct(brink.f.reachR16)} of simulations.`);

  // Marquee fixtures still to come.
  const crit = criticalMatches(2);
  let marqueeTeams: string | null = null;
  crit.forEach((c, i) => {
    const m = getMatch(c.matchId);
    const h = m ? teamMap.get(m.homeTeamId) : null, a = m ? teamMap.get(m.awayTeamId) : null;
    if (!h || !a) return;
    if (i === 0) marqueeTeams = `${h.name} v ${a.name}`;
    add(i === 0 ? 85 : 60, `Next up: ${h.name} v ${a.name}`,
      i === 0 ? `Looking ahead, ${h.name} v ${a.name} is the pick of what's to come — ${c.headline}.` : undefined);
  });

  add(28, `${finished.length} played • ${live.length} live • ${scheduled.length} to come`);

  // ── Order: anchor the top stories, rotate the rest daily so the briefing
  // feels fresh even when results haven't changed since the last visit. ──
  pool.sort((a, b) => b.w - a.w);
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const anchors = pool.slice(0, 3);
  const rest = pool.slice(3);
  const offset = rest.length ? daySeed % rest.length : 0;
  const rotated = [...rest.slice(offset), ...rest.slice(0, offset)];
  const ordered = [...anchors, ...rotated];

  const topUpset = insights.find((i) => i.kind === 'upset' && i.severity === 'high');
  const headline = live.length
    ? `${live.length} live now — ${fav.t.name} lead through ${phase}`
    : topUpset
      ? topUpset.title
      : marqueeTeams
        ? `${marqueeTeams} headlines ${phase}`
        : `${fav.t.name} lead the title race through ${phase}`;

  const body = ordered.filter((s) => s.sentence).slice(0, 4).map((s) => s.sentence).join(' ');

  const bullets: string[] = [];
  for (const s of ordered) {
    if (!bullets.includes(s.tag)) bullets.push(s.tag);
    if (bullets.length >= 7) break;
  }

  return { headline, body, bullets };
}

// ── Briefing deck ────────────────────────────────────────────────────────────
// The single daily briefing collapses every signal into one paragraph. The deck
// keeps them as separate, self-contained cards — title race, live recaps, recent
// results, golden boot, the meanest defense, marquee fixtures — so the home hero
// can rotate through deeper stories instead of showing one static blurb.

export interface BriefingCard {
  id: string;
  kicker: string;
  headline: string;
  body: string;
  tags: string[];
  accent?: string;
}

export function generateBriefingDeck(): BriefingCard[] {
  const eng = engine();
  const all = getMatches();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  const live = all.filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME');
  const scheduled = all.filter((m) => m.status === 'SCHEDULED');
  const finished = all.filter((m) => m.status === 'FINISHED');
  const cards: BriefingCard[] = [];
  const usedMatch = new Set<string>();

  // 1) Overview — the merged daily briefing leads the deck.
  const brief = generateDailyBriefing();
  cards.push({
    id: 'overview',
    kicker: 'Daily Briefing',
    headline: brief.headline,
    body: brief.body || `${finished.length} played, ${live.length} live, ${scheduled.length} still to come.`,
    tags: brief.bullets.slice(0, 4),
    accent: '#22e0d0',
  });

  const ranked = getTeams()
    .map((t) => ({ t, f: eng.forecasts.get(t.id) }))
    .filter((x): x is { t: (typeof x)['t']; f: NonNullable<(typeof x)['f']> } => Boolean(x.f))
    .sort((a, b) => b.f.winTitle - a.f.winTitle);

  // 2) Title race.
  const fav = ranked[0], second = ranked[1], third = ranked[2];
  if (fav) {
    cards.push({
      id: 'title-race',
      kicker: 'Title Race',
      headline: `${fav.t.name} lead at ${pct(fav.f.winTitle)} to win it`,
      body: `The Monte Carlo makes ${fav.t.name} the favourites at ${pct(fav.f.winTitle)} to lift the trophy${second ? `, ${pct(fav.f.winTitle - second.f.winTitle)} clear of ${second.t.name} on ${pct(second.f.winTitle)}` : ''}${third ? `, with ${third.t.name} third at ${pct(third.f.winTitle)}` : ''}. Drawn from 8,000 tournament simulations.`,
      tags: ranked.slice(0, 3).map((r) => `${r.t.flag} ${r.t.name} ${pct(r.f.winTitle)}`),
      accent: '#1fe5c4',
    });
  }

  // 3) Live now — one recap per match in progress.
  for (const m of live.slice(0, 3)) {
    const h = teamMap.get(m.homeTeamId), a = teamMap.get(m.awayTeamId);
    if (!h || !a) continue;
    usedMatch.add(m.id);
    cards.push({
      id: `live-${m.id}`,
      kicker: 'Live Now',
      headline: `${h.name} ${m.homeScore}–${m.awayScore} ${a.name}`,
      body: generateMatchSummary(m.id),
      tags: [m.status === 'HALFTIME' ? 'Half-time' : `${m.minute}′`, `${h.code} v ${a.code}`],
      accent: '#ff2e9a',
    });
  }

  // 4) Recent results — recaps for the latest finished fixtures.
  const recent = [...finished].sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 3);
  for (const m of recent) {
    const h = teamMap.get(m.homeTeamId), a = teamMap.get(m.awayTeamId);
    if (!h || !a) continue;
    usedMatch.add(m.id);
    cards.push({
      id: `recap-${m.id}`,
      kicker: 'Result',
      headline: `${h.name} ${m.homeScore}–${m.awayScore} ${a.name}`,
      body: generateMatchSummary(m.id),
      tags: [`${h.code} ${m.homeScore}-${m.awayScore} ${a.code}`, m.city].filter(Boolean) as string[],
    });
  }

  // 5) Golden Boot.
  const gb = eng.goldenBoot[0];
  const gbV = gb ? getPlayerViews().find((p) => p.id === gb.playerId) : null;
  if (gb && gbV) {
    cards.push({
      id: 'golden-boot',
      kicker: 'Golden Boot',
      headline: `${gbV.name} leads on ${gb.currentGoals}`,
      body: `${gbV.name} (${gbV.team.name}) tops the scoring chart on ${gb.currentGoals} goal${gb.currentGoals === 1 ? '' : 's'}, with the model projecting ${gb.projectedGoals} by the final${gbV.stats.xG ? ` — backed by ${gbV.stats.xG.toFixed(1)} expected goals` : ''}.`,
      tags: eng.goldenBoot.slice(0, 3)
        .map((g) => { const v = getPlayerViews().find((p) => p.id === g.playerId); return v ? `${v.name} ${g.currentGoals}` : null; })
        .filter(Boolean) as string[],
      accent: '#ff8a1e',
    });
  }

  // 6) Momentum.
  const riser = [...eng.powerRankings].sort((a, b) => b.momentum - a.momentum)[0];
  if (riser && riser.momentum > 0) {
    const t = teamMap.get(riser.teamId);
    if (t) cards.push({
      id: 'momentum',
      kicker: 'Momentum',
      headline: `${t.name} are surging (+${riser.momentum})`,
      body: `${t.name} carry the tournament's hottest form — +${riser.momentum} momentum and up to #${riser.rank} in the power rankings.`,
      tags: [`#${riser.rank} power`, `+${riser.momentum} momentum`],
      accent: '#1fe5c4',
    });
  }

  // 7) Results-derived: meanest defense + biggest rout.
  type Tally = { ga: number; pld: number; cs: number };
  const tally = new Map<string, Tally>();
  const bump = (id: string): Tally => { let v = tally.get(id); if (!v) { v = { ga: 0, pld: 0, cs: 0 }; tally.set(id, v); } return v; };
  let rout: { margin: number; m: Match } | null = null;
  for (const m of finished) {
    const h = teamMap.get(m.homeTeamId), a = teamMap.get(m.awayTeamId);
    if (!h || !a) continue;
    const th = bump(h.id), ta = bump(a.id);
    th.ga += m.awayScore; th.pld++; if (m.awayScore === 0) th.cs++;
    ta.ga += m.homeScore; ta.pld++; if (m.homeScore === 0) ta.cs++;
    const margin = Math.abs(m.homeScore - m.awayScore);
    if (margin >= 2 && (!rout || margin > rout.margin)) rout = { margin, m };
  }
  const tallies = [...tally.entries()]
    .map(([id, v]) => ({ t: teamMap.get(id), ...v }))
    .filter((x): x is { t: NonNullable<typeof x.t> } & Tally => Boolean(x.t) && x.pld >= 2);
  const meanest = [...tallies].sort((a, b) => a.ga / a.pld - b.ga / b.pld || b.cs - a.cs)[0];
  if (meanest) cards.push({
    id: 'defense',
    kicker: 'The Wall',
    headline: `${meanest.t.name} concede just ${(meanest.ga / meanest.pld).toFixed(2)} a game`,
    body: `${meanest.t.name} own the tournament's meanest defense — ${(meanest.ga / meanest.pld).toFixed(2)} goals conceded per game across ${meanest.pld} played${meanest.cs > 0 ? `, with ${meanest.cs} clean sheet${meanest.cs > 1 ? 's' : ''}` : ''}.`,
    tags: [`${(meanest.ga / meanest.pld).toFixed(2)} GA/game`, `${meanest.cs} clean sheet${meanest.cs === 1 ? '' : 's'}`],
    accent: '#8b5cf6',
  });
  if (rout && !usedMatch.has(rout.m.id)) {
    const h = teamMap.get(rout.m.homeTeamId), a = teamMap.get(rout.m.awayTeamId);
    if (h && a) {
      usedMatch.add(rout.m.id);
      cards.push({
        id: 'rout',
        kicker: 'Statement Win',
        headline: `${h.name} ${rout.m.homeScore}–${rout.m.awayScore} ${a.name}`,
        body: generateMatchSummary(rout.m.id),
        tags: [`${rout.margin}-goal margin`],
        accent: '#ff8a1e',
      });
    }
  }

  // 8) Upset + breakout from the insight engine.
  const ins = generateInsights();
  const upset = ins.find((i) => i.kind === 'upset');
  if (upset) cards.push({ id: 'upset', kicker: 'Upset', headline: upset.title.replace(/^Upset:\s*/, ''), body: upset.body, tags: [`${upset.severity} signal`], accent: '#ff2e9a' });
  const breakout = ins.find((i) => i.kind === 'breakout');
  if (breakout) cards.push({ id: 'breakout', kicker: 'Breakout', headline: breakout.title.replace(/^Breakout watch:\s*/, ''), body: breakout.body, tags: [], accent: '#22e0d0' });
  const timing = ins.find((i) => i.id.startsWith('region-timing-'));
  if (timing) cards.push({ id: 'region-timing', kicker: 'Around the World', headline: timing.title, body: timing.body, tags: timing.metrics.slice(0, 2).map((m) => `${m.label} ${m.value}`), accent: '#8b5cf6' });

  // 9) Marquee fixtures still to come.
  for (const c of criticalMatches(2)) {
    if (usedMatch.has(c.matchId)) continue;
    const m = getMatch(c.matchId);
    if (!m) continue;
    const h = teamMap.get(m.homeTeamId), a = teamMap.get(m.awayTeamId);
    if (!h || !a) continue;
    usedMatch.add(c.matchId);
    cards.push({
      id: `next-${c.matchId}`,
      kicker: 'Next Up',
      headline: `${h.name} v ${a.name}`,
      body: c.blurb || c.headline,
      tags: [c.headline].filter(Boolean),
      accent: '#1fe5c4',
    });
  }

  return cards.filter((c) => c.body && c.body.trim().length > 0);
}

/**
 * Upgrade a structured payload to Claude-authored prose when an API key is set.
 * Returns the deterministic fallback otherwise. (Network call intentionally
 * lazy so the app never requires connectivity.)
 */
export async function narrate(systemPrompt: string, payload: unknown, fallback: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Data:\n${JSON.stringify(payload)}\n\nWrite the narrative.` }],
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { content?: { text?: string }[] };
    return json.content?.[0]?.text ?? fallback;
  } catch {
    return fallback;
  }
}

// helpers
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const posFullMap: Record<string, string> = { GK: 'goalkeeper', DF: 'defender', MF: 'midfielder', FW: 'forward' };
const posFull = (p: string) => posFullMap[p] ?? p;
const ordinalSafe = (n: number | undefined) => (n == null ? '—' : `${n}th`);

// ─────────────────────────────────────────────────────────────
// Storylines — editorial "ones to watch" for players & squads.
// Data-driven and source-robust: leans on whatever signal exists
// (goals/xG/form for rich data; team strength & projections early).
// ─────────────────────────────────────────────────────────────

export interface Storyline {
  id: string;
  archetype: string;
  tag: string;
  title: string;
  subtitle: string;
  blurb: string;
  entityType: 'player' | 'team';
  entityId: string;
  photo?: string; // real head-shot for player storylines (live data)
  metrics: { label: string; value: string }[];
  accent: 'accent' | 'magenta' | 'amber' | 'violet' | 'cyan' | 'lime';
}

function watchability(p: PlayerView): number {
  const s = p.stats;
  return (
    s.goals * 4 + s.assists * 2.5 + s.xG * 1.5 + s.xA * 1.5 + s.keyPasses * 0.25 +
    (s.formIndex - 50) * 0.08 + (p.rating.overall - 75) * 0.4 + (s.saves * 0.3)
  );
}

type ArchKey = 'marksman' | 'creator' | 'breakout' | 'inform' | 'keeper' | 'key';

function archetypeStory(p: PlayerView, key: ArchKey): { archetype: string; tag: string; accent: Storyline['accent']; blurb: string } {
  const s = p.stats;
  const team = p.team.name;
  const last = p.name.split(' ').slice(-1)[0];
  // Only reference xG when the feed actually provides it (API-Football early = no xG)
  const finishing = s.xG <= 0 ? '' : s.goals - s.xG >= 0.6 ? ` — finishing well above an xG of ${fmt(s.xG)}` : s.xG >= 1 ? `, underpinned by ${fmt(s.xG)} xG` : '';
  switch (key) {
    case 'keeper':
      return { archetype: 'wall', tag: 'The Last Line', accent: 'cyan', blurb: `${p.name} has been ${team}'s wall — ${s.saves} saves and ${s.cleanSheets} clean sheet${s.cleanSheets === 1 ? '' : 's'} keeping them in the hunt. Knockout football turns on goalkeepers like this.` };
    case 'breakout':
      return { archetype: 'breakout', tag: 'Breakout Star', accent: 'violet', blurb: `At just ${p.age}, ${p.name} is the breakout name for ${team} — ${s.goals}G ${s.assists}A already, sitting in the ${ordinalSafe(p.percentiles.xG)} percentile of ${posFull(p.position)}s for shot quality. A tournament can make a career.` };
    case 'creator':
      return { archetype: 'creator', tag: 'Creator-in-Chief', accent: 'amber', blurb: `${p.name} is ${team}'s creative engine — ${s.assists} assist${s.assists === 1 ? '' : 's'}, ${fmt(s.xA)} xA and ${s.keyPasses} key passes. Everything good runs through ${last}.` };
    case 'inform':
      return { archetype: 'inform', tag: 'In Form', accent: 'lime', blurb: `Nobody at ${team} is hotter than ${p.name} right now — a ${s.formIndex} form index across ${s.minutes} minutes. Catch them while they're flying.` };
    case 'marksman':
      return { archetype: 'marksman', tag: 'Golden Boot Race', accent: 'accent', blurb: `${p.name} is ${team}'s sharpest weapon and live in the Golden Boot race with ${s.goals} goal${s.goals === 1 ? '' : 's'}${finishing}. When chances fall, ${last} buries them.` };
    default:
      return { archetype: 'key', tag: 'Key Player', accent: 'magenta', blurb: `${p.name} is central to how ${team} play — ${s.goals}G ${s.assists}A in ${s.minutes} minutes and a fixture in the side. One to keep an eye on.` };
  }
}

export function playersToWatch(limit = 6): Storyline[] {
  const eng = engine();
  const bootRank = new Map(eng.goldenBoot.map((g, i) => [g.playerId, i]));
  const views = getPlayerViews().filter((p) => p.team && p.stats.minutes > 0);
  const creatorScore = (p: PlayerView) => p.stats.assists * 2 + p.stats.xA + p.stats.keyPasses * 0.25;

  // One ranked candidate list per archetype, best-first.
  const buckets: { key: ArchKey; list: PlayerView[] }[] = [
    { key: 'marksman', list: views.filter((p) => p.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals || watchability(b) - watchability(a)) },
    { key: 'creator', list: views.filter((p) => p.stats.assists > 0 || p.stats.xA >= 0.6 || p.stats.keyPasses >= 4).sort((a, b) => creatorScore(b) - creatorScore(a)) },
    { key: 'breakout', list: views.filter((p) => p.age >= 17 && p.age <= 22 && p.stats.goals + p.stats.assists > 0).sort((a, b) => watchability(b) - watchability(a)) },
    { key: 'keeper', list: views.filter((p) => p.position === 'GK' && p.stats.saves >= 4).sort((a, b) => b.stats.saves - a.stats.saves) },
    { key: 'inform', list: views.filter((p) => p.stats.minutes >= 90).sort((a, b) => b.stats.formIndex - a.stats.formIndex) },
  ];

  const out: Storyline[] = [];
  const usedTeams = new Set<string>();
  const usedPlayers = new Set<string>();
  const add = (p: PlayerView, key: ArchKey) => {
    const hook = archetypeStory(p, key);
    out.push({
      id: `pw-${p.id}`, archetype: hook.archetype, tag: hook.tag, title: p.name,
      subtitle: `${posFull(p.position).replace(/^./, (c) => c.toUpperCase())} · ${p.team.name}`,
      blurb: hook.blurb, entityType: 'player', entityId: p.id, photo: p.photo,
      metrics: [
        { label: 'Goals', value: String(p.stats.goals) },
        { label: 'Assists', value: String(p.stats.assists) },
        { label: 'xG+xA', value: fmt(p.stats.xG + p.stats.xA) },
        ...(bootRank.has(p.id) ? [{ label: 'Boot rank', value: `#${(bootRank.get(p.id) ?? 0) + 1}` }] : [{ label: 'Form', value: String(p.stats.formIndex) }]),
      ],
      accent: hook.accent,
    });
    usedPlayers.add(p.id);
    usedTeams.add(p.teamId);
  };

  // Round-robin the buckets so archetypes vary; one star per team.
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const b of buckets) {
      if (out.length >= limit) break;
      const pick = b.list.find((p) => !usedPlayers.has(p.id) && !usedTeams.has(p.teamId));
      if (pick) { add(pick, b.key); progressed = true; }
    }
  }
  // Backfill any remaining slots from raw watchability (still one per team).
  if (out.length < limit) {
    for (const p of [...views].sort((a, b) => watchability(b) - watchability(a))) {
      if (out.length >= limit) break;
      if (usedPlayers.has(p.id) || usedTeams.has(p.teamId)) continue;
      add(p, 'key');
    }
  }
  return out;
}

export function squadsToWatch(limit = 5): Storyline[] {
  const eng = engine();
  const fc = eng.forecasts;
  const prMap = new Map(eng.powerRankings.map((r) => [r.teamId, r]));
  const teams = getTeams().filter((t) => fc.get(t.id));

  const out: Storyline[] = [];
  const used = new Set<string>();
  const firstUnused = (ids: string[]) => ids.find((id) => !used.has(id));
  const push = (teamId: string, archetype: string, tag: string, accent: Storyline['accent'], blurb: string, metrics: { label: string; value: string }[]) => {
    const t = getTeam(teamId)!;
    out.push({ id: `sw-${teamId}`, archetype, tag, title: `${t.flag} ${t.name}`, subtitle: `${t.confederation}${t.groupId ? ` · Group ${t.groupId}` : ''}`, blurb, entityType: 'team', entityId: teamId, metrics, accent });
    used.add(teamId);
  };

  // Pre-sort candidate lists; each archetype claims the best team not already used.
  const byTitle = [...teams].sort((a, b) => (fc.get(b.id)!.winTitle) - (fc.get(a.id)!.winTitle)).map((t) => t.id);
  const byOffense = [...eng.powerRankings].sort((a, b) => b.offenseRating - a.offenseRating).map((r) => r.teamId);
  const byDefense = [...eng.powerRankings].sort((a, b) => b.defenseRating - a.defenseRating).map((r) => r.teamId);
  const top3 = new Set(byTitle.slice(0, 3));
  const byMomentum = [...eng.powerRankings].filter((r) => !top3.has(r.teamId)).sort((a, b) => b.momentum - a.momentum).map((r) => r.teamId);
  const byDelta = [...teams].filter((t) => fc.get(t.id)!.titleProbabilityDelta > 0.003).sort((a, b) => fc.get(b.id)!.titleProbabilityDelta - fc.get(a.id)!.titleProbabilityDelta).map((t) => t.id);

  const fav = firstUnused(byTitle);
  if (fav) { const f = fc.get(fav)!; const pr = prMap.get(fav); push(fav, 'favourite', 'The Favourites', 'accent', `${getTeam(fav)!.name} sit top of the model's board at ${pct(f.winTitle)} to lift the trophy, reaching the semi-finals in ${pct(f.reachSF)} of simulations. The team everyone else is measured against.`, [{ label: 'Win title', value: pct(f.winTitle) }, { label: 'Reach SF', value: pct(f.reachSF) }, { label: 'Power', value: String(pr?.powerRating ?? '—') }]); }

  const sur = firstUnused(byDelta);
  if (sur) { const f = fc.get(sur)!; push(sur, 'surprise', 'Surprise Package', 'magenta', `Nobody has outrun their billing like ${getTeam(sur)!.name} — title odds up ${pct(f.titleProbabilityDelta)} on the pre-tournament market. The bracket's wildcard.`, [{ label: 'Now', value: pct(f.winTitle) }, { label: 'Δ vs market', value: '+' + pct(f.titleProbabilityDelta) }, { label: 'Reach QF', value: pct(f.reachQF) }]); }

  const dark = firstUnused(byMomentum);
  if (dark) { const pr = prMap.get(dark)!; const f = fc.get(dark)!; push(dark, 'darkhorse', 'Dark Horse', 'violet', `${getTeam(dark)!.name} are the dark horse — strong momentum (${pr.momentum > 0 ? '+' : ''}${pr.momentum}) and a #${pr.rank} power ranking hint at a run nobody's pricing in.`, [{ label: 'Momentum', value: `${pr.momentum > 0 ? '+' : ''}${pr.momentum}` }, { label: 'Power rank', value: `#${pr.rank}` }, { label: 'Reach QF', value: pct(f.reachQF) }]); }

  const atk = firstUnused(byOffense);
  if (atk) { const pr = prMap.get(atk)!; push(atk, 'firepower', 'Firepower', 'amber', `${getTeam(atk)!.name} carry one of the tournament's most dangerous attacks, rated ${pr.offenseRating}/100. Box-office viewing going forward.`, [{ label: 'Offense', value: String(pr.offenseRating) }, { label: 'Defense', value: String(pr.defenseRating) }, { label: 'Momentum', value: `${pr.momentum > 0 ? '+' : ''}${pr.momentum}` }]); }

  const def = firstUnused(byDefense);
  if (def) { const pr = prMap.get(def)!; push(def, 'fortress', 'The Fortress', 'cyan', `${getTeam(def)!.name} are built on one of the meanest defenses in the field (${pr.defenseRating}/100) — the profile of a side that grinds out a deep run.`, [{ label: 'Defense', value: String(pr.defenseRating) }, { label: 'Offense', value: String(pr.offenseRating) }, { label: 'Power', value: String(pr.powerRating) }]); }

  return out.slice(0, limit);
}

export function storylines() {
  return { players: playersToWatch(6), squads: squadsToWatch(5) };
}
