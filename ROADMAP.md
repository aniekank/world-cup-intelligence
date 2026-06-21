# Roadmap — World Cup Intelligence

Proposed features and enhancements, so good ideas don't get buried under bug-fixing.
Companion to `BUGS.md` (which tracks defects). Updated as items ship.

**Last updated:** 2026-06-20

**Status:** ✅ Shipped · 🔨 Building now · 📋 Proposed · 🧊 Deferred (revisit later)

---

## 1. Narrative & editorial intelligence
*Make the metrics tell stories, not just report numbers. This is the active theme.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Critical-match stakes engine** | Every upcoming fixture analyzed for what's at stake (group decider, must-win, knockout, heavyweight clash, too-close-to-call, upset-on, in-form clash, goals expected), scored + ranked, key player named per side, model edge + form read, grounded preview blurb. (`src/ai/previews.ts`) |
| ✅ | **"Matches that matter" feed** | Home panel ranking upcoming fixtures by stakes, not just time. |
| ✅ | **"What's at stake" match previews** | Rich preview on every scheduled match page (replaces the thin one-liner). |
| ✅ | **Dynamic daily briefing** | Was frozen on "group stage climax"; now derives the real phase from fixtures, leads with the marquee match, reflects live state + momentum + golden boot. |
| 🔨 | **Manager stories** | Tactical identity from the team's offense/defense/possession profile + over/under-achievement vs the pre-tournament market. *Installment 2.* |
| 🔨 | **Elite player form arcs** | Scoring streaks, involvement trending up/down, over/under-xG, milestone watches — built on the live event timelines. *Installment 2.* |
| 📋 | **Claude-authored prose** | Wire the existing `narrate()` hook across briefing, previews, and stories so grounded structured output becomes genuinely editorial prose. Activates by setting `ANTHROPIC_API_KEY` in Render; deterministic stays the fallback. *Installment 3.* |
| 📋 | **Qualification scenarios** | "A draw sends them through; a loss and they're out" — turn standings math into plain-English stakes. |
| 📋 | **Bracket knock-on analysis** | "If Brazil win this, Argentina's path to the final hardens" — downstream effects of a result. |
| 📋 | **Milestone / record watch** | Players within reach of tournament records (goals, assists, clean sheets). |

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
| 📋 | **Client-side live auto-tick** (ENH-1) | Scoreboard + timeline update in the browser without a manual reload (~30–60s client poll). **The natural finishing touch on "live."** |
| 📋 | **Full-history event backfill** | Fetch timelines for all finished matches (currently capped to recent + on-demand), so older match pages show their full timeline. |

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
| 📋 | **Group channels by network + relabel** (TV-1) | Collapse FOX Network/FS1/FS2/Deportes under one "FOX Sports" group (same for Telemundo), relabel the panel "World Cup broadcasters in [country]", note the exact channel is set near kickoff. **Current live rough edge — the full channel list reads as "every game on every network".** |
| 📋 | **Per-game specific channel** (TV-2) | "This match is on FS1" — not in any feed we have (SportMonks attaches the same package to every game). Needs FOX's published schedule (brittle scrape, US-only) or a paid EPG provider. |
| 🧊 | **Daily TV re-fetch** (TV-3) | Refresh listings ~1×/day so SportMonks additions appear without a redeploy. Low value — carrier-fill already covers the rights-holders. |

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
| 📋 | **Advanced metrics graceful-degrade** (WC-016) | xG/xA/progressive passes/pressures read **0** across player pages, standings, analytics, golden boot on live data — the feed lacks them but the UI renders them. Hide/label like WC-023 did for attributes. **Biggest "live looks broken" gap.** See `BUGS.md`. |

## 9. Defense & tactics
*Added 2026-06-21 — the app was attack-skewed; rebalancing toward defense and style.*

| Status | Feature | What it does |
|--------|---------|--------------|
| ✅ | **Defense showcase** (`/defense`) | "The Wall" — Meanest Defenses (goals/xG conceded + clean sheets), Golden Glove (saves / clean sheets / save %), Top Ball-Winners (tackles+interceptions+duels+pressures per 90). xGA and pressures hide gracefully where the source lacks them. (`src/server/defense.ts`) |
| ✅ | **Defensive insight + briefing beat** (DEF-1) | A `wall` insight ("X has conceded just N — the meanest defense") in AI Insights, plus a meanest-defense beat in the daily briefing. Works on every source (results-based). |
| ✅ | **Tactical identity profiles** (TAC-1) | "Tactical Identity" panel on team pages — a derived playing-style label from possession, press index (PPDA), field tilt and pass accuracy (seeded/historical). On **live**, a coarser **build-up read** from player passing (pass accuracy + final-third passes), honestly labelled, since the feed has no team possession/press. Plus a **"Styles" clash** line on match pages ("high press vs deep block", or "a tactical mirror"). No formations/spatial maps — the feed has no coordinates. (`src/server/tactics.ts`) |

---

## Suggested critical path (my read — your browse decides)

1. **TV-1** — closes the rough edge you just flagged; small, high-visibility.
2. **WC-016** — the biggest "live looks broken" gap; fix it the WC-023 way.
3. **PERF-1** — makes first visits reliably land on live, not the simulation window.
4. **FEAT-1 (Phase 1)** — the differentiator this whole run was unblocking.

Everything else (TV-2, club follow-ons, ENH-1, narrative installments) is opportunistic.

---

*To propose something new, add a row with status 📋 and a one-line description. When it ships, flip to ✅ and note the file/commit.*
