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

### WC-016 — Advanced metrics show 0 / "0th percentile" on live data
- **Area:** data adapter (`src/data/providers/apiFootball.ts`) + many UI surfaces (player detail, scouting, golden boot, standings, home stat strip, analytics, breakout)
- **Severity:** high — pervasive; makes the live app look broken
- **Steps:** On the live site, open any player page, the golden boot, or `/standings`.
- **Expected:** Advanced metrics (xG, xA, progressive passes/carries, pressures, touches-in-box, ball recoveries) show real values OR are hidden/labeled "not available for this source."
- **Actual:** They're all **0** — scouting shows "0th percentile" weaknesses, golden boot `xG 0`, standings show `xG 0.0 / 0.0` for every team, home "Total xG" reads ~0 next to real goals.
- **Root cause:** API-Football's feed for this competition/plan carries only basic stats (goals, assists, minutes, shots, passes) — **no xG or advanced metrics**. But the adapter hardcodes `meta.hasAdvancedMetrics: true`, so the UI renders the empty metrics instead of degrading. (Confirmed: xG/xA/progressive/pressures/touches/recoveries are uniformly 0 across all sampled live players.)
- **Fix (proposed):** adapter derives `hasAdvancedMetrics` from whether advanced data actually arrived; UI hides or labels advanced metrics + their percentiles when the active source doesn't provide them. The `datasetMeta().hasAdvancedMetrics` flag + `hasShotData` (already used to hide shot maps) are the hooks.
- **Status:** 🔴 Open (high)

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
- **Status:** 🔴 Open (planned)

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
| WC-023 | Live data fabricated flat stats: every player's attributes all **76**, and every match narrative claimed **50% possession / 50% field tilt** | sportmonks adapter · narratives · player page | SportMonks carries no FIFA-style player attributes and no possession/field-tilt; the adapter stamped a flat `76` on every player's `rating` and `generateMatchSummary` used `?? 50` fallbacks — so placeholders rendered as real data on every live player and match. Same class as WC-016 (fabricate instead of degrade). | Stop fabricating, degrade honestly: made the six per-attribute ratings **optional** and omitted them for live; player `overall` now comes from SportMonks' **real average match rating** (team-strength prior only until a player features); the player page swaps the Attributes bars for a real **"Match Rating /10" card** with an explanatory note when attributes are absent; the match narrative omits the possession/field-tilt line unless `teamStats` actually carries it. Verified live (Messi 9.7/10, no 76 wall; "Mexico won 2-0" narrative has no possession line) and seeded bars intact. · narratives.ts · sportmonks.ts · players/[id]/page.tsx · types.ts · generate.ts |
| WC-022 | Value bets surfaced longshot trolls (e.g. "Iraq beat France" as top pick) | betting / model-vs-market | `valueBets` ranked by raw `ev = model*odds - 1`. The seeded Poisson overstates underdog tails (compressed, coarse hand-seeded priors), and at long odds a tiny prob gap explodes the EV (model 20% vs market 8% at 12.0 → +140% EV), so longshots dominated the list while the market (far sharper) was right. Not a data bug — the model was simply wrong and the EV sort rewarded it. | Two guardrails in `betting.ts`: (1) `shrunkEv()` shrinks the model toward the de-vigged market as the price lengthens (full weight at evens → zero by odds 12), taming the displayed/ranked EV while leaving the raw `edge` honest; (2) `MIN_MODEL_P` floor (0.12) — never flag value on an outcome the model itself rates a longshot. `valueBets` now gated by both. · betting.ts |

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

- **No live browser auto-update** — server data is fresh within 60s, but the page needs a reload to
  show it (tracked as ENH-1).
- **Abbreviated player names** (`L. Messi`) come from the squad feed and upgrade to full names as
  players accrue match stats.
- **Live data depends on API-Football** coverage and the daily request quota.
- **SportMonks: market value** isn't provided (stays 0 — affects only the value-adjusted breakout
  weighting, which falls back to pure output). Ages, heights, full rosters, and managers are now
  fetched via per-team `players.player;coaches.coach` calls (resolved).
