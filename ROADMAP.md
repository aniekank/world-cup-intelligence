# Roadmap — World Cup Intelligence

Proposed features and enhancements, so good ideas don't get buried under bug-fixing.
Companion to `BUGS.md` (which tracks defects). Updated as items ship.

**Last updated:** 2026-06-21

**Status:** ✅ Shipped · 🔨 Building now · 📋 Proposed · 🧊 Deferred (revisit later)

---

## 0. Model Lab — interactive DS/ML showcase (`/lab`)
*Surfaces the engine's math as manipulable visuals — the portfolio centrepiece. Every visual recomputes live in the browser from real data; the numerical kernels (`src/lib/labMath.ts`) are written from first principles, no charting/ML deps.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Bivariate-Poisson score heatmap** | Drag the two λ (expected-goals) sliders + the correlation term and the full joint scoreline grid + win/draw/loss / BTTS / over-2.5 recompute. Load any real fixture as a preset. (`PoissonHeatmap`) |
| ✅ | **Monte Carlo what-if simulator** | Override a team's attack/defense/ELO → the real 3,000-run engine re-simulates the rest of the tournament server-side (`/api/lab/simulate`, ~80ms warm) and the survival funnel + title-odds leaderboard react. (`MonteCarloSimulator`) |
| ✅ | **Team embedding (PCA + k-means)** | 48 teams × 8 style metrics → 2D via in-browser covariance eigendecomposition (power iteration); k-means clusters; toggle metrics / k and it re-projects live. Shows explained variance + loadings. (`TeamEmbedding`, `pca`/`kmeans` in labMath) |
| ✅ | **Calibration lab** | Reliability diagram + Murphy Brier decomposition (reliability − resolution + uncertainty) over every finished match; adjustable bins + one-vs-rest class filter. (`CalibrationLab`) |
| ✅ | **Prediction explainer (Shapley)** | Exact Shapley attribution of a single match's P(home win) across home advantage + both sides' attack/defense, as a waterfall from neutral baseline to model output. (`PredictionExplainer`, `shapleyContributions`) |
| ✅ | **Monte Carlo convergence** (LAB-1) | Samples scorelines batch-by-batch and animates the running win/draw/loss estimate converging to the exact bivariate-Poisson answer, with a ±2 s.e. band (∝ 1/√n) — the law of large numbers, watched live. (`MonteCarloConvergence`) |
| ✅ | **Feature-correlation + residual matrix** (LAB-2) | In-browser Pearson correlation matrix across the team-style metrics, plus a predicted-vs-actual goals residual scatter with MAE + bias. (`FeatureRelationships`, `correlationMatrix`) |
| ✅ | **Live win-probability timeline** (LAB-3) | Per-match win-prob rebuilt minute-by-minute from the event feed (538-style stacked bands), goals swinging it and red cards bending it, hover to scrub. (`WinProbabilityTimeline`, `winProbFromState`) |

---

## 1. Narrative & editorial intelligence
*Make the metrics tell stories, not just report numbers. This is the active theme.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Critical-match stakes engine** | Every upcoming fixture analyzed for what's at stake (group decider, must-win, knockout, heavyweight clash, too-close-to-call, upset-on, in-form clash, goals expected), scored + ranked, key player named per side, model edge + form read, grounded preview blurb. (`src/ai/previews.ts`) |
| ✅ | **"Matches that matter" feed** | Home panel ranking upcoming fixtures by stakes, not just time. |
| ✅ | **"What's at stake" match previews** | Rich preview on every scheduled match page (replaces the thin one-liner). |
| ✅ | **Dynamic daily briefing** | Was frozen on "group stage climax"; now derives the real phase from fixtures, leads with the marquee match, reflects live state + momentum + golden boot. |
| ✅ | **Rotating briefing deck** (BRIEF-2) | The home hero is now a deck that cycles a different story every 8s — title race, live recaps (with scorers, never declaring a live winner), recent-result recaps with xG context, golden boot, momentum, the meanest defense, biggest rout, upset, breakout, marquee fixtures. Progress bar + dot nav + prev/next + hover-pause + play/pause; auto-rotation off under reduced-motion. (`generateBriefingDeck` in `src/ai/narratives.ts`, `src/components/home/BriefingDeck.tsx`) |
| 🔨 | **Manager stories** | Tactical identity from the team's offense/defense/possession profile + over/under-achievement vs the pre-tournament market. *Installment 2.* |
| 🔨 | **Elite player form arcs** | Scoring streaks, involvement trending up/down, over/under-xG, milestone watches — built on the live event timelines. *Installment 2.* |
| 📋 | **Claude-authored prose** | Wire the existing `narrate()` hook across briefing, previews, and stories so grounded structured output becomes genuinely editorial prose. Activates by setting `ANTHROPIC_API_KEY` in Render; deterministic stays the fallback. *Installment 3.* |
| ✅ | **Match-preview enrichment** (PREV-1) | Upcoming-match previews now fold in three layers: **qualification scenarios** ("X must win to survive; Y are through with a draw or better" — sound final-round group maths), the **tactical matchup** (styles contrast + real formations, e.g. "4-4-2 v 4-2-3-1"), and **head-to-head** history (real cross-tournament meetings via the SportMonks H2H endpoint, fetched off the boot path). Surfaced on the home "matches that matter" cards and the match page. (`src/ai/previews.ts` · `sportmonks.ts` attachHeadToHead) |
| 📋 | **Bracket knock-on analysis** | "If Brazil win this, Argentina's path to the final hardens" — downstream effects of a result. |
| 📋 | **Milestone / record watch** | Players within reach of tournament records (goals, assists, clean sheets). |

