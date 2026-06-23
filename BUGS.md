# Bug Log — World Cup Intelligence

A living tracker of bugs, their root causes, and fixes. Keep it next to the code so the
record travels with the repo. Commit hashes let anyone see the exact change.

**Last updated:** 2026-06-20

---

## How to log a bug

Copy this block into **Open bugs** when you find something during testing:

```
### WC-0XX — <short title>
- **Area:** <page / module, e.g. /matches, search, store, narratives>
- **Severity:** blocker | high | medium | low | cosmetic
- **Steps:** <exact steps to reproduce>
- **Expected:** <what should happen>
- **Actual:** <what happens, with the exact error/text if any>
- **Notes:** <screenshots, console error, which data source (live / simulation), time zone>
- **Status:** Open
```

When testing, the single most useful thing to capture is the **exact on-screen text or console
error** and **which data source** was active (live-2026 vs simulation) — most bugs here behave
differently between the two.

**Status legend:** 🔴 Open · 🟡 Investigating · 🟢 Resolved · ⚪ Won't fix / by design

---

## Open bugs

### WC-014 — Search runner-up noise on multi-word names
- **Area:** search / resolver (`src/ai/query/resolver.ts`)
- **Severity:** cosmetic
- **Steps:** Search `lionel messi`.
- **Expected:** Only L. Messi (or clearly-relevant players).
- **Actual:** L. Messi ranks #1 (correct), but a weak #2 appears (e.g. `L. Bayliss`) via the `lionel`→`L` initial match.
- **Notes:** Primary result always correct; only the runner-up is noise. Tighten by requiring a strong surname hit before counting an initial-only match.
- **Status:** 🔴 Open (low priority)

### ENH-1 — Live scoreboard doesn't auto-update in the browser
- **Area:** match/live pages (client)
- **Severity:** enhancement
- **Steps:** Open a live match; watch a goal go in.
- **Expected:** Score/minute tick without a manual reload.
- **Actual:** Server data refreshes every 60s, but the browser only shows it after a page reload.
- **Notes:** Agreed as the next task — add a client-side poll (every ~30–60s) on the match/live pages. Not a defect, a missing feature.
- **Status:** 🟢 Resolved — a global `<LiveRefresh>` (mounted in the Topbar) polls a no-store `/api/live-status` probe (cached snapshot only, no provider call) and calls `router.refresh()` whenever the snapshot generation changes, so every page re-renders in place without a manual reload. Polls 15s while a match is live, 60s idle; pauses on a hidden tab; catches up on refocus. A freshness pill shows "N live · updated Ns ago" (live) / "Live" (idle). Server poll also made adaptive + env-tunable (`LIVE_REFRESH_MS` / `LIVE_REFRESH_LIVE_MS`, 30s while live). · LiveRefresh.tsx · api/live-status · instrumentation.ts

---

## Resolved bugs

