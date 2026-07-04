import { describe, it, expect } from 'vitest';
import { generateDataset } from '@/data/generate';
import { dataset, getPlayerViews, getTeams, setDataset, getActiveTournamentId } from '@/data/store';
import { engine } from '@/analytics';
import { predictMatch, scoreMatrix } from '@/analytics/poisson';
import { eloExpectation, eloOutcomeProbabilities } from '@/analytics/elo';
import { answerQuery } from '@/ai/nlq';
import { extractTeams } from '@/ai/query/resolver';
import { deriveCleanSheets } from '@/data/providers/frozenOverlay';
import { comebackWins, possessionUpsets, clutchGoals } from '@/analytics/momentum';
import { shouldForceFinish } from '@/data/loadTournament';
import { noteApiRateLimit, apiBackoffActive } from '@/data/providers/apiFootball';
import { smartAnswer } from '@/ai/llmParse';
import { generateInsights, generateMatchSummary, generateScoutingReport, generateDailyBriefing } from '@/ai/narratives';

describe('data generation', () => {
  const ds = generateDataset();

  it('produces 48 teams in 12 groups', () => {
    expect(ds.teams).toHaveLength(48);
    expect(ds.groups).toHaveLength(12);
    ds.groups.forEach((g) => expect(g.teamIds).toHaveLength(4));
  });

  it('produces a 26-man squad per team', () => {
    ds.teams.forEach((t) => {
      const squad = ds.players.filter((p) => p.teamId === t.id);
      expect(squad).toHaveLength(26);
      expect(squad.filter((p) => p.position === 'GK').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('is deterministic across runs', () => {
    const a = generateDataset();
    const b = generateDataset();
    expect(a.teams[0]!.elo).toBe(b.teams[0]!.elo);
    expect(Object.values(a.playerStats).reduce((s, p) => s + p.goals, 0)).toBe(
      Object.values(b.playerStats).reduce((s, p) => s + p.goals, 0),
    );
  });

  it('goals reconcile with scored events', () => {
    const finished = ds.matches.filter((m) => m.status === 'FINISHED');
    expect(finished.length).toBeGreaterThan(0);
    for (const m of finished) {
      const homeGoals = m.events.filter((e) => (e.type === 'GOAL' || e.type === 'PENALTY_GOAL') && e.teamId === m.homeTeamId).length;
      expect(homeGoals).toBe(m.homeScore);
    }
  });

  it('player xG is non-negative and goals never wildly exceed shots', () => {
    Object.values(ds.playerStats).forEach((s) => {
      expect(s.xG).toBeGreaterThanOrEqual(0);
      expect(s.goals).toBeLessThanOrEqual(s.shots + 1);
    });
  });
});

describe('probability models', () => {
  it('score matrix sums to ~1', () => {
    const total = scoreMatrix(1.6, 1.1).flat().reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('match prediction probabilities sum to ~1', () => {
    const teams = getTeams();
    const p = predictMatch(teams[0]!, teams[1]!);
    expect(p.homeWin + p.draw + p.awayWin).toBeCloseTo(1, 2);
    expect(p.expectedGoals.home).toBeGreaterThan(0);
  });

  it('ELO expectation favours the stronger side', () => {
    expect(eloExpectation(2000, 1700, 0)).toBeGreaterThan(0.5);
    const o = eloOutcomeProbabilities(1850, 1850, 0);
    expect(o.win + o.draw + o.loss).toBeCloseTo(1, 3);
  });
});

describe('analytics engine', () => {
  const eng = engine();

  it('every team has a forecast with valid probabilities', () => {
    getTeams().forEach((t) => {
      const f = eng.forecasts.get(t.id)!;
      expect(f).toBeTruthy();
      expect(f.winTitle).toBeGreaterThanOrEqual(0);
      expect(f.winTitle).toBeLessThanOrEqual(1);
      expect(f.reachR16).toBeLessThanOrEqual(f.reachR32 + 1e-9);
    });
  });

  it('title probabilities across all teams sum to ~1', () => {
    const total = [...eng.forecasts.values()].reduce((s, f) => s + f.winTitle, 0);
    expect(total).toBeGreaterThan(0.9);
    expect(total).toBeLessThan(1.1);
  });

  it('produces 12 group tables of 4', () => {
    expect(eng.standingsByGroup).toHaveLength(12);
    eng.standingsByGroup.forEach((g) => expect(g).toHaveLength(4));
  });

  it('produces a 31-node knockout bracket', () => {
    expect(eng.bracket).toHaveLength(31); // 16+8+4+2+1
  });

  it('ranks the power table 1..48', () => {
    expect(eng.powerRankings).toHaveLength(48);
    expect(eng.powerRankings[0]!.rank).toBe(1);
  });

  it('golden boot race ranks by goals actually scored (projection rides alongside)', () => {
    const gb = eng.goldenBoot;
    expect(gb.length).toBeGreaterThan(0);
    expect(gb[0]!.currentGoals).toBeGreaterThanOrEqual(gb[1]!.currentGoals);
  });
});

describe('AI layer', () => {
  it('answers a metric leaderboard query', () => {
    const r = answerQuery('Who has the highest xG among midfielders?');
    expect(r.intent).toBe('leaderboard');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('answers an over-performance query', () => {
    const r = answerQuery('Which teams are outperforming pre-tournament expectations?');
    expect(r.intent).toBe('overperformance');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('answers a breakout query', () => {
    const r = answerQuery('Show under-the-radar breakout players');
    expect(r.intent).toBe('breakout');
  });

  it('answers an easiest-path query', () => {
    const r = answerQuery('Which team has the easiest path to the final?');
    expect(r.intent).toBe('easiest-path');
  });

  it('answers a tactics / playing-style query with a styles board', () => {
    const r = answerQuery('best coaching tactics');
    expect(r.intent).toBe('tactics');
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.columns).toContain('Style');
  });

  it('answers a named-team tactical-identity query', () => {
    const top = engine().powerRankings[0]!;
    const name = getTeams().find((t) => t.id === top.teamId)!.name;
    const r = answerQuery(`${name} playing style`);
    expect(r.intent).toBe('tactics');
    expect(r.entityType).toBe('team');
    expect(r.answer.length).toBeGreaterThan(20);
  });

  it('answers a group-standings query', () => {
    const r = answerQuery('who tops group B');
    expect(r.intent).toBe('group-standings');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('answers a coach query', () => {
    const name = getTeams().find((t) => t.id === engine().powerRankings[0]!.teamId)!.name;
    expect(answerQuery(`who is ${name}'s coach`).intent).toBe('coach');
  });

  it('answers a team comparison', () => {
    const [a, b] = engine().powerRankings.slice(0, 2).map((p) => getTeams().find((t) => t.id === p.teamId)!.name);
    const r = answerQuery(`is ${a} better than ${b}`);
    expect(r.intent).toBe('team-comparison');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('answers a discipline leaderboard and a youngest-player query', () => {
    expect(answerQuery('most yellow cards').intent).toBe('leaderboard');
    expect(answerQuery('youngest player at the tournament').intent).toBe('age');
  });

  it('scopes "most goals" by nationality demonym, not the global golden boot (WC-059)', () => {
    const demo: Record<string, string> = { belgium: 'belgian', spain: 'spanish', brazil: 'brazilian', france: 'french', germany: 'german', argentina: 'argentine', mexico: 'mexican', croatia: 'croatian', england: 'english', portugal: 'portuguese' };
    const team = getTeams().find((t) => demo[t.name.toLowerCase()]);
    if (!team) return; // no demonym-mappable nation in this seed
    const r = answerQuery(`which ${demo[team.name.toLowerCase()]} player has the most goals`);
    expect(r.intent).toBe('leaderboard'); // rerouted from golden-boot by the scope
    for (const row of r.rows) expect(row[2]).toBe(team.code); // every ranked row is that nation
  });

  it('routes a stage-scoped card query to a filtered leaderboard (WC-060)', () => {
    const r = answerQuery('which players got red cards in the round of 16');
    expect(r.intent).toBe('leaderboard');
    expect(r.answer.toLowerCase()).toContain('round of 16'); // stage filter applied, not the global list
  });

  it('team lookup reports knockout status once the KO stage begins, not a stale group standing (WC-062)', () => {
    const [team, opponent] = getTeams();
    const matches = dataset().matches;
    const base = matches.find((m) => m.homeTeamId === team!.id || m.awayTeamId === team!.id)!;
    const synthetic = { ...base, id: 'synthetic-ko', stage: 'R32', status: 'FINISHED', homeTeamId: team!.id, awayTeamId: opponent!.id, homeScore: 2, awayScore: 0, penalties: null };
    matches.push(synthetic as typeof base);
    try {
      const r = answerQuery(team!.name);
      expect(r.answer).not.toContain('Currently'); // group table is history once KO begins
      expect(r.answer).toContain('Finished');
      expect(r.answer.toLowerCase()).toContain('round of 16'); // won the R32 -> through to the R16
    } finally {
      const i = matches.findIndex((m) => m.id === 'synthetic-ko');
      if (i >= 0) matches.splice(i, 1);
    }
  });

  it('answers "team\'s goalkeeper" as a roster-by-position query (WC-063)', () => {
    const team = getTeams().find((t) => getPlayerViews().some((p) => p.teamId === t.id && p.position === 'GK'));
    if (!team) return; // no keeper in seed
    const r = answerQuery(`who is ${team.name}'s goalkeeper`);
    expect(r.intent).toBe('team-position');
    expect(r.answer.toLowerCase()).toContain('goalkeeper');
    // "captain" is not a position — must NOT mis-fire into the position branch
    expect(answerQuery(`who is ${team.name}'s captain`).intent).not.toBe('team-position');
  });

  it('resolves a distinctive single token of a multi-word team name (WC-063)', () => {
    const teams = getTeams();
    const norm = (s: string) => s.toLowerCase();
    const counts = new Map<string, number>();
    for (const t of teams) for (const tok of new Set(norm(t.name).split(/\s+/))) if (tok.length >= 4) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    let hit: { team: (typeof teams)[number]; tok: string } | null = null;
    for (const t of teams) for (const tok of new Set(norm(t.name).split(/\s+/))) if (tok.length >= 4 && counts.get(tok) === 1 && norm(t.name) !== tok) { hit = { team: t, tok }; break; }
    if (!hit) return; // seed has only single-word team names — nothing to test
    expect(extractTeams(hit.tok, 1)[0]?.id).toBe(hit.team.id); // "congo" -> "Congo DR"
  });

  it('routes hardest-path and golden-boot queries correctly (WC-064)', () => {
    expect(answerQuery('easiest path to the final').intent).toBe('easiest-path');
    expect(answerQuery('hardest path to the final').intent).toBe('hardest-path'); // was stolen by the "path"+"final" catch-all
    expect(answerQuery('most likely to win the golden boot').intent).toBe('golden-boot'); // not 'title-odds'
    expect(answerQuery('who will win the world cup').intent).toBe('title-odds'); // control, still the title race
  });

  it('derives keeper clean sheets from shutout results (WC-065)', () => {
    const snap = {
      matches: [
        { status: 'FINISHED', homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 0 }, // A shutout
        { status: 'FINISHED', homeTeamId: 'a', awayTeamId: 'c', homeScore: 1, awayScore: 0 }, // A shutout
        { status: 'FINISHED', homeTeamId: 'a', awayTeamId: 'd', homeScore: 0, awayScore: 1 }, // A conceded
      ],
      players: [{ id: 'gkA', teamId: 'a', position: 'GK' }, { id: 'gkA2', teamId: 'a', position: 'GK' }],
      playerStats: { gkA: { minutes: 270, cleanSheets: 0 }, gkA2: { minutes: 0, cleanSheets: 0 } },
    } as unknown as Parameters<typeof deriveCleanSheets>[0];
    expect(deriveCleanSheets(snap)).toBe(1);
    expect(snap.playerStats.gkA!.cleanSheets).toBe(2); // both shutouts → first-choice keeper
    expect(snap.playerStats.gkA2!.cleanSheets).toBe(0); // backup gets none
  });

  it('routes today/fixture queries and scales attack/defense to 0-100 (WC-065)', () => {
    expect(answerQuery('who plays today').intent).toBe('fixture');
    expect(answerQuery(`does ${getTeams()[0]!.name} play today`).intent).toBe('fixture'); // "play today" now routes
    const r = answerQuery('strongest attack in the tournament');
    expect(r.intent).toBe('best-attack');
    expect(r.rows[0]![1]).toBe(100); // leader rescaled to field-relative 100, not a raw ~34
  });

  it('hides player xG in a lookup when the player has none, shows it when present (WC-066)', () => {
    const noXg = getPlayerViews().find((p) => p.position === 'GK' && p.stats.xG === 0);
    if (noXg) {
      const r = answerQuery(noXg.name);
      if (r.intent === 'player-lookup') {
        expect(r.rows.some((row) => row[0] === 'xG')).toBe(false);
        expect(r.answer).not.toContain('xG');
      }
    }
    const withXg = getPlayerViews().find((p) => p.stats.xG > 0);
    if (withXg) {
      const r = answerQuery(withXg.name);
      if (r.intent === 'player-lookup') expect(r.rows.some((row) => row[0] === 'xG')).toBe(true);
    }
  });

  it('reads group standings present-tense in the group phase, past-tense in the knockouts (WC-067)', () => {
    const before = answerQuery('group A standings');
    if (before.intent !== 'group-standings' || !before.answer.includes('Group A')) return; // no Group A leader in seed
    expect(before.answer).toContain(' top '); // group phase (seed has no KO matches) → present tense
    const matches = dataset().matches;
    const synth = { ...matches[0]!, id: 'synth-ko-2', stage: 'R32', status: 'FINISHED' };
    matches.push(synth as typeof matches[0]);
    try {
      expect(answerQuery('group A standings').answer).toContain(' won '); // once KO begins → past tense
    } finally {
      const i = matches.findIndex((m) => m.id === 'synth-ko-2');
      if (i >= 0) matches.splice(i, 1);
    }
  });

  it('answers comeback and possession-upset momentum queries (WC-068)', () => {
    expect(answerQuery('which teams came from behind to win').intent).toBe('comebacks');
    expect(answerQuery('who won with less possession').intent).toBe('possession-upsets');
    expect(answerQuery('most possession-dominant teams').intent).toBe('tactics'); // not stolen by the upset query

    // Inject an extreme finished match (biggest deficit + lowest possession) so it
    // sorts to rank #1 regardless of what comebacks the seed already contains:
    // home trailed 0-3 at HT, won 4-3, with only 15% of the ball.
    const matches = dataset().matches;
    const [A, B] = getTeams();
    const synth = {
      ...matches[0]!, id: 'synth-cb', stage: 'GROUP', status: 'FINISHED',
      homeTeamId: A!.id, awayTeamId: B!.id, homeScore: 4, awayScore: 3, homeScoreHT: 0, awayScoreHT: 3, events: [],
      teamStats: { [A!.id]: { possession: 15 }, [B!.id]: { possession: 85 } },
    } as unknown as typeof matches[0];
    matches.push(synth);
    try {
      expect(answerQuery('biggest comebacks').rows.some((r) => String(r[0]).includes(A!.name))).toBe(true); // trailed then won
      expect(answerQuery('who won against the run of play').rows.some((r) => String(r[0]).includes(A!.name) && r[2] === '15%')).toBe(true);
    } finally {
      const i = matches.findIndex((m) => m.id === 'synth-cb');
      if (i >= 0) matches.splice(i, 1);
    }
  });

  it('momentum detectors: comeback, possession upset, clutch goal (ENH-5)', () => {
    const m = {
      id: 'x', status: 'FINISHED', stage: 'R32', homeTeamId: 'a', awayTeamId: 'b',
      homeScore: 2, awayScore: 1, homeScoreHT: 0, awayScoreHT: 1,
      teamStats: { a: { possession: 40 }, b: { possession: 60 } },
      events: [
        { type: 'GOAL', minute: 30, teamId: 'b', playerId: 'b-1' },
        { type: 'GOAL', minute: 70, teamId: 'a', playerId: 'a-1' }, // equalise (not late)
        { type: 'GOAL', minute: 88, teamId: 'a', playerId: 'a-2' }, // 88' winner
      ],
    } as unknown as Parameters<typeof clutchGoals>[0][number];
    const cb = comebackWins([m]);
    expect(cb.length).toBe(1); expect(cb[0]!.winnerId).toBe('a'); expect(cb[0]!.deficit).toBe(1);
    const up = possessionUpsets([m]);
    expect(up.length).toBe(1); expect(up[0]!.possession).toBe(40);
    const cl = clutchGoals([m]);
    expect(cl.length).toBe(1); // only the 88' goal is late + decisive
    expect(cl[0]!.minute).toBe(88); expect(cl[0]!.kind).toBe('winner'); expect(cl[0]!.playerId).toBe('a-2');
  });

  it('routes clutch queries and surfaces momentum insight cards (ENH-5)', () => {
    expect(answerQuery('clutch goals').intent).toBe('clutch-goals');
    expect(answerQuery('who scored the latest winners').intent).toBe('clutch-goals');
    const ins = generateInsights(); // seed has event timelines + comebacks
    expect(ins.some((i) => i.kind === 'comeback')).toBe(true);
    expect(ins.some((i) => i.kind === 'clutch')).toBe(true);
  });

  it('daily briefing does not headline a stale (weeks-old) blowout (WC-069)', () => {
    const matches = dataset().matches;
    const [A, B] = getTeams();
    const oldBlowout = {
      ...matches[0]!, id: 'synth-old-rout', status: 'FINISHED', stage: 'GROUP',
      homeTeamId: A!.id, awayTeamId: B!.id, homeScore: 9, awayScore: 0,
      kickoff: '2026-06-01T00:00:00.000Z', events: [],
    } as unknown as typeof matches[0];
    matches.push(oldBlowout);
    try {
      const b = generateDailyBriefing();
      const text = b.headline + b.body + b.bullets.join(' ');
      expect(text).not.toContain('9-0'); // a 3-week-old thrashing must not surface as a "recent" rout/goal-fest
    } finally {
      const i = matches.findIndex((m) => m.id === 'synth-old-rout');
      if (i >= 0) matches.splice(i, 1);
    }
  });

  it('a quota error makes one request and throws — no retry storm (WC-073)', async () => {
    const { fetchApiFootballFixtures, ApiFootballRateLimitError } = await import('@/data/providers/apiFootball');
    let calls = 0;
    const orig = global.fetch;
    global.fetch = (async () => {
      calls++;
      return { status: 200, ok: true, json: async () => ({ response: [], errors: { requests: 'You have reached the request limit for the day' } }) } as unknown as Response;
    }) as typeof fetch;
    try {
      await expect(fetchApiFootballFixtures('k')).rejects.toBeInstanceOf(ApiFootballRateLimitError);
      expect(calls).toBe(1); // was 6 (initial + 5 retries) per endpoint before the fix
    } finally {
      global.fetch = orig;
    }
  });

  it('match summary judges "deserved vs against the run" by the penalty winner (WC-074)', () => {
    const orig = dataset();
    const [A, B] = getTeams();
    // A 1-1, A had more xG (2.0 vs 0.5), but B wins the shootout 5-3.
    const synth = { ...orig.matches[0]!, id: 'synth-pens', status: 'FINISHED', stage: 'R32', homeTeamId: A!.id, awayTeamId: B!.id, homeScore: 1, awayScore: 1, homeScoreHT: 0, awayScoreHT: 1, events: [], penalties: { home: 3, away: 5 }, teamStats: { [A!.id]: { xG: 2.0 }, [B!.id]: { xG: 0.5 } } } as unknown as typeof orig.matches[0];
    // Swap the dataset (new identity) so the memoized match index picks up the tie.
    setDataset({ ...orig, matches: [...orig.matches, synth] }, 'test', getActiveTournamentId());
    try {
      const s = generateMatchSummary('synth-pens');
      expect(s).toContain(`${B!.name} won on penalties`); // shootout winner named
      expect(s).toContain('against the run of expected goals'); // B won despite A's xG edge
      expect(s).not.toContain('the better side won');
      expect(s).not.toContain('goalless affair'); // 1-1 with no scorer data is not "goalless"
    } finally {
      setDataset(orig, 'test', getActiveTournamentId());
    }
  });

  it('rate-limit back-off pauses fetches for a window, then clears (WC-073)', () => {
    const t0 = 1_700_000_000_000;
    noteApiRateLimit(t0);
    expect(apiBackoffActive(t0 + 60_000)).toBe(true); // 1 min after a limit → still backing off
    expect(apiBackoffActive(t0 + 14 * 60_000)).toBe(true); // 14 min → still within the window
    expect(apiBackoffActive(t0 + 16 * 60_000)).toBe(false); // 16 min → window elapsed, re-probe allowed
  });

  it('does not force-finish a live extra-time / penalty match past the window (WC-071)', () => {
    const WINDOW = 210 * 60_000;
    const ko = 1_700_000_000_000;
    const past = ko + WINDOW + 60_000; // a knockout tie deep into pens, past the play window
    // Feed still reports it live → trust it (this was the bug: coerced to a phantom 0-0 FT)
    expect(shouldForceFinish('LIVE', ko, past, 'LIVE', WINDOW)).toBe(false);
    expect(shouldForceFinish('HALFTIME', ko, past, 'HALFTIME', WINDOW)).toBe(false);
    // Feed dropped the match → genuinely stale → force finish
    expect(shouldForceFinish('LIVE', ko, past, undefined, WINDOW)).toBe(true);
    // Feed says finished → leave it to the normal update path
    expect(shouldForceFinish('LIVE', ko, past, 'FINISHED', WINDOW)).toBe(false);
    // Within the window, or already finished → never coerce
    expect(shouldForceFinish('LIVE', ko, ko + 60_000, undefined, WINDOW)).toBe(false);
    expect(shouldForceFinish('FINISHED', ko, past, undefined, WINDOW)).toBe(false);
  });

  it('answers "which X team goes the farthest" and un-inverts expectedFinish (WC-070)', () => {
    expect(answerQuery('which african team goes the farthest').intent).toBe('farthest');
    const g = answerQuery('which team goes the farthest');
    expect(g.intent).toBe('farthest');
    expect(g.rows.length).toBeGreaterThan(0);
    // expectedFinish is a real rank now (1 = best), not the old inverted 49-rank
    // that handed the title favourite a 48th-place "expected finish".
    const e = engine();
    const fav = getTeams().map((t) => ({ t, f: e.forecasts.get(t.id) })).filter((x) => x.f).sort((a, b) => b.f!.winTitle - a.f!.winTitle)[0]!;
    expect(fav.f!.expectedFinish).toBeLessThanOrEqual(10);
  });

  it('smartAnswer without an API key mirrors the deterministic parser (WC-061)', async () => {
    // The LLM translator is a strict upgrade to the fallback: with no key it must
    // be a pure passthrough — happy path untouched, unknowns stay unknown, no throw.
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      for (const q of ['most yellow cards', 'which team has the easiest path to the final', 'blorp zorp nonsense']) {
        expect((await smartAnswer(q)).intent).toBe(answerQuery(q).intent);
      }
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  it('routes a topic it has no data for to a help message, not a wrong page', () => {
    expect(answerQuery('is Mbappe injured').intent).toBe('unsupported');
  });

  it('answers a stat about a specific named player (not a leaderboard)', () => {
    const p = getPlayerViews().filter((x) => x.name.trim().includes(' ') && x.stats.goals > 0).sort((a, b) => b.stats.minutes - a.stats.minutes)[0]!;
    const r = answerQuery(`how many goals has ${p.name} scored`);
    expect(r.intent).toBe('player-stat');
    expect(r.answer).toContain(p.name.split(' ').pop()!);
  });

  it('resolves a bare player name (full + surname) to a player lookup', () => {
    const p = getPlayerViews().filter((x) => x.name.trim().includes(' ')).sort((a, b) => b.stats.minutes - a.stats.minutes)[0]!;
    expect(answerQuery(p.name).intent).toBe('player-lookup'); // full name, e.g. "Lionel Messi"
    const surname = p.name.split(' ').pop()!;
    if (surname.length >= 4) expect(answerQuery(surname).intent).toBe('player-lookup'); // bare surname
  });

  it('generates insights, a match summary and a scouting report', () => {
    expect(generateInsights().length).toBeGreaterThan(0);
    const m = dataset().matches.find((x) => x.status === 'FINISHED')!;
    expect(generateMatchSummary(m.id).length).toBeGreaterThan(20);
    const pv = getPlayerViews().sort((a, b) => b.stats.goals - a.stats.goals)[0]!;
    expect(generateScoutingReport(pv.id).summary.length).toBeGreaterThan(20);
  });
});