## 1b. Clash of the Civilizations — regional lens (`/civilizations`)
*How every part of the world is faring, aggregated by confederation.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Regional standings + title race** | Combined championship probability by region (stacked bar), per-region cards (record, qualified/eliminated, PPG, win %, knockout reach, avg ELO, top scorer, clean sheets, discipline), inter-confederation head-to-head matrix, and biggest cross-region results. (`src/server/civilizations.ts`) |
| ✅ | **Goals around the world** | Diverging scored-vs-conceded bars by region, sharpest-attack / meanest-defense callouts, and a "when regions score" goal-timing heatmap (six 15-min windows from the event feed). |
| ✅ | **Confederation filter on players** | `/api/players` tags each player with its region; the Players explorer filters by confederation. |
| ✅ | **Regional goal-timing insight** (CIV-1) | `regionalTimingInsight()` surfaces the region with the most concentrated scoring window ("South American sides come alive in the run-up to half-time — 40% of their goals") into AI Insights + the rotating briefing deck. (`src/ai/narratives.ts`) |
| ✅ | **Confederation lens elsewhere** (CIV-2) | A shared `RegionFilter` powers a region lens on the Defense leaderboards (meanest defenses / golden glove / ball-winners) and the golden-boot projection; players carry `team.confederation` so the boards filter client-side. (`RegionalDefense`, `RegionalGoldenBoot`, `RegionFilter`) |

