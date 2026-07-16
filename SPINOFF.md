# SPINOFF — One Engine, Two Chassis

_The post-tournament plan: freeze WCI as a finished story, extract the engine into a new
product covering European club football + the Champions League, and keep the tournament
chassis parked for Euro/Copa 2028. Drafted 2026-07-16, three days before the final.
This document is written to be the FIRST PROMPT of the new repo's first Claude Code
session — kickoff-prompt style, self-contained._

---

## 1. The decision

- **WCI retires undefeated.** After the final it becomes a permanent retrospective
  (see §6, the freeze checklist). No renovation into a club app — it's tournament-shaped
  at every level and its completed arc IS the portfolio value.
- **Product #2 is the club app**, not the bettor odds product. The odds product
  (multi-sport, bettor-focused) stays off the critical path; the engine extraction is
  architected so it can serve both later. Odds remain a decoupled, source-selectable
  module (the Betting Edge pattern already proved this).
- **Fork nothing. Harvest organs, leave the body.** New repo, files copied deliberately
  WITH their tests. The one thing explicitly NOT harvested: the single-tournament
  assumption baked into the store/registry/forecast ladder.

## 2. The product

**Working thesis:** one rating universe for European football. Cross-league questions
(is Arsenal better than Bayern? is the Bundesliga's 3rd best side stronger than the
EPL's 6th?) are unanswerable by a league table and vibes-only everywhere else. A shared
ELO space + goal model across the top-5 leagues, calibrated where leagues actually
intersect (UCL/UEL results), with the Champions League as the showcase where the model
gets scored in public every matchday.

- **The leagues are the fuel; the UCL is the showcase.** Top-5 leagues give daily
  fixtures and rating flow (a UCL-only app is dead 3 weeks in 4). UCL pages surface the
  cross-league magic: draw previews, one-table-for-Europe power rankings, league-strength
  deltas.
- **The genuinely new modeling work** (and the next Model Lab centerpiece): the
  league-strength layer — what is a point of Bundesliga ELO worth in EPL terms?
  Cross-competition results (UCL, UEL, Conference) are the connective tissue that
  calibrates the coefficients. First-principles, blog-worthy, and the moat: the
  538-style club-ratings vacancy is real.
- **The trust product carries over:** the track-record/calibration ledger (Brier,
  log-loss, calibration buckets) runs from day one. WCI's receipts are the launch story;
  the club app's receipts are the retention story.

## 3. Organ-harvest inventory (copy WITH tests)

**Models & analytics**
- `src/analytics/poisson.ts` — bivariate Poisson, `expectedGoals` with the WC-087
  venue logic. NOTE: in club football the 1.12/0.94 home multiplier finally earns its
  keep — `hostAdvantageFor` generalizes to "genuine home fixture," which is most of them.
  Carry `poisson.test.ts` (the mirror-symmetry property test especially).
- ELO update machinery + `eloExpectation` (in the engine/simulate modules).
- `src/analytics/simulate.ts` — the Monte Carlo CORE (seeded RNG, tally pattern).
  The bracket walker is tournament-chassis; season-mode re-aims it at "simulate the
  remaining N fixtures of a season" → title %, top-4 %, relegation %, projected points.

**Data layer & scar tissue**
- `src/data/providers/apiFootball.ts` — same provider, same key covers club leagues
  (EPL league=39, etc.). Carry the WC-073 rate-limit backoff, WC-057 stale-live
  force-finish, WC-077 spurious-revert guard, WC-088 stage-mapping order lesson, and
  `apiFootball.test.ts`.
- `src/data/loadTournament.ts` patterns — the live-refresh loop, the WC-086 bracket-gap
  probe generalizes to "new-fixture probe" (club fixtures get postponed/rescheduled
  constantly — this machinery matters MORE at club level).
- Snapshot-identity-keyed indexes (the stale-indexes-cross-module-instance lesson),
  graceful degradation philosophy (hidden-not-zeroed), Upstash last-known-good pattern.

**Trust & AI surfaces**
- `src/server/trackRecord.ts` — Brier/calibration ledger, phase-aware grading.
- `src/ai/narratives.ts` — insight generator ARCHITECTURE (phrasing pools, severity,
  fate clauses). Story kinds get rewritten for club rhythms (title race, relegation
  six-pointers, derby weeks, European qualification math).
- `src/ai/nlq.ts` + the query resolver — the search+NLQ shared-resolver architecture.
- `src/server/deepRounds.ts` concepts → become "the run-in" (title/relegation leverage
  pages: conditional odds if you win tonight).

**UI & process**
- Design system, match cards, team-page anatomy, LiveRefresh polling, LocalTime.
- BUGS.md discipline (start the new repo's tracker at CLUB-001), the verify-header
  culture, hermetic-test-per-fix rule, tsc+build+tests gate.

**Parked, not deleted (tournament chassis — see §5)**
- `src/analytics/knockoutResults.ts` (reconciler + `pendingKnockoutTies`), `teamFate`,
  bracket builder, `roundHistory.ts` (last-four-editions panel), group-stage standings
  logic, the tournament registry pattern.

## 4. Rebuilt fresh (the club domain)

- **Domain model:** Season, Competition (league / cup / UCL league-phase+knockout
  hybrid), multi-competition team membership, home/away legs + aggregate ties,
  promotion/relegation zones, matchweeks, TRANSFER WINDOWS (squads are mutable —
  half of WCI's frozen-squad aggregation assumptions die here; player-team affiliation
  gets validity dates).
- **Storage: Postgres for real.** The in-memory snapshot store is elegant at 48 teams /
  104 matches; 100+ clubs × ~2,000 fixtures/season × mutable squads needs the database
  the Prisma schema always pretended to have. This is also the resume-relevant
  data-platform story (staging → transformed → serving; the GEICO lakehouse shape).
- **Forecast surface:** replace the reach ladder with season markets — win the league,
  top 4, relegation, points distribution, UCL qualification. Monte Carlo over remaining
  fixtures, reconciled against played ones (the WC-082/085 lessons: zero + renormalize +
  recompute deltas TOGETHER).
- **Quota budgeting:** 5 leagues + UCL ≈ 60+ fixtures/week. Snapshot fan-out per league,
  scheduled refresh tiers (live > today > this week > static), DB-backed so restarts
  don't refetch the world.

## 5. The franchise calendar (tournament chassis revivals)

| When | What | Move |
|---|---|---|
| Sept–Nov 2026 | UEFA Nations League league phase | Tournament-mode shakedown cruise inside the club app's international windows |
| Jan 2027 | Asian Cup (KSA) | Optional rep |
| Summer 2027 | AFCON + Gold Cup + **Women's World Cup (Brazil)** | WWC = serious candidate: same shape as WCI, underserved, StatsBomb women's archive already in hand |
| 2027–28 | Euro 2028 qualifying | Ratings never go stale |
| **Summer 2028** | **Euro 2028 (UK/IRL) + Copa América** | **"Euro Intelligence 2028" — the full WCI rerun, two years of engine maturity, audience pre-built** |
| 2029 | FIFA Club World Cup | The club/international bridge, both chassis at once |
| 2030 | World Cup centenary | The franchise's third act |
| **Jan 2027 (decide ~Thanksgiving)** | **NFL playoffs — "NFL Playoffs Intelligence"** | The tournament chassis' US test flight: a 14-team single-elimination bracket IS the parked machinery (seeds, win prob, reach-the-Super-Bowl ladder). 6 weeks, peak US attention, club football's winter lull. Modeling caveat: NO Poisson — ELO + margin model around key numbers (3s/7s); data via free nflverse + API-Sports' American football API. Full-season NFL product deliberately rejected for 2026: 40% engine transfer (vs club's 70%), saturated modeling space (differentiator = the calibration-receipts trust product, not the math), and a Week 1 launch collides with the UCL beat. If January works, NFL becomes the bettor product's first vertical, not a standalone. |

Club season-mode fills the FIFA windows (Sept/Oct/Nov/Mar/Jun) with Nations League +
qualifiers instead of going dark — the two-chassis design turns dead weeks into content.

## 6. WCI freeze checklist (ships the week after the final)

- [ ] Tournament-complete mechanics: champion state everywhere, home page flips to
      retrospective mode, scenarios/Business End final state, storylines epilogue.
- [ ] Stop live polling; final snapshot pinned (Upstash + in-repo cache export).
- [ ] Track record frozen: the Machine vs the Market page becomes the centerpiece
      (feeds the Substack retrospective essay — backlog: time-sensitive).
- [ ] Quant Room: promote the trackRecord/lab pages; idea bank stays a backlog.
- [ ] Cost down: no API spend, cache-served; Render plan reviewed.
- [ ] README epilogue: the arc, the receipts, 88+ logged bugs, link to the spin-off.

## 7. Build plan (post-final)

- **Week of Jul 20:** WCI freeze + Machine vs Market post/essay. New repo scaffolded;
  this document is prompt #1. Postgres schema for the club domain.
- **Weeks 2–3:** organ transplant (files + tests), EPL bootstrap (fixtures, table,
  match model, title/top-4/relegation odds, track record). MVP GUARD: fixtures, table,
  match pages, season odds, receipts page. Nothing else.
- **Week 4 (~Aug 14):** LAUNCH BEAT 1 — EPL opening weekend. "The engine that called
  the World Cup now covers the Premier League."
- **Weeks 5–8:** La Liga / Serie A / Bundesliga / Ligue 1 (config + quota, not code,
  if the domain is right). League-strength calibration layer built and blogged.
- **Mid-September:** LAUNCH BEAT 2 — UCL league phase, matchday one. Cross-league
  ratings meet reality in public; draw-time content.

**Plate check:** Fraud Guard is the committed learning build and the job hunt is live.
The extraction is a 2–4 week solo build BECAUSE the hard parts exist — hold the MVP
line, let the Quant Room backlog stay a backlog, and the two launch beats do the
marketing on their own schedule.

## 8. Open questions (decide at kickoff, not before)

- Name. (Working: "Club Intelligence" / "Football Intelligence" — the WCI brand
  equity says keep the "___ Intelligence" pattern.)
- Repo: fresh public repo (build-in-public continuity) vs private until beat 1.
- Engine as extracted package (`@task/football-engine`) vs shared-by-copy — decide
  when the bettor product becomes real, not before.
- SportMonks re-subscription: only if club xG/pressure data gaps justify it at spin-off
  scale (the €130/mo decision was deferred to exactly this moment; API-Football Pro may
  suffice for MVP).
- Odds: The Odds API + API-Football odds, decoupled module, scoped to a "model vs
  market" page — NOT a betting product yet.