| ID | Bug | Area | Root cause | Fix |
|----|-----|------|-----------|-----|
| WC-001 | Every player shown as "CM" | data adapter | `detailedPosition` hardcoded to `'CM'` | Map role→detailed position (GK/CB/CM/ST) · pre-launch |
| WC-002 | `/live` crash — `reading 'flag'` | live/matches render | TBD knockout fixtures → `getTeam(id)!` undefined → `.flag` | Guard MatchCard + `liveMatches`/`matchDetail` filters · pre-launch |
| WC-003 | Home page "client-side exception" | home / narratives | `getPlayerView` used `getTeam()!` → undefined during live load | `getPlayerView` returns `undefined` when team unresolved; cascaded guards · pre-launch |
| WC-004 | Transient bracket crash — `reading 'teamId'` | analytics/bracket | `buildBracket` asserted seed slots (`!`) → undefined mid-load crashed the whole engine | TBD defaults for unresolved seeds · `dc47ea6` |
| WC-005 | Hollow live feed → blank app | data load / degradation | Quota/key returns team skeleton with no squads; no fallback | `isHealthyLive` check → serve full simulation if hollow · `434daf9` |
| WC-006 | "lionel messi" found nothing (matching) | search | Matched only the surname (last token) | Multi-token match, later full resolver · `434daf9` → `9287203` |
| WC-007 | `/api/search` 500 | search endpoint | `getTeam(m.homeTeamId)!.name` on a TBD fixture in the match filter | Resolve both sides up front, drop unresolved fixtures · `2c76f4a` |
| WC-008 | Live data loaded but rendered empty | store / caching | Module-scoped lookup indexes weren't invalidated across module instances when the `globalThis` snapshot swapped → stale sim index orphaned every live player | Key indexes to the snapshot identity; rebuild on swap · `f6d9f31` |
| WC-009 | Search false-positives / typo misses (live) | resolver | Long query matched a 2-char name fragment (`holland`→`Jun-Ho`); no transposition handling (`halaand`); fuzzy on short tokens (`kane`→`Sané`) | Require name token ≥4 for the extend rule; Damerau/OSA distance; gate fuzzy to ≥5-char tokens · `09682d9` |
| WC-010 | Search & NLQ used two different weak matchers | search + AI | Duplicated, inconsistent entity matching | Unified both behind one shared resolver + generative coverage corpus · `9287203` |
| WC-011 | Kickoff shown as "tomorrow 1pm" | formatting | `timeZone: 'UTC'` hardcoded; WC-2026 is in North America, so evening games roll onto the next UTC day | `<LocalTime>` renders each fixture in the viewer's own zone · `f05b844` |
| WC-012 | Live games never flipped to LIVE; scores frozen | data refresh | Feed fetched once at boot, never refreshed | Poll fixtures every 60s during play windows; merge status/score/minute · `f05b844` |
| WC-013 | Match report says a team "won" during a live game | narratives | `generateMatchSummary` only special-cased `SCHEDULED`; LIVE fell through to past-tense result | Add a LIVE/HALFTIME present-tense branch; reserve "won" for FINISHED · `c1603f0` |
| WC-015 | Match events missing (goals, disallowed/offside, cards) | data adapter / live refresh | Adapter hardcoded `events: []`; the per-fixture timeline was never fetched | Fetch `/fixtures/events`, map goals/cards/subs/VAR, resolve scorer+team from squads, surface VAR/own-goal in the UI; backfill finished matches once (capped) · `a445a67` · `968c8c2` · `3521d7c` |
| WC-017 | SportMonks: Australia/Austria & Iran/Iraq merged into one team | sportmonks adapter | Team code derived by slicing the first 3 letters of the name → `AUS`/`IRA` collisions merged distinct nations, corrupting groups | Use SportMonks' real `short_code` (AUS/AUT, IRN/IRQ) — also matches the enrichment table so flags/ELO populate · sportmonks adapter |
| WC-018 | `/predictions` 500 — `reading 'gf'` on SportMonks data | analytics/simulate | A finished match referenced a team not in its group's base map (group-assignment gap) → `base.get(id)!` undefined | Guard the group base lookup and skip rather than crash (same rule as WC-002) · simulate.ts |
| WC-019 | "Breakout" flagged 25-year-olds (Haaland) on SportMonks | narratives / nlq | SportMonks gives no player age (`age=0`), so the `age ≤ 23` filter passed everyone | Require `age >= 17 && age <= 23` — breakouts only surface when ages are actually known · narratives.ts · nlq.ts |
| WC-020 | Historical `/teams` page empty (no teams) on every datahub edition | datahub importer | Teams were built with `confederation: ''`, but the `/teams` page groups by confederation → every team filtered out | Populate `confederation` from teams.csv `confederation_code` (UEFA/CONMEBOL/CAF/…) · fetch-datahub.mjs |
| WC-021 | Betting Edge stuck on "odds loading…" forever (live) | betting / odds | Odds were keyed by API-Football fixture ids, but post-migration match ids are `m-<SportMonks id>` — two id namespaces that never join. SportMonks plan isn't entitled for odds (403). | Decoupled odds into a source-selectable market layer joined to fixtures by **team + kickoff date** (with home/away orientation + alias map for divergent nation spellings). Primary source = **API-Football** `/odds` (Pro plan, 14 books, scoped to betting only — does NOT change DATA_SOURCE); **The Odds API** kept as automatic fallback. Honest empty-state copy + unmatched-event diagnostic. · betting.ts · oddsApiFootball.ts · oddsApi.ts |
| WC-016 | Advanced metrics show 0 / "0th percentile" on live | many UI surfaces | The live feed doesn't carry every advanced metric, but surfaces rendered the empty values as real (`0` / `0th percentile`). Largely resolved by the SportMonks migration (real xG/shots/progressive/tackles) + the player-percentile omit (store.ts skips uniformly-0 metrics). Remaining team/shot-level zeros fixed: **Home "Total xG"** now sums real player xG (not empty per-match team stats); **standings** hide the xG line when team xG is absent; **analytics** recompute xG/shot, conversion, big chances from player aggregates, swap "Set-piece xG" → "Total xG" and hide "Pressing Volume" when shot/pressure data is missing. Verified live (real values) + seeded (full detail). · page.tsx · standings · analytics · store.ts |
| WC-024 | Club Connections (and Discoveries) showed only ~11 players on live data | clubs · discoveries · club-affiliation precompute | The `clubs.json` map was keyed by **API-Football** player ids, but live-2026 migrated to **SportMonks** ids — two namespaces that never join, so only ~11 coincidental numeric collisions matched (and could point at the wrong club). | Rebuilt the join as a cross-provider crosswalk on **surname + birthdate**: the precompute now pulls full bios (name/DOB/nationality) via API-Football `/players?team=&season=` and emits a `byKey` (`"surname\|dob"`) map; SportMonks players now carry `birthDate`; a shared key builder (script + app) generates the keys and `clubs.ts` + `discoveries.ts` join on them. Each player is indexed under **every surname token** (DOB-gated) so compound names ("García López", "Rúben Santos … Dias") match whichever token a provider treats as the last name. Verified live: **703 players linked (was 11)**, high precision (Bayern 14/14, Liverpool 9/9 incl. Salah; the lone miss is an upstream API-Football affiliation quirk). · fetch-clubs.mjs · clubAffiliations.ts · clubs.ts · discoveries.ts · sportmonks.ts · types.ts |
| WC-023 | Live data fabricated flat stats: every player's attributes all **76**, and every match narrative claimed **50% possession / 50% field tilt** | sportmonks adapter · narratives · player page | SportMonks carries no FIFA-style player attributes and no possession/field-tilt; the adapter stamped a flat `76` on every player's `rating` and `generateMatchSummary` used `?? 50` fallbacks — so placeholders rendered as real data on every live player and match. Same class as WC-016 (fabricate instead of degrade). | Stop fabricating, degrade honestly: made the six per-attribute ratings **optional** and omitted them for live; player `overall` now comes from SportMonks' **real average match rating** (team-strength prior only until a player features); the player page swaps the Attributes bars for a real **"Match Rating /10" card** with an explanatory note when attributes are absent; the match narrative omits the possession/field-tilt line unless `teamStats` actually carries it. Verified live (Messi 9.7/10, no 76 wall; "Mexico won 2-0" narrative has no possession line) and seeded bars intact. · narratives.ts · sportmonks.ts · players/[id]/page.tsx · types.ts · generate.ts |
| WC-022 | Value bets surfaced longshot trolls (e.g. "Iraq beat France" as top pick) | betting / model-vs-market | `valueBets` ranked by raw `ev = model*odds - 1`. The seeded Poisson overstates underdog tails (compressed, coarse hand-seeded priors), and at long odds a tiny prob gap explodes the EV (model 20% vs market 8% at 12.0 → +140% EV), so longshots dominated the list while the market (far sharper) was right. Not a data bug — the model was simply wrong and the EV sort rewarded it. | Two guardrails in `betting.ts`: (1) `shrunkEv()` shrinks the model toward the de-vigged market as the price lengthens (full weight at evens → zero by odds 12), taming the displayed/ranked EV while leaving the raw `edge` honest; (2) `MIN_MODEL_P` floor (0.12) — never flag value on an outcome the model itself rates a longshot. `valueBets` now gated by both. · betting.ts |
| WC-028 | Player stats went **stale mid-tournament** (e.g. Mbappé stuck on 2 goals / 1 app while France had played 2) | data refresh · loadTournament | Per-player aggregates (goals, apps, xG…) are built only by the full `fetchSportMonksSnapshot` at boot. The 60s `refreshLiveScores` patches match **scores + event timelines** in place but never re-aggregates player stats — so once a match finished *after* boot, its scorers' tallies (and the golden boot, top scorers, scoring-streak insight) froze until a redeploy. Proof: match list showed 2 France games finished, but Mbappé had `appearances: 1`. A fresh fetch correctly gives 4 goals / 2 apps. | When `refreshLiveScores` sees a match newly flip to FINISHED, trigger `rebuildLiveSnapshot()` — a guarded, best-effort background full re-fetch that recomputes every player's stats from all finished matches (idempotent; runs a few times a day at most; keeps the current snapshot on failure). Deploying the fix also boots a fresh snapshot, so the stale figures correct immediately. · loadTournament.ts |
| WC-027 | Live data was missing all **team match stats** (possession, shots, passes…) and every player was shown **right-footed** | sportmonks adapter · narratives | We only fetched `lineups.details;events.type` per fixture and `players.player` per squad, so `teamStats` stayed `{}` (WC-023 then *omitted* possession/field-tilt assuming the feed had none) and `foot` was hard-coded `'right'`. But SportMonks **does** provide both: a `statistics` include returns 40+ team stats per fixture (Ball Possession %, Shots Total/On Target, Passes, Successful Passes %, Big Chances, Corners, Dangerous Attacks, Tackles, Interceptions, cards…), and player `metadata` (type_id 229) carries real preferred foot. | Pull them: added `statistics.type` to the per-fixture detail call and mapped it into `MatchTeamStats` by home/away location (possession/shots/passes/cards direct; **xG** summed from that fixture's lineup player xG; **field tilt** ≈ share of dangerous attacks; **PPDA** ≈ opp passes / our tackles+interceptions); added `players.player.metadata` to the squad call and mapped foot via `footOf()`. The recap "underlying numbers" + possession lines (WC-023) now light up on live, gated on real presence. Also fixed the same under-fetch for **venue** (every live match showed `venue: 'TBD'` — added the `venue` include → real stadium + city) and added **starting formations** (`formations` include → `match.formations`, shown on the match page, e.g. 4-1-4-1 vs 5-3-2), **referee** (`referees.referee` include, main official type_id 6 → `match.referee`) and **weather** (`weatherreport` include → `match.weather` {tempC, description}), both surfaced under the match-page scoreboard. Verified live: all 40 finished matches carry real stats (MEX 61% / RSA 39% possession, xG 1.3/0.1), venue (Mexico City Stadium), formations, referee (Wilton Pereira Sampaio) + weather (25°C, moderate rain); foot 140R/53L/7both (Messi/Oyarzabal left). · sportmonks.ts · narratives.ts · matches/[id]/page.tsx · types.ts |
| WC-026 | "Emerging player" news showed **€0m valuations** all over live/historical data | narratives · nlq | Only the seeded edition computes `marketValueEur`; every external source (SportMonks, datahub, StatsBomb, API-Football, football-data) sets it to `0`. The breakout insight body and the NLQ breakout answer/table interpolated it unconditionally, so live/historical rendered "€0m valuation" — and the one breakout insight propagates to `/insights`, the home AI Insights panel, and the rotating briefing deck, so it read as "littered". Same class as WC-016/WC-023 (placeholder shown as real). | Degrade gracefully: omit the valuation clause when `marketValueEur === 0` (breakout insight body, scouting report already guarded); the NLQ drops both the "€Nm valuation" phrase and the **€m** column when no candidate has a value (`hasVal`). Seeded edition still shows real values (€14m etc.); live/historical simply omit. Verified live (no €0m, no valuation clause) + seeded (values intact). · narratives.ts · nlq.ts |
| WC-025 | Clicking a player (or team) on `/defense` could land on a broken/empty page on live data | store · player/team detail pages | `getPlayerView(id)` returned `undefined` when a player's team didn't resolve (snapshot mid-swap / cross-index staleness). The defense **list** (memoized `getPlayerViews`) still showed the player, but the **detail** page turned that `undefined` into `notFound()` → an empty page. The detail page also kept a crash-prone `getTeam(p.teamId)!`. Intermittent + live-only (the 60s refresh window), so it never reproduced in a steady snapshot. Same class as WC-003/WC-008. | `getPlayerView` now builds the view with a **minimal fallback team** (id/name/code/flag from the player's own `teamId`) instead of returning `undefined`, so a real player is never dropped from the list and never 404s on its page (the real team fills back in next render). Player page derives `team` safely (no `!`, falls back to the view's lightweight team + neutral accent); team page skips fixture rows whose opponent is momentarily unresolved instead of `getTeam(...)!`. Verified: real team chrome still renders, bogus ids still 404. · store.ts · players/[id]/page.tsx · teams/[id]/page.tsx |
| WC-033 | Forecast **ignored real knockout results** — an eliminated team could still show a "reach the semis" probability | analytics/engine · knockout reconcile | `runSimulation` projects the whole knockout from a seeded bracket every run, with no knowledge of who actually qualified or what's been played. Latent today (knockout fixtures are TBD placeholders), but the moment real ties resolve, a team already knocked out would still carry non-zero reach probabilities and a confirmed qualifier could read < 100% to make the R32. | Added `reconcileForecastsWithResults()` — a post-simulation pass that pins what's *known* from the real fixtures per team: not-qualified → all reach 0; appears at round R → reached R = 1; won at R → reached R+1; lost at R → nothing beyond R; won the final → title = 1. Still-open rounds keep the model's simulated odds. Penalty shootouts break level ties. No-op until real knockout fixtures exist, so the pre-tournament forecast is untouched (verified: current 48-team forecast unchanged, Argentina 25% etc.). Unit-tested (7 scenarios). **Follow-up (deferred, ROADMAP):** a full real-bracket *re-simulation* (propagating still-alive teams through the actual draw) needs FIFA's bracket tree reconstructed from SportMonks' "Winner Match N" linkage — fragile + unverifiable until the draw lands (2 Jul). · knockoutResults.ts · analytics/index.ts |
| WC-032 | SportMonks adapter **hardcoded `stage: 'GROUP'`** on every fixture | sportmonks adapter | Every fixture was stamped `stage: 'GROUP'`. Harmless today (knockout fixtures are TBD placeholders, filtered out by the participant-name check), but the moment real R32+ fixtures get their teams assigned (early July) they'd appear mislabelled as group games. Worse, `groupId` fell back to the **home team's group** when `f.group` was absent, so a knockout tie would have been counted into that group's standings (which filter by `groupId`). | Add the `stage` include and map `f.stage.name` → `MatchStage` via `mapStage()` (verified against all 7 real WC2026 stage strings: Group Stage / Round of 32 / Round of 16 / Quarter-finals / Semi-finals / 3rd Place Final / Final; specific rounds tested before the bare-"final" fallback). Set `groupId` only for group fixtures (null for knockouts) so a KO tie can never pollute a group table. Unit-tested (`sportmonks.test.ts`). · sportmonks.ts |
| WC-031 | AI Insights "Daily Briefing" showed a **frozen "13 June 2026 · Matchday 3"**, and every group match was internally tagged **matchday 1** | insights page · sportmonks adapter · narratives | Two bugs: (1) the briefing sub-heading was a **hardcoded literal** `"13 June 2026 · Matchday 3"` that never changed; (2) the SportMonks adapter **hardcoded `matchday: 1`** on every fixture even though it already fetched the `round` include — SportMonks carries the group-stage matchday in `round.name` ("1".."3") — so the real matchday was lost everywhere (briefing, `phaseLabel`, any matchday grouping). | Map `matchday` from `f.round?.name` in the adapter (numeric → matchday, else 1). Replace the hardcoded sub-heading with a data-driven `briefingMeta()` query: today's date + the current phase derived from the fixtures (live match → next scheduled → last finished; "Knockout stage" once the group games are all done). Only the live edition gets a calendar date; historical editions show just the phase. · sportmonks.ts · server/queries.ts · insights/page.tsx |
| WC-030 | Power rankings looked **different on the home panel vs the `/rankings` page**, and the top of the table reshuffled on its own | analytics/power · home · rankings | Both surfaces read the same `engine().powerRankings`, so they match within a single engine generation — but the live engine rebuilds (fresh Monte Carlo) whenever a match flips status (kickoff / final whistle), so a home panel rendered earlier and a freshly-navigated `/rankings` page can reflect two different simulations (ENH-1 class: no in-browser auto-refresh). Worse, several elite teams **saturate the 0..100 display ceiling** (Spain/France/Argentina all = 100), and the sort broke those ties by **array order**, which isn't stable across rebuilds — so the very top reordered on every status flip even when nothing changed. | Sort by the **un-clamped raw score** with **ELO** then teamId as deterministic final tie-breaks, so the order is identical on every rebuild and every page that reads it (`powerRating` still displays clamped 0..100). The remaining cross-time drift is genuine live movement, addressed by ENH-1 (browser auto-refresh). · power.ts |
| WC-029 | Golden Boot race **ranked a player with fewer goals above the actual leader** | analytics/goldenboot · home · predictions | The race was sorted by `projectedGoals` (current + finishing-adjusted rate × expected remaining games), not goals scored — so a deeper-running or hot-rate player could sit above the genuine top scorer, which reads as wrong for a "Golden Boot race." Compounding it, the per-90 rate divided by **actual minutes** (`/ max(mins,1)`), so a low-minute burst (a sub who scored in 30') projected a wild rate and inflated their finish. | Rank the race by **goals actually scored** (the real standings); projection + win-boot % ride alongside as forecast **columns**, not the sort key (tie-break: projection → xG → win prob). Also regress the rate denominator to a ~2-game sample (`/ max(mins,180)`) so a one-off burst can't leapfrog established scorers. Relabelled home panel "Projected finish" → "Goals → projected" and predictions subtitle → "Live standings + finishing-adjusted projection". · goldenboot.ts · page.tsx · predictions/page.tsx |

---

## Incidents (environment / config, not code defects)

| ID | Incident | Cause | Resolution |
|----|----------|-------|-----------|
| INC-1 | Live feed dead / hollow for hours | The key in Render was a **RapidAPI** key with no subscription, used against the **direct** api-sports.io host; also the free tier's 100 req/day is below one full load (~114 calls) | Use the correct direct `api-sports.io` key on a paid plan; `DATA_SOURCE=apifootball` |
| INC-2 | Deploys reported "Live" but ran old code | A Render **Rollback** pinned an old commit; env-var saves and "Clear build cache & deploy" rebuilt the *pinned* commit, not `HEAD` | Push a **fresh commit** — auto-deploy-on-commit always builds `HEAD` and breaks the pin |
| INC-3 | Prod reverted to old (pre-SportMonks / API-Football) code after env-var save AND again after a plan change (Free→Pro) | Same root cause as INC-2: a still-active **rollback pin** means **any service config change** (env save, instance-plan change, restart) redeploys the *pinned* old commit, not `HEAD`. Diagnosed via `/api/health` reporting `API-Football (live)` instead of `SportMonks (live)`. | Push a fresh commit to force `HEAD`. **Durable fix:** clear the rollback in Render → service → **Manual Deploy → Deploy latest commit**, so future config changes rebuild `HEAD`, not the pin. |

---

## Recurring patterns → where to focus testing

These are the classes of bug this codebase is prone to. Test these deliberately:

1. **Undefined entity lookups (the #1 class).** Any `getTeam`/`getPlayer`/`getPlayerView` with a `!`
   non-null assertion crashes when data is mid-load or a fixture's teams are TBD. **Test every page
   during the live-load window (first ~60s after a deploy) and with knockout (TBD) fixtures:**
   `/`, `/live`, `/matches`, `/matches/[id]`, `/standings`, `/rankings`, `/bracket`, `/insights`,
   `/storylines`, and search. Rule: never `!` a team/player lookup — resolve, check, skip.
2. **Match state handling (scheduled / live / halftime / finished).** Any label or narrative that
   assumes a match is over. Test a fixture in each of the four states.
3. **Timezone.** Any date/time display. Test from a non-UTC machine; check the day is correct, not
   just the time.
4. **Live refresh correctness.** Scores, minute, and status updating; standings/predictions
   recomputing after a goal; a match correctly flipping to FINISHED.
5. **Tournament switching.** Switching live-2026 ↔ men-2022 ↔ women-2023 etc. — indexes and the
   analytics engine must rebuild (same root cause as WC-008).
6. **Search forms.** Surname, full name, flipped order, abbreviated "F. Last", accents, prefix,
   typos, team codes/aliases. Covered by `src/ai/query/resolver.test.ts` but spot-check in the UI.
7. **Early-tournament / empty data.** 0 minutes played, 0 stats — per-90 and percentile math must
   not divide by zero or rank everyone identically.
8. **Hollow live feed.** If the API returns teams but no squads, the app must fall back to the full
   simulation (WC-005), not go blank.
9. **Match event timelines.** Goals, VAR/disallowed, cards, subs. Test three states: a **live** match
   (timeline grows each refresh), a **just-finished** match (final events captured), and an **older
   finished** match (timeline backfilled once). These have distinct code paths (WC-015).

---

## Known limitations (by design — not bugs)

- **Abbreviated player names** (`L. Messi`) come from the squad feed and upgrade to full names as
  players accrue match stats.
- **Live data depends on API-Football** coverage and the daily request quota.
- **SportMonks: market value** isn't provided (stays 0 — affects only the value-adjusted breakout
  weighting, which falls back to pure output). Ages, heights, full rosters, and managers are now
  fetched via per-team `players.player;coaches.coach` calls (resolved).