## 2. Search & natural-language Q&A

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Unified entity resolver** | One shared matcher behind search + NLQ — full name / surname / flipped / "F. Last" / accents / prefix / typo / team codes + aliases. Verified by a generative corpus (`src/ai/query/resolver.ts`). |
| 📋 | **LLM query-understanding layer** | Turn the search bar into "ask anything": Claude interprets a free-form question → structured filters over the analytics engine → an answer grounded in real numbers. Covers concept queries ("most overperforming young forward") without vector infrastructure. **Recommended next big AI step.** |
| 🧊 | **Embeddings / concept search** | Vector search for fuzzy concepts ("clinical poacher", "ball-playing CB"). Deferred — structured + LLM covers ~90% of this for a stats-rich dataset; revisit only if needed. |
| 📋 | **Search ranking polish** (WC-014) | Tighten multi-word runner-up noise (e.g. "lionel messi" → a weak #2 via the initial match). Cosmetic. See `BUGS.md`. |

## 3. Live match experience

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Live fixtures refresh** | Polls the feed every 60s during match windows; games flip to LIVE and scores update server-side. |
| ✅ | **Match event timelines** | Goals, cards, subs, VAR/offside — fetched per fixture and surfaced on the match page; backfilled for finished matches. |
| ✅ | **Viewer-local kickoff times** | Kickoffs render in the viewer's own timezone (no more "tomorrow 1pm"). |
| ✅ | **Client-side live auto-tick** (ENH-1) | Global `<LiveRefresh>` polls `/api/live-status` and calls `router.refresh()` on a snapshot-generation change, so every page updates in place without a reload (15s live / 60s idle, pauses on hidden tab). Freshness pill in the Topbar. Server poll made adaptive + env-tunable. |
| 📋 | **Full-history event backfill** | Fetch timelines for all finished matches (currently capped to recent + on-demand), so older match pages show their full timeline. |
| 🟡 | **Knockout forecast — reality reconcile (done) + full re-sim (deferred)** | `reconcileForecastsWithResults` already pins known facts (eliminated → 0, confirmed advancers → reached) once real ties resolve. The remaining piece is a full real-bracket *re-simulation* — propagate still-alive teams through the **actual** draw (FIFA bracket tree reconstructed from SportMonks' "Winner Match N" linkage + best-third routing) instead of the seeded approximation, so deeper-run odds are computed on the true bracket. Fragile + unverifiable until the draw lands (2 Jul 2026); revisit then. |

## 4. Data pipeline & resilience
*Lessons from the live-feed incidents (see `BUGS.md` INC-1/INC-2).*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Hollow-feed fallback** | If the live API returns teams but no squads, serve the full simulation instead of going blank. |
| 📋 | **Scheduled disk-cache refresh** | Cache the heavy live load to disk and refresh on a schedule (1–2×/day) instead of re-fetching ~114 requests on every boot — sips the API quota instead of gulping it. |
| ✅ | **Defer heavy boot fetches** (PERF-1) | Load TV listings + the country map *off* the live-snapshot critical path so live boots faster and the brief "Simulated" cold-start window shrinks. Safer than blocking startup (which risks slow/failed cold starts on free tier). |
| 📋 | **Fail-fast on bad key** | Detect auth failures and stop retrying immediately, so a dead key never bogs down boot (and never trips a deploy health-check rollback). |
| 📋 | **`API_FOOTBALL_HOST` toggle** | Support both the direct `api-sports.io` host and the RapidAPI host via one env var (would have saved the key incident). |
| ✅ | **SportMonks player metadata + coaches** | Per-team `players.player;coaches.coach` calls give real **ages** (breakout works), heights, **full rosters** (1249 players), and **managers** (Scaloni/Deschamps/…) — which unblocks manager stories. Market value still absent. |
| ✅ | **Historical archive — every World Cup** | All other editions 1930–2015 (men + women) from the Fjelstul DB via datahub.io (`npm run data:datahub`): real results, scorers (Müller's 10, Pelé), squads, managers, champions. Bundled as 27 switchable editions; WC-016 degradation hides the advanced surfaces (pre-tracking era). Deep StatsBomb kept for 2018/2022/W-2019/W-2023. |

## 5. Broadcast & where-to-watch
*Added 2026-06-20.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **"Where to watch" panel** | International TV listings per match from SportMonks (`tvstations`), grouped by country, defaults to the viewer's country with a 100+ country selector; broadcaster logos + links. (`src/components/WhereToWatch.tsx`) |
| ✅ | **Tournament rights-holder fill** | SportMonks only tags the full broadcast package on a subset of fixtures; we derive each country's rights-holders from the tagged games and apply them to every match, so upcoming games aren't fuboTV-only. |
| ✅ | **Group channels by network + relabel** (TV-1) | Channels now collapse into network families (FOX Network/FS1/FS2/Deportes → one "Fox" card with the channel set as a sub-line; same for Telemundo), header relabeled "Broadcasters in [flag] [country]", with a note that the exact channel is confirmed near kickoff. Fixes the "every game on every network" read. (`groupByNetwork` in `src/components/WhereToWatch.tsx`) |
| 📋 | **Per-game specific channel** (TV-2) | "This match is on FS1" — not in any feed we have (SportMonks attaches the same package to every game). Needs FOX's published schedule (brittle scrape, US-only) or a paid EPG provider. |
| 🧊 | **Daily TV re-fetch** (TV-3) | Refresh listings ~1×/day so SportMonks additions appear without a redeploy. Low value — carrier-fill already covers the rights-holders. |
| 🧊 | **Match buzz — Reddit (SOC-1)** | A per-match panel from the r/soccer match thread: comment count + velocity, upvote ratio, and top up-voted reactions (filtered for NSFW), cached off the boot path. Design mocked + validated; **blocked on access** — X's API is paid ($100–200/mo, not worth it), and Reddit OAuth needs a registered app we couldn't create (Reddit IP-blocks the dev's network; unauthenticated `.json` returns 403). Revisit if app creation succeeds on a clean network. |

## 6. Club connections
*Added 2026-06-20.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Club Connections rebuilt** (WC-024) | Cross-provider join (SportMonks ↔ API-Football) by surname+DOB with multi-token keys; **703 of ~1,248 squad players** mapped to clubs/leagues. (`src/server/clubs.ts`, `scripts/fetch-clubs.mjs`) |
| 📋 | **Targeted lookups for the unmatched** (CLUB-1) | API-Football player search by name for players in leagues we don't crawl — pushes coverage past 703. ~hundreds of calls, within quota. |
| 🧊 | **Club straight from SportMonks** (CLUB-2) | Same id namespace → ~100% coverage, no crosswalk, but loses curated league colours/logos; bigger rewrite. |
| 🧊 | **Matcher precision tighten** (CLUB-3) | Drop particle/short tokens ("de", "van"). Precision already ~95%+; marginal. |

## 7. Betting, model-vs-market & track record

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Betting Edge guardrails** (WC-022) | Shrunk-EV + min-model-probability so longshot "troll" value bets don't top the list; imminent fixtures surfaced first. |
| ✅ | **Track record — Phase 1** (FEAT-1) | `/track-record` grades every finished match against the model's pre-match probabilities (predictMatch runs off static ratings, so it's a fair pre-match read): hit rate, multiclass Brier vs a coin-flip baseline, Brier skill, log loss, best-call / biggest-miss highlights, and a per-match graded table. (`src/server/trackRecord.ts`) |
| 🔌 | **Track record — Phase 2: vs the bookies** (FEAT-1b) | Built + gated, **awaiting Upstash config**. The live refresh snapshots every upcoming fixture's model + de-vigged market price to Upstash Redis (overwriting until kickoff = the closing line); `/track-record` joins finished results → model-vs-market Brier + a "beat the market" count. No-op without `UPSTASH_REDIS_REST_URL`/`TOKEN` (verified). Set those env vars on Render → snapshots accumulate before each kickoff (CLV can't be backfilled). (`src/server/predictionLog.ts`) |
| 🧊 | **Multi-sport betting product** | Separate odds product for bettors, off the WC critical path. |

## 8. Live data quality

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Live attribute + narrative honesty** (WC-023) | Player attributes show the real SportMonks match rating (no flat 76); match reports omit fabricated 50/50 possession / field tilt. |
| ✅ | **Real player head-shots** (IMG-1) | SportMonks `image_path` photos render on player profile / discoveries / storylines, composited over the procedural portrait (which stays the fallback for seeded/historical or a failed load). (`src/components/brand/PlayerPortrait.tsx`) |
| ✅ | **Advanced metrics graceful-degrade** (WC-016) | xG/xA/progressive passes/pressures read **0** across player pages, standings, analytics, golden boot on live data — the feed lacks them but the UI renders them. Hide/label like WC-023 did for attributes. **Biggest "live looks broken" gap.** See `BUGS.md`. |

## 9. Defense & tactics
*Added 2026-06-21 — the app was attack-skewed; rebalancing toward defense and style.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Defense showcase** (`/defense`) | "The Wall" — Meanest Defenses (goals/xG conceded + clean sheets), Golden Glove (saves / clean sheets / save %), Top Ball-Winners (tackles+interceptions+duels+pressures per 90). xGA and pressures hide gracefully where the source lacks them. (`src/server/defense.ts`) |
| ✅ | **Defensive insight + briefing beat** (DEF-1) | A `wall` insight ("X has conceded just N — the meanest defense") in AI Insights, plus a meanest-defense beat in the daily briefing. Works on every source (results-based). |
| ✅ | **Tactical identity profiles** (TAC-1) | "Tactical Identity" panel on team pages — a derived playing-style label from possession, press index (PPDA), field tilt and pass accuracy (seeded/historical). On **live**, a coarser **build-up read** from player passing (pass accuracy + final-third passes), honestly labelled, since the feed has no team possession/press. Plus a **"Styles" clash** line on match pages ("high press vs deep block", or "a tactical mirror"). No formations/spatial maps — the feed has no coordinates. (`src/server/tactics.ts`) |

---

## Suggested critical path (my read — your browse decides)

1. ~~**TV-1**~~ ✅ — channel grouping shipped; the "every game on every network" read is gone.
2. ~~**WC-016**~~ ✅ — live xG surfaces now read from player aggregates; shot/pressure-only panels hide when the feed lacks them.
3. ~~**PERF-1**~~ ✅ — TV enrichment moved off the boot path; first visits land on live faster.
4. **FEAT-1 (Phase 2)** — flip on once Upstash creds are in Render (Phase 1 model-vs-results scorecard already live).

Everything else (TV-2, club follow-ons, ENH-1, narrative installments) is opportunistic.

---

*To propose something new, add a row with status 📋 and a one-line description. When it ships, flip to ✅ and note the file/commit.*
