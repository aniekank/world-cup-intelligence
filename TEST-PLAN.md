# World Cup Intelligence — Master Test Plan

*Generated 2026-06-17 · 215 test cases across 26 areas. Companion to `BUGS.md`. Regenerate with `python3 qa/_generate_test_suite.py`.*


## How to use this

This is a **behavior** test plan, not a smoke test. The app's defining problem is that
**bugs return HTTP 200** — a page that loads is not a page that's correct. So every test's
**Expected** asserts specific on-screen *content* (text, counts, states), and you pass a test
only when the content is right.

**Workflow**
1. Work an area top-to-bottom. Set the **Precondition** first (active tournament, data source).
2. For each case, do the **Steps**, compare to **Expected**, and tick the box.
3. On any failure, open a `BUGS.md` entry and put the **test id** (e.g. `BET-07`) in its *Steps*
   line so the bug and its test stay linked. Then keep going — log, don't fix mid-sweep.
4. The `Guards` field names the bug-class a test protects against (often a prior `WC-0xx`).

> Prefer the interactive runner — open **`qa/test-runner.html`** in a browser. It saves your
> pass/fail/notes as you go and exports failures as ready-to-paste `BUGS.md` blocks.

**Highest-leverage first:** run the **Cross-cutting** matrices (tournament switching, the
~60s live-load sweep, timezone, degradation) — historically that's where the worst bugs hide.

**Status legend:** ☐ untested · ✅ pass · ❌ fail (→ log to BUGS.md) · 🚧 blocked

## Coverage

| Area | Cases | high / med / low |
|------|------:|:----------------|
| Navigation | 7 | 1 / 4 / 2 |
| Tournament Switcher | 5 | 3 / 0 / 2 |
| Home | 11 | 6 / 3 / 2 |
| Live | 7 | 6 / 1 / 0 |
| Matches | 15 | 9 / 4 / 2 |
| Standings | 8 | 6 / 2 / 0 |
| Groups | 4 | 2 / 2 / 0 |
| Rankings | 5 | 1 / 3 / 1 |
| Bracket | 6 | 4 / 1 / 1 |
| Predictions | 8 | 6 / 1 / 1 |
| Teams | 9 | 3 / 5 / 1 |
| Players | 14 | 6 / 4 / 4 |
| Compare | 7 | 2 / 3 / 2 |
| Insights | 6 | 4 / 2 / 0 |
| Storylines | 5 | 2 / 2 / 1 |
| Discoveries | 5 | 3 / 1 / 1 |
| History | 5 | 2 / 3 / 0 |
| Analytics | 3 | 1 / 2 / 0 |
| Betting Edge | 25 | 17 / 6 / 2 |
| Search | 20 | 10 / 8 / 2 |
| Ask (NLQ) | 12 | 6 / 4 / 2 |
| Globe | 7 | 3 / 2 / 2 |
| Settings | 3 | 1 / 1 / 1 |
| Favorites | 3 | 2 / 1 / 0 |
| Guide | 3 | 1 / 1 / 1 |
| Cross-cutting | 12 | 7 / 5 / 0 |
| **Total** | **215** | **114 / 71 / 30** |


---

## Navigation  ·  7 cases

- [ ] **NAV-01** · `high` — Every sidebar link resolves (no 404 from nav)
  - **Precondition:** App running, desktop sidebar visible.
  - **Steps:**
    1. Click each link in Overview: World Explorer (/globe), Home (/), Guide (/guide), Live Center (/live), Matches (/matches), Teams (/teams), Players (/players).
    2. Click each in Analyze: Groups, Standings, Bracket, Predictions, Betting Edge, Analytics, Card Builder (/compare), Rankings.
    3. Click each in Discover: Discoveries, Club Connections (/clubs), Through the Years (/history), Storylines, AI Insights (/insights), Ask, Favorites.
  - **Expected:** Every one of the 22 NAV entries navigates to a real page that renders content (not the 404 page, not a crash). The active link gets the accent highlight (left inset bar). Routes whose label differs from href resolve correctly: Card Builder→/compare, Club Connections→/clubs, Through the Years→/history.
  - **Guards:** An href in nav.ts with no matching app/ route renders the 404 — that is a defect to log.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **NAV-03** · `medium` — Topbar brand, search box, switcher, settings present
  - **Precondition:** Any page.
  - **Steps:**
    1. Inspect the sticky topbar.
    2. Inspect the sidebar brand block.
  - **Expected:** Topbar shows the search input with placeholder 'Search teams, players… or ask "highest xG among midfielders?"', the TournamentSwitcher pill, and a 'Settings' link (sm+). Sidebar brand shows the animated BrandMark, 'TASK Enterprises presents', 'World Cup Intelligence', 'Analytics Terminal'; clicking the brand returns to /.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **NAV-04** · `medium` — Topbar search returns content-correct suggestions and Ask fallback
  - **Precondition:** A populated edition active.
  - **Steps:**
    1. Type a 2+ char team name fragment in the search box.
    2. Type a player surname.
    3. Type gibberish, then press Enter.
  - **Expected:** Debounced (~160ms) GET /api/search?q= populates grouped Teams/Players/Matches dropdowns with correct flags/codes; rows link to /teams/[id], /players/[id], /matches/[id]. Queries <2 chars show nothing. Gibberish shows 'No matches. Press Enter to ask the AI.' Pressing Enter routes to /ask?q=. Search must NOT 500 (WC-007 regression: TBD-fixture lookups).
  - **Guards:** Aborted/in-flight requests must not crash; .catch swallows aborts.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **NAV-05** · `medium` — Mobile drawer opens, navigates, and closes
  - **Precondition:** Mobile viewport (<1024px).
  - **Steps:**
    1. Tap the hamburger (top-left).
    2. Tap a nav link.
    3. Re-open and tap the backdrop / the X.
  - **Expected:** Drawer slides in over a dimmed backdrop. Tapping a link navigates AND closes the drawer (onNavigate). Tapping the backdrop or X closes it. Desktop sidebar is hidden below lg; hamburger hidden at lg+.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **NAV-06** · `medium` — Unknown route shows the 404 page, not a crash
  - **Precondition:** App running.
  - **Steps:**
    1. Navigate to a nonexistent path, e.g. /does-not-exist.
    2. Navigate to /teams/not-a-real-id and /players/not-a-real-id.
  - **Expected:** Unknown top-level path renders the app's not-found page within the shell (sidebar/topbar intact), not an unhandled exception. Unknown entity ids render a graceful not-found / empty state (getTeam/getPlayer return undefined — must be handled), never a white-screen crash.
  - **Guards:** This is the undefined-lookup class: an entity page that does getTeam(id)! would crash here instead of 404.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **NAV-02** · `low` — Live Center nav badge and active-state matching
  - **Precondition:** Sidebar visible.
  - **Steps:**
    1. Observe the 'Live Center' link.
    2. Navigate to /matches and check which links are highlighted.
    3. Navigate to / (Home).
  - **Expected:** Live Center shows the pulsing 'Live' badge. Active matching: Home is active only on exact '/'; all other links active when pathname startsWith(href). Confirm e.g. /matches/[id] keeps Matches highlighted, and being on / does not falsely highlight other links.
  - **Guards:** startsWith matching can over-highlight if one href is a prefix of another — none currently overlap, but re-check if routes are added.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **NAV-07** · `low` — Loading states render during data fetch
  - **Precondition:** Throttled network or fresh server.
  - **Steps:**
    1. Open /globe (globe spinner), the switcher pill before /api/tournament resolves, and a globe country panel before squad loads.
  - **Expected:** Globe shows 'Rendering globe…' spinner until polygons load. Switcher pill shows '🏆 Tournament' placeholder until the list loads. Country panel shows 'Loading squad…' spinner until /api/teams/[id] resolves. No layout jump that hides controls.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Tournament Switcher  ·  5 cases

- [ ] **SWITCH-01** · `high` — Dropdown lists ALL editions across all groups
  - **Precondition:** App running; /api/tournament returns the full registry.
  - **Steps:**
    1. Click the tournament pill in the topbar to open the dropdown.
    2. Scroll through every group: Live, Men's World Cup, Women's World Cup, Sandbox.
    3. Count the editions.
  - **Expected:** Live group shows World Cup 2026 (live). Men's group includes 2022, 2018 plus historical men's editions. Women's group includes 2023, 2019 plus historical women's editions. Sandbox shows 'Simulated 2026'. The full list includes the ~27 historical 1930–2015 datahub editions, so the total is ~30+ entries. Each entry shows champion flag, label, and blurb.
  - **Guards:** Grouping logic: live = coverage==='live'; sim = source==='simulation'; men/women = gender match AND source!=='simulation' AND coverage!=='live'. A historical edition mis-tagged would land in the wrong group or vanish.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SWITCH-02** · `high` — Long edition list SCROLLS within the dropdown (no off-screen overflow)
  - **Precondition:** Dropdown open with the full ~30-edition list.
  - **Steps:**
    1. Open the dropdown on a normal laptop screen.
    2. Scroll to the bottom of the list (the oldest 1930s editions).
    3. Repeat near the bottom of the viewport where the dropdown would overflow below the fold.
  - **Expected:** The dropdown is height-capped (max-h-[75vh]) and scrolls internally (overflow-y-auto). The last/oldest editions are reachable by scrolling — none are clipped off-screen or unreachable. This is a regression guard: a long list once overflowed off-screen.
  - **Guards:** Verify on a short viewport (e.g. 700px tall) that the bottom group is still scrollable into view.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SWITCH-03** · `high` — Switching an edition re-renders the whole app
  - **Precondition:** Active = live-2026; on the Home page.
  - **Steps:**
    1. Open the switcher and choose men-2022.
    2. Observe the spinner on the chosen row, then the pill label.
    3. Confirm the page content.
  - **Expected:** POST /api/tournament {id:'men-2022'} succeeds; on ok the active state updates, dropdown closes, router.refresh() re-renders. The pill now reads 'World Cup 2022' with Argentina flag and the Radio live dot disappears. Home (and every page) now shows 2022 data. Choosing the already-active edition just closes the dropdown without a refetch.
  - **Guards:** If the POST is not ok, active must NOT change (stays on previous edition). Spinner clears in the finally block regardless.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SWITCH-04** · `low` — Active edition is checkmarked; live edition shows the live dot
  - **Precondition:** Switcher data loaded.
  - **Steps:**
    1. Open the dropdown while live-2026 is active.
    2. Note the trailing icon on the active row and the pill.
    3. Switch to a non-live edition and reopen.
  - **Expected:** The active row shows a Check icon. When live-2026 is active the pill shows the pulsing red Radio dot; on a non-live edition the dot is absent. The row currently being switched shows a spinner instead of the check.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SWITCH-05** · `low` — Outside-click closes the dropdown
  - **Precondition:** Dropdown open.
  - **Steps:**
    1. Open the switcher.
    2. Click anywhere outside the dropdown.
  - **Expected:** Dropdown closes (mousedown outside the ref container). Re-opening works.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Home  ·  11 cases

- [ ] **HOME-01** · `high` — Daily briefing headline reflects live count and favourite
  - **Precondition:** Active tournament with at least one LIVE match and forecasts populated (data source ready)
  - **Steps:**
    1. Open the home page (/)
    2. Read the 'Daily Intelligence Briefing' hero headline and body
  - **Expected:** Headline reads '<N> live now — <FavouriteTeam> lead the race through <phase>' where N equals the actual number of LIVE+HALFTIME matches and <phase> is e.g. 'the group stage (matchday 3)'. Body's first sentence names the model favourite with a percentage like 'remain the model's favourites at 12.3% to lift the trophy.' Body also contains '<N> matches are live right now.' matching the same N.
  - **Guards:** Match-state handling — live count and phase must be derived from real fixture states, not hard-coded
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-02** · `high` — Daily briefing falls back to safe content while forecasts load
  - **Precondition:** Within ~60s of a fresh deploy / live-load window: matches present but engine forecasts not yet computed
  - **Steps:**
    1. Open / during the live-load window (immediately after deploy)
    2. Read the briefing hero
  - **Expected:** Headline is exactly 'Tournament data is loading'. Body reads '<N> matches are live right now. Forecasts populate as soon as the feed is ready.' and the single bullet reads '<N> live • <M> still to play'. The page renders fully (HTTP 200 with real content) and does NOT throw or show a blank hero.
  - **Guards:** Undefined lookups during live-load window — no forecast must not crash the briefing
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-04** · `high` — Stat strip computes goals and xG from finished matches only
  - **Precondition:** Active tournament with a mix of FINISHED and non-finished matches
  - **Steps:**
    1. Open /
    2. Read the four stat tiles: Teams, Matches played, Goals, Total xG
  - **Expected:** Teams shows 48 with sub '12 groups'. 'Matches played' equals the count of FINISHED matches with sub '<allMatches> total'. 'Goals' equals the summed homeScore+awayScore over FINISHED matches only, with a '<x.xx> / match' sub (0.00 guard if zero played). 'Total xG' is the summed home+away xG over finished matches with a '/ team' sub. No NaN or Infinity appears even with zero matches played.
  - **Guards:** Edge case — divide-by-zero guarded via Math.max(played,1)
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-05** · `high` — Live & Upcoming panel renders up to 6 cards, live first
  - **Precondition:** Active tournament with both live and scheduled fixtures whose teams resolve
  - **Steps:**
    1. Open /
    2. Inspect the 'Live & Upcoming' panel (subtitle 'Final round of group fixtures')
  - **Expected:** At most 6 MatchCards shown, live matches appearing before upcoming. Live cards show a red LiveDot + '<minute>′' and current score; scheduled cards show the kickoff time (LocalTime) and 'vs' style with prediction ProbBar + home/draw/away percentages summing to ~100%. If there are zero live and zero upcoming, an EmptyState reads 'No scheduled matches.'
  - **Guards:** Match-state handling — live vs scheduled rendered distinctly
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-06** · `high` — Home does not crash when an upcoming fixture has an unresolved team
  - **Precondition:** Live-load window or a TBD/knockout fixture surfaces in data.upcoming with a homeTeamId/awayTeamId not yet in the team store
  - **Steps:**
    1. Open / while a scheduled fixture references a not-yet-loaded team id
    2. Observe the Live & Upcoming panel and the page as a whole
  - **Expected:** The page must render its other sections. NOTE/RISK: home page uses lookupTeam(id) with a non-null assertion (getTeam(id)!), so an unresolved team yields an undefined Team passed to MatchCard. MatchCard guards with 'if (!home || !away) return null', so the card is skipped rather than crashing — verify the unresolved card is simply absent and no React error boundary / 500-content appears. If the page shows an error, this is the bug.
  - **Guards:** Undefined team lookups crashing during live-load / TBD knockout fixtures
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-07** · `high` — 'Matches that matter' cards rank by stakes and show edge + tags
  - **Precondition:** Active tournament with at least one SCHEDULED fixture whose teams resolve
  - **Steps:**
    1. Open /
    2. Locate the 'Matches that matter' panel (subtitle 'Upcoming fixtures ranked by what's at stake')
    3. Read each CriticalMatchCard
  - **Expected:** Up to 4 cards, ordered by descending stakes. Each card shows: stage/group label + kickoff (LocalTime clock variant with weekday), an edge readout '<CODE> <pct>%' (the favoured side's code) or 'too close' when even, both team flags/names separated by 'v', uppercase tag chips (e.g. 'GROUP A DECIDER', 'HEAVYWEIGHT CLASH', 'TOO CLOSE TO CALL'), and a blurb whose every claim is grounded (e.g. 'The model favours <Team> at <pct>%, with <x.x> goals expected.'). Panel is hidden entirely when there are no critical matches.
  - **Guards:** Match-state handling — only SCHEDULED fixtures appear here, never live/finished
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-03** · `medium` — Briefing bullets list concrete tournament facts
  - **Precondition:** Active tournament with forecasts and a golden-boot leader present
  - **Steps:**
    1. Open /
    2. Inspect the row of Badge chips under the briefing body
  - **Expected:** First badge reads '<Favourite> — <pct>% to win it across 8,000 simulations'. A 'Golden Boot:' badge names the current leader with 'leads on <G> (proj. <P>)' OR reads 'Golden Boot race wide open' if none. Final badge reads '<finished> played • <live> live • <scheduled> to come' with counts matching the stat strip / live ticker.
  - **Guards:** Match-state handling — counts must agree across briefing, stat strip, and ticker
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-08** · `medium` — Critical-match blurb never references a TBD side as a real team
  - **Precondition:** Knockout bracket partially populated; some knockout slots still TBD
  - **Steps:**
    1. Open /
    2. Read the blurbs on each 'Matches that matter' card
  - **Expected:** No card shows 'TBD' as a team name. criticalMatchesView filters out fixtures where either team is unresolved, so every card names two real teams. A fixture with a TBD slot must be absent, not rendered with the literal 'TBD'.
  - **Guards:** Undefined team lookups on TBD/knockout fixtures
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-09** · `medium` — Live ticker marquee shows live matches first with pulsing dot
  - **Precondition:** At least one LIVE or FINISHED match with resolved teams
  - **Steps:**
    1. Open /
    2. Inspect the top scrolling 'LIVE' ticker
  - **Expected:** Ticker shows live matches before finished ones. Live entries have a pulsing red dot and a '<minute>′' tag; finished entries show 'FT'. Each entry shows home flag/code, 'homeScore–awayScore', away code/flag. Content is duplicated for a seamless loop. Clicking an entry navigates to /matches/<id>.
  - **Guards:** Match-state handling — LIVE vs FT label correctness
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-10** · `low` — Live ticker is hidden when no live or finished matches exist
  - **Precondition:** Pre-tournament or all fixtures SCHEDULED (none live, none finished)
  - **Steps:**
    1. Open / before any match has kicked off
    2. Look for the LIVE ticker at the top
  - **Expected:** The ticker component renders nothing (returns null) — there is no empty ticker bar. The briefing hero becomes the first visible block.
  - **Guards:** Edge case — empty live/finished set
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HOME-11** · `low` — Title contenders and right-rail widgets show grounded numbers
  - **Precondition:** Active tournament with forecasts, power rankings, golden boot, and insights computed
  - **Steps:**
    1. Open /
    2. Read 'Title Contenders', 'Power Rankings', 'Golden Boot Race', and 'AI Insights'
  - **Expected:** Title Contenders lists up to 6 teams with win-title percentages and a MetricBar; the top bar is the longest. Power Rankings lists top 5 with rank, team, and a power rating number. Golden Boot Race lists 5 players with 'currentGoals → projectedGoals' (player name falls back to playerId only if the view is missing). AI Insights shows up to 4 stories with a title and 2-line clamped body. No placeholder '0%' fills or empty names for resolved entities.
  - **Guards:** Undefined player lookups — golden boot falls back to id, must still render
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Live  ·  7 cases

- [ ] **LIVE-01** · `high` — In Play panel count matches the rendered live cards
  - **Precondition:** Active tournament with one or more LIVE matches whose teams resolve
  - **Steps:**
    1. Open /live
    2. Read the 'In Play' panel subtitle and count the cards
  - **Expected:** Subtitle reads '<N> matches live' where N equals liveMatches().length (only fixtures with BOTH teams resolved are counted/shown). The number of rendered MatchCards equals N. Each live card shows a red LiveDot + current '<minute>′' and the live score, not a kickoff time.
  - **Guards:** Match-state handling + undefined team filtering
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **LIVE-02** · `high` — Empty In-Play state shows guidance, not a blank panel
  - **Precondition:** No matches currently LIVE (between fixtures)
  - **Steps:**
    1. Open /live when nothing is in play
    2. Read the 'In Play' panel
  - **Expected:** Subtitle reads '0 matches live'. Body shows the EmptyState text exactly: 'No matches are live right now. Check the schedule below.' The 'Up Next' panel still lists scheduled fixtures below.
  - **Guards:** Edge case — empty live set must not 500 or render blank
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **LIVE-03** · `high` — HALFTIME match still shown as live on the live page card
  - **Precondition:** A match in HALFTIME status with resolved teams
  - **Steps:**
    1. Open /live with a match at half-time
    2. Inspect its card in 'In Play' (if liveMatches includes HALFTIME) and the displayed label
  - **Expected:** MatchCard treats HALFTIME as live (live = status LIVE or HALFTIME), so the card shows the LiveDot and the stored minute with the current score (not 'vs', not 'FT'). VERIFY liveMatches()/getLiveMatches() includes HALFTIME fixtures; if a half-time match is missing from In Play but appears nowhere else, flag it.
  - **Guards:** Match-state handling — HALFTIME must not be mislabeled as scheduled or finished
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **LIVE-05** · `high` — Live refresh: score, minute, and status update without reload
  - **Precondition:** A match actively in play; page revalidates every 15s (export const revalidate = 15)
  - **Steps:**
    1. Open /live on an in-play match
    2. Note the current score and minute
    3. Wait through at least one revalidation cycle (>15s) during which a goal is scored or the minute advances
    4. Re-read the card
  - **Expected:** After revalidation the card reflects the new minute and/or updated score from the feed. The 'In Play' count updates if a match starts/ends. No stale snapshot lingers beyond the revalidate window.
  - **Guards:** Live refresh — score/minute must advance; stale-index regression
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **LIVE-06** · `high` — Match flipping to FINISHED leaves In Play and appears as FT
  - **Precondition:** A live match about to reach full time
  - **Steps:**
    1. Open /live with the match in play
    2. Wait for the feed to flip the match to FINISHED
    3. Re-read /live and the home ticker
  - **Expected:** Once FINISHED, the match drops out of the 'In Play' panel (count decremented). It no longer shows a live minute anywhere; on cards it shows 'FT' and the final score with the winner's name bolded. The match no longer appears in 'Up Next' either.
  - **Guards:** Live refresh + match-state transition LIVE→FINISHED
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **LIVE-07** · `high` — Live page survives the live-load window with hollow feed entries
  - **Precondition:** Immediately post-deploy: live feed returns fixtures whose team ids are not yet in the store
  - **Steps:**
    1. Open /live during the first ~60s after deploy
    2. Observe In Play and Up Next
  - **Expected:** liveMatches() and the upcoming map both filter to fixtures where home AND away resolve, so hollow entries are silently dropped. The page renders with whatever resolves (possibly an empty In Play with the EmptyState). No 'Cannot read properties of undefined' crash and no 500-content.
  - **Guards:** Undefined team lookups crashing during live-load window
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **LIVE-04** · `medium` — Up Next lists scheduled fixtures with prediction bars
  - **Precondition:** Active tournament with SCHEDULED fixtures whose teams resolve
  - **Steps:**
    1. Open /live
    2. Inspect the 'Up Next' panel
  - **Expected:** Up to 9 scheduled fixtures, each as a MatchCard showing the LocalTime kickoff (no score; 'vs'-style) and a prediction ProbBar with home/draw/away percentages. Only fixtures with both teams resolved appear (TBD slots filtered out before slicing).
  - **Guards:** Undefined team lookups on TBD fixtures
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Matches  ·  15 cases

- [ ] **MATCH-01** · `high` — Matches list groups fixtures by calendar day with correct headers
  - **Precondition:** Active tournament with fixtures spanning multiple days
  - **Steps:**
    1. Open /matches
    2. Inspect the day-grouped panels
  - **Expected:** Each Panel groups matches sharing a kickoff date (kickoff.slice(0,10)), ordered chronologically. Panel title is the dayLabel for that date; subtitle is '<count> matches'. The header badges read '<liveCount> live' and '<played> played' matching the actual LIVE and FINISHED counts among listed (team-resolved) fixtures.
  - **Guards:** Match-state handling — live/played counts must be accurate
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-02** · `high` — TBD knockout fixtures are excluded from the matches list
  - **Precondition:** Bracket partially set; some knockout slots reference unresolved team ids
  - **Steps:**
    1. Open /matches
    2. Scan all day panels for any card showing a blank or 'TBD' team
  - **Expected:** No card with an undefined/TBD team appears — matchesView is filtered by getTeam(home) && getTeam(away) before rendering, and MatchCard non-null assertions only run on already-filtered fixtures. A knockout slot with a TBD side simply has no card. No crash.
  - **Guards:** Undefined team lookups on TBD/knockout fixtures
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-04** · `high` — Kickoff times render in viewer's local zone with correct DAY
  - **Precondition:** A scheduled evening (UTC) fixture that crosses a day boundary in the viewer's timezone; viewer in a North-America zone (e.g. America/Los_Angeles)
  - **Steps:**
    1. Set the browser/OS timezone to America/Los_Angeles
    2. Open /matches and let the page hydrate
    3. Compare an evening-UTC fixture's day grouping vs the time shown on its card after mount
  - **Expected:** On first paint LocalTime shows the UTC-formatted time (deterministic, hydration-safe); after mount it swaps to the viewer's local zone (e.g. a 02:00 UTC kickoff shows as the previous evening local time). The card time reflects local zone. KNOWN TENSION: day-group panels are bucketed by the raw UTC date (kickoff.slice(0,10)), so a late-UTC fixture may sit under a UTC day header while its card shows the local (previous) day — verify whether the grouping day matches the displayed local day; a mismatch is the timezone bug.
  - **Guards:** Timezone — correct local DAY not just time; server/client hydration
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-05** · `high` — Match detail scoreboard shows correct state label per status
  - **Precondition:** Four fixtures available: one SCHEDULED, one LIVE, one HALFTIME, one FINISHED (all team-resolved)
  - **Steps:**
    1. Open /matches/<id> for each of the four states
    2. Read the center scoreboard block
  - **Expected:** SCHEDULED: shows LocalTime kickoff and a muted 'vs' instead of a score; prediction ProbBar + xG/O2.5/BTTS badges shown. LIVE: red LiveDot + '<minute>′' above the live 'home – away' score. FINISHED: 'Full time' label, final score, winner styling, no ProbBar. HALFTIME: NOTE — match detail only special-cases live/finished/scheduled; a HALFTIME status shows neither a minute, 'Full time', nor a kickoff time and DOES show the 'home – away' score (since not scheduled). Confirm this is intended; flag if half-time looks like a scheduled/blank state.
  - **Guards:** Match-state handling — SCHEDULED vs LIVE vs HALFTIME vs FINISHED labels
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-06** · `high` — Match report narrative never declares a winner mid-game
  - **Precondition:** A LIVE match (home leading) and a HALFTIME match available
  - **Steps:**
    1. Open /matches/<id> for the live match
    2. Read the 'Match Report' panel body
    3. Repeat for the half-time match
  - **Expected:** For LIVE: text begins 'Live — <minute>′: ' and uses present-tense state — '<Team> lead <a>–<b>' or 'it's level at <a>–<b>' — and NEVER 'won'. For HALFTIME: text begins 'Live — Half-time: '. Scorers (if any) appended as 'Scorers: <Name> <min>′, ...'. The words 'won' / 'Full time' must NOT appear for a non-finished match.
  - **Guards:** Match-state handling — narrative must not say a team 'won' mid-game
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-09** · `high` — Event timeline renders goals, cards, subs, VAR and offside detail
  - **Precondition:** A LIVE or FINISHED match with a rich event list including GOAL, YELLOW/RED card, SUBSTITUTION, VAR, OWN_GOAL, PENALTY_MISS
  - **Steps:**
    1. Open /matches/<id> for the rich match
    2. Inspect the 'Timeline' panel (subtitle 'Key events')
  - **Expected:** Each row shows minute '<m>′', the correct emoji (⚽ goal/pen/own-goal, 🟨 yellow/second-yellow, 🟥 red, 🔁 sub, 📺 VAR, ❌ pen miss), and the scorer/player name. For VAR, OWN_GOAL, and PENALTY_MISS the detail string is appended after '— ' (e.g. VAR offside review text), since meaning lives in the detail. Home-team events are left-aligned, away-team events right-aligned (flex-row-reverse).
  - **Guards:** Undefined player lookups — VAR/own-goal rows fall back to detail, not a crash
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-10** · `high` — Event row falls back to detail when player is unresolved
  - **Precondition:** An event whose playerId is not in the store (live-load window) or is null (e.g. a VAR/team event)
  - **Steps:**
    1. Open /matches/<id> for a match with such an event
    2. Inspect the corresponding timeline row
  - **Expected:** EventRow uses getPlayer(playerId) which may return null; the row renders 'player?.name ?? event.detail' so it shows the event detail text instead of crashing. No 'undefined' literal and no thrown error. Verify a VAR/team event with no playerId still shows meaningful detail text.
  - **Guards:** Undefined player lookups crashing during live-load
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-12** · `high` — Live timeline grows as new events arrive
  - **Precondition:** A LIVE match; detail page is dynamic (force-dynamic)
  - **Steps:**
    1. Open /matches/<id> for an in-play match and note the number of timeline rows and current score
    2. Wait for a new goal/card/sub to occur and reload (or let revalidation refresh)
    3. Re-count the timeline rows
  - **Expected:** After a new event the timeline gains the corresponding row (with correct minute/emoji/player), the scoreboard minute advances, and a goal updates the live score. The 'Match Report' present-tense state updates accordingly (e.g. lead changes) and still never says 'won'.
  - **Guards:** Live refresh — event timeline growing + minute/score advance
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-14** · `high` — Unknown or TBD match id returns notFound, not a broken page
  - **Precondition:** A match id that does not exist, and a knockout-fixture id whose teams are still TBD
  - **Steps:**
    1. Navigate to /matches/<nonexistent-id>
    2. Navigate to /matches/<tbd-knockout-id> (fixture exists but a team is unresolved)
  - **Expected:** Both trigger Next.js notFound() (matchDetail returns null when the match is missing OR either team is unresolved), rendering the 404 page — NOT a 200 page with undefined team crashes or empty 'undefined v undefined' titles.
  - **Guards:** Undefined team lookups on TBD/knockout fixtures
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-03** · `medium` — Finished card bolds the winner; draw bolds neither
  - **Precondition:** At least one FINISHED match that was decisive and one that was a draw
  - **Steps:**
    1. Open /matches
    2. Find a finished decisive match and a finished drawn match
  - **Expected:** Decisive: the winning team's row is bold/bright (winner = homeScore>awayScore for the home row, vice versa) and shows both scores plus 'FT'. Draw: neither team row is bolded as winner, both scores shown, 'FT'. If decided on penalties, a 'Penalties <h>–<a>' line appears below the scores.
  - **Guards:** Match-state handling — winner styling must not mark a team in a draw
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-07** · `medium` — Finished-match report states result and xG storyline correctly
  - **Precondition:** A FINISHED decisive match and a FINISHED goalless draw, both with team stats
  - **Steps:**
    1. Open /matches/<id> for the finished decisive match
    2. Read 'Match Report'
    3. Repeat for the goalless draw
  - **Expected:** Decisive: '<Winner> won <h>-<a> at <venue>.' followed by 'Scorers: ...' and an 'Underlying numbers:' xG line ending '— the better side won' when the higher-xG team also won, else ', against the run of expected goals.' Goalless: 'It finished level 0-0 ... A goalless affair.' Possession/field-tilt sentence present. No present-tense 'lead'.
  - **Guards:** Match-state handling — FINISHED summary correctness
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-08** · `medium` — Scheduled match shows preview 'What's at stake' instead of report
  - **Precondition:** A SCHEDULED fixture with resolved teams and a prediction
  - **Steps:**
    1. Open /matches/<id> for a scheduled fixture
    2. Confirm which narrative panel appears
  - **Expected:** The 'What's at stake' panel (subtitle 'Why this one matters') is shown — NOT the 'Match Report' panel — because preview is non-null only for SCHEDULED. It lists uppercase stake tags and a grounded blurb (e.g. 'The model favours <Team> at <pct>%, with <x.x> goals expected.'). The 'vs' scoreboard and prediction badges are present.
  - **Guards:** Match-state handling — SCHEDULED routes to preview, others to report
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-13** · `medium` — Match stats and shot maps shown only when stats exist
  - **Precondition:** One match with full team stats and shots, one degraded-source match lacking team stats (e.g. datahub historical, no xG)
  - **Steps:**
    1. Open /matches/<id> for the full-stats match
    2. Open /matches/<id> for the degraded match
  - **Expected:** Full match: 'Match Stats' panel lists Possession%, Shots, On target, xG, Big chances, Corners, Field tilt%, Pass acc.%, PPDA, Fouls with a two-colour comparison bar; two Shot Map panels appear when shots exist, each titled '<Team> — Shot Map' with the shot count. Degraded match: when team stats are absent, the Match Stats panel and shot maps are omitted entirely (no zero-filled rows, no empty chart). Page still renders report/preview.
  - **Guards:** Edge case — missing stats from degraded source must not render hollow widgets
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-11** · `low` — Empty timeline shows placeholder for a scheduled match
  - **Precondition:** A SCHEDULED match with no events yet
  - **Steps:**
    1. Open /matches/<id> for a not-yet-started fixture
    2. Read the Timeline panel
  - **Expected:** Timeline panel body shows centered text 'No events yet.' rather than an empty list or error.
  - **Guards:** Edge case — empty events array
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **MATCH-15** · `low` — Halftime score line and penalties display on scoreboard
  - **Precondition:** A match with non-zero half-time score and (separately) a knockout match decided on penalties
  - **Steps:**
    1. Open /matches/<id> for a match where homeScoreHT+awayScoreHT > 0
    2. Open /matches/<id> for a penalty-decided knockout match
  - **Expected:** When HT goals exist the scoreboard shows 'HT <h>–<a>' beneath the score. For a penalty result it shows 'pens <home>–<away>'. Neither appears (no '0–0 HT', no 'pens') when not applicable.
  - **Guards:** Edge case — conditional scoreboard annotations
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Standings  ·  8 cases

- [ ] **STND-01** · `high` — Group table ordering follows FIFA tiebreakers (points → GD → GF)
  - **Precondition:** A live/edition with at least one group where two teams are level on points.
  - **Steps:**
    1. Open /standings.
    2. Pick a group where the top teams share the same Pts value.
    3. Compare the displayed row order against the underlying results.
  - **Expected:** Rows are sorted by Points descending; ties broken by Goal Difference descending, then Goals For descending. When still tied, head-to-head points/GD/GF among the tied teams decides, then fewer disciplinary points, then a stable team-id order. The rendered '#' column equals 1..N in that exact order with no duplicate or skipped ranks.
  - **Guards:** Do not assume alphabetical or ELO order; verify against computeGroupStandings sort logic.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-03** · `high` — Qualification status dots only appear once all 3 group games are played
  - **Precondition:** An edition mid-group-stage where at least one group has every team on played<3 and another group fully complete.
  - **Steps:**
    1. Open /standings.
    2. Find a group where every team has Pl<3.
    3. Find a group where every team has Pl=3.
  - **Expected:** In the incomplete group all status dots render in the neutral 'bg-terminal-border' color (status=null). In the complete group, ranks 1-2 show the green Qualify dot (Q), rank 3 the amber Thirds-race dot (T), rank 4 the red Out dot (E).
  - **Guards:** allPlayed gate requires played>=3 for EVERY team in the group, not just played matches existing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-04** · `high` — Early tournament (0 games played) does not rank everyone identically or divide-by-zero
  - **Precondition:** Switch to an edition/state where a group has 0 finished matches (all teams Pl=0, Pts=0, GD=0).
  - **Steps:**
    1. Open /standings before any group match has finished.
    2. Inspect the all-zero group's rows and the xG line.
  - **Expected:** Table renders with Pl=0, Pts=0, GD=0 for all teams, ranks 1..4 assigned via the stable team-id fallback (no crash, no NaN). No status dots (all neutral). Q% may be present from the simulator but must be a finite percentage, never 'NaN%'. xG line shows '0.0 / 0.0' only if that source genuinely has xG=0 (see degradation case), otherwise blank.
  - **Guards:** Per-team divisions (xG aggregation) must not divide by played; played can be 0.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-05** · `high` — xG For/Against line reflects real summed xG, not placeholder zeros
  - **Precondition:** SportMonks/advanced-metrics edition (DATA_SOURCE=sportmonks) with finished matches.
  - **Steps:**
    1. Open /standings on the live-2026 advanced source.
    2. Read the 'xG x.x / y.y' line under a group with completed matches.
  - **Expected:** Each team's xG For and xG Against are non-trivial decimals (one decimal place) summed across its matches, and differ team-to-team. A team that played and created chances shows xGFor>0. Values match the sum of m.teamStats[team].xG across that group's counted matches, rounded to 1 dp.
  - **Guards:** Must NOT show '0.0 / 0.0' for every team when the source has xG.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-06** · `high` — Graceful degradation: historical datahub editions hide/blank xG, never 0.0/0.0 for all
  - **Precondition:** Switch to a datahub historical edition (e.g. 1930-2015) which has no xG.
  - **Steps:**
    1. Switch the tournament to a datahub edition.
    2. Open /standings and inspect the xG line for every team across multiple groups.
  - **Expected:** The xG For/Against column is hidden or blank for these editions. It must NOT render '0.0 / 0.0' uniformly for every team, which would falsely imply measured-zero xG. Points/GD/GF columns still populate correctly from real historical results.
  - **Guards:** Distinguish 'no metric available' from 'metric measured as zero'.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-07** · `high` — Best Third-Placed Teams ranking and top-8 qualify cutoff
  - **Precondition:** An edition in 48-team format with 12 groups and third-placed teams resolved.
  - **Steps:**
    1. Open /standings and scroll to 'Best Third-Placed Teams'.
    2. Verify ordering and the Qualifies/Out badges.
  - **Expected:** Third-placed teams are ordered by Points desc, then GD desc, then GF desc, then fewer disciplinary points, then team-id. The first 8 rows are highlighted and show a green 'Qualifies' badge; rows 9+ show a red 'Out' badge. Rank numbers run 1..N.
  - **Guards:** rankBestThirds uses goalDifference/goalsFor on the StandingRow, not raw accumulators.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-02** · `medium` — GD column sign formatting (+N for positive, raw for 0/negative)
  - **Precondition:** A group with teams having positive, zero, and negative goal differences.
  - **Steps:**
    1. Open /standings.
    2. Inspect the GD cell for a team with GD>0, one with GD=0, and one with GD<0.
  - **Expected:** GD>0 shows a leading '+' (e.g. '+3'); GD=0 shows '0' (no '+'); GD<0 shows the negative value (e.g. '-2'). Values equal goalsFor minus goalsAgainst exactly.
  - **Guards:** GD must equal GF-GA, not points-derived.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STND-08** · `medium` — Live/halftime matches count toward played but not W/D/L until finished
  - **Precondition:** An edition with at least one LIVE or HALFTIME group match.
  - **Steps:**
    1. Open /standings during a live group match.
    2. Inspect the two teams' Pl, W/D/L, GF/GA, and points.
  - **Expected:** Both live teams' Pl is incremented and their current GF/GA (and xG) include the live match, but W/D/L counters and Points are NOT updated until the match is FINISHED. Form string does not yet show a letter for the in-progress game.
  - **Guards:** countsAsPlayed includes LIVE/HALFTIME; points/result only on FINISHED.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Groups  ·  4 cases

- [ ] **GRP-01** · `high` — Groups page W/D/L columns reconcile with Played and Points
  - **Precondition:** An edition with finished group matches.
  - **Steps:**
    1. Open /groups.
    2. For several teams verify W + D + L against Pl, and 3*W + D against Pts.
  - **Expected:** For every row W+D+L equals the number of FINISHED games (<= Pl), and Points equals 3*W + D exactly. Pl may exceed W+D+L only when a LIVE/HALFTIME match is in progress.
  - **Guards:** Points must never include live-match results.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GRP-04** · `high` — Tournament switching refreshes group tables to the NEW edition
  - **Precondition:** At least two editions available in the switcher.
  - **Steps:**
    1. Open /groups on edition A and note the group names and teams.
    2. Switch to edition B via the tournament switcher.
    3. Reload/observe /groups.
  - **Expected:** Group names, team rosters, fixtures, standings, and Q% all reflect edition B. No stale edition-A team, group, or forecast remains. (memory: indexes keyed to snapshot identity to avoid stale cross-instance data.)
  - **Guards:** Verify no empty render after swap (stale-index bug class).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GRP-02** · `medium` — Each group shows its own fixtures with correct home/away teams
  - **Precondition:** Any edition with scheduled/finished group fixtures.
  - **Steps:**
    1. Open /groups.
    2. Cross-check the fixture rows under a group against that group's teams.
  - **Expected:** Every fixture listed under a group involves only teams belonging to that group. Home/away flags and codes match the match's homeTeamId/awayTeamId. No fixture from another group leaks in.
  - **Guards:** matchesView({groupId}) must filter by groupId; getTeam lookups must not crash on undefined (memory: no '!' assumptions).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GRP-03** · `medium` — Q% on groups page matches the Monte Carlo reachR32 forecast
  - **Precondition:** Forecasts computed for the active edition.
  - **Steps:**
    1. Open /groups and note a team's Q%.
    2. Open /standings and compare the same team's Q% and reachR32 value.
  - **Expected:** The Q% on /groups equals pct(qualificationProbability) which is sourced from forecasts.reachR32 for that team, and is identical to the value on /standings. It is a finite 0-100% value, never 'NaN%' or blank.
  - **Guards:** qualificationProbability is injected from the simulator, defaulting to 0 only if forecast missing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Rankings  ·  5 cases

- [ ] **RANK-01** · `high` — Power rankings sorted descending by powerRating with sequential ranks
  - **Precondition:** Active edition with forecasts computed.
  - **Steps:**
    1. Open /rankings.
    2. Read the Power column top to bottom and the '#' column.
  - **Expected:** Power values are monotonically non-increasing down the table. The '#' rank column is 1..N with no gaps/dups. The top row's MetricBar is the widest. powerRating is bounded 0-100 (clamped).
  - **Guards:** rows.sort by powerRating desc; rank = index+1.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **RANK-03** · `medium` — Momentum is 0 for teams with no finished matches (early tournament)
  - **Precondition:** Edition where some teams have played 0 finished matches.
  - **Steps:**
    1. Open /rankings before a team has any finished game.
    2. Read that team's Momentum cell.
  - **Expected:** Momentum shows '0' (rendered neutral/muted) for teams with no finished matches — teamMomentum returns 0 when played.length is 0. No NaN. Momentum is an integer in [-100, 100].
  - **Guards:** weight floor Math.max(weight,1) prevents divide-by-zero.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **RANK-04** · `medium` — Offense/Defense ratings use per-game xG without divide-by-zero at 0 games
  - **Precondition:** Mix of teams with 0 and >0 finished games.
  - **Steps:**
    1. Open /rankings.
    2. Compare Offense/Defense for a 0-game team vs a multi-game team.
  - **Expected:** All Offense/Defense values are finite numbers in [0,100] (clamped, 1 dp). For 0-game teams the games divisor is floored at 1 so xG-per-game is 0 and ratings collapse toward the rating-based baseline (~50 + attack/defense adjustment), not NaN.
  - **Guards:** games = Math.max(played.length,1).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **RANK-05** · `medium` — Degraded source (no xG) still produces sane power ranking, no NaN
  - **Precondition:** Historical datahub edition without xG.
  - **Steps:**
    1. Switch to a datahub edition and open /rankings.
  - **Expected:** Power, Offense, Defense, ELO, and Momentum all render finite numbers. xG terms contribute 0 (teamStats[...]?.xG ?? 0) rather than NaN. Ranking is driven by ELO tier + deep-run equity. No '0.0' uniform offense/defense for every team unless genuinely identical inputs.
  - **Guards:** Missing xG must degrade to 0 contribution, not break the formula.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **RANK-02** · `low` — Trend arrows reflect rank change vs previous snapshot
  - **Precondition:** A previous-rank map exists (or defaults applied on first load).
  - **Steps:**
    1. Open /rankings.
    2. Inspect trend arrows next to several teams.
  - **Expected:** Up arrow (green) when current rank < previousRank, down arrow (red) when rank > previousRank, flat dash when equal. On first computation with no previous data, all trends are flat (previousRank defaults to current rank).
  - **Guards:** previous?.get default equals current rank, so no false up/down on cold start.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Bracket  ·  6 cases

- [ ] **BRKT-01** · `high` — Unseeded/TBD knockout slots render 'TBD' and do not crash the engine
  - **Precondition:** Early tournament where qualifiers are not yet resolved (bracket must pad with placeholders).
  - **Steps:**
    1. Open /bracket before the group stage completes.
    2. Inspect R32 sides that have no resolved team.
  - **Expected:** Empty slots show the white-circle flag '⚪' and the name 'TBD' with the seed label 'TBD'. No crash, no undefined-team error, no broken layout. homeTeamId/awayTeamId are null for those sides.
  - **Guards:** memory: never use '!' on team lookups; buildBracket pads with {teamId:'',label:'TBD'} and Side falls back to 'TBD'.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BRKT-02** · `high` — Bye/one-sided ties advance the present side with 100%/0% probabilities
  - **Precondition:** A bracket node where exactly one side is TBD/empty and the other is a real team.
  - **Steps:**
    1. Open /bracket.
    2. Find a tie with one real team and one TBD.
  - **Expected:** The real team's advance probability shows 100% and TBD shows 0% (homeProb=1 when only home present, 0 when only away present). The real team is highlighted as winner; TBD is never marked winner (winner flag requires a non-null team).
  - **Guards:** homeProb set to 1/0 for single-sided slots; winner flag gated by !!node.home/!!node.away.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BRKT-03** · `high` — Each tie's two advance probabilities sum to ~100%
  - **Precondition:** Any populated bracket.
  - **Steps:**
    1. Open /bracket.
    2. For several ties add homeAdvanceProb + awayAdvanceProb.
  - **Expected:** homeAdvanceProb + awayAdvanceProb ≈ 1.000 (each rounded to 3dp; displayed percentages sum to ~100%). For two real teams both are strictly between 0 and 1 derived from eloExpectation. No NaN/undefined probabilities.
  - **Guards:** awayAdvanceProb computed as 1-homeProb.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BRKT-06** · `high` — Bracket reflects NEW edition after tournament switch (no stale teams)
  - **Precondition:** Two editions with disjoint team sets.
  - **Steps:**
    1. Open /bracket on edition A; note resolved teams.
    2. Switch to edition B and reopen /bracket.
  - **Expected:** All bracket sides show edition-B teams (or TBD); no edition-A team flag/name remains. Probabilities recomputed from edition-B ELOs. No empty/blank tree from a stale snapshot index.
  - **Guards:** Snapshot identity must drive the rebuild (stale-index bug class).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BRKT-04** · `medium` — Winner propagation: each round's sides are prior round's projected winners
  - **Precondition:** A fully or partially populated bracket.
  - **Steps:**
    1. Open /bracket.
    2. Trace a R32 winner into R16, then QF, etc., via feedsInto slots.
  - **Expected:** The higher-probability side of each tie (homeProb>=0.5 → home, else away) appears as a side in the node its slot feedsInto. The Final has a single tie fed by both SF winners. Tree is fully connected with no orphan slots.
  - **Guards:** winner = homeProb>=0.5 ? home : away; nextSlot wiring.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BRKT-05** · `low` — Bracket stage set adapts to format and matches the simulator
  - **Precondition:** Editions of differing sizes (e.g. 8-group=16-team KO vs 12-group=32-team KO).
  - **Steps:**
    1. Open /bracket on a 12-group edition (expect R32 start).
    2. Switch to an 8-group/16-team-KO edition and reopen /bracket.
  - **Expected:** 12-group edition starts at R32 (16 ties) through FINAL. A smaller format starts at the correct stage (e.g. R16) and omits R32 — only stages with size<=bracketSize appear. Stage headers and node counts match the bracket size.
  - **Guards:** ALL_STAGES filtered by size<=bracketSize.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Predictions  ·  8 cases

- [ ] **PRED-01** · `high` — Title odds across all teams sum to ~100%
  - **Precondition:** Forecasts computed for active edition.
  - **Steps:**
    1. Open /predictions.
    2. Sum winTitle across ALL teams (not just the top 12 shown), via the data source if needed.
  - **Expected:** Sum of every team's winTitle ≈ 1.0 (100%), within Monte Carlo rounding tolerance (~±1%). Each winTitle is a finite probability in [0,1]; the top-12 championship bar chart values are a subset that must be <= the total and individually plausible (favorite single-digit-to-low-double-digit %).
  - **Guards:** Exactly one champion per run over RUNS=8000; no NaN.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-02** · `high` — Stage-reach probabilities are monotonically non-increasing per team
  - **Precondition:** Forecasts computed.
  - **Steps:**
    1. Open /predictions, Stage-Reach Probabilities table.
    2. For each listed team read R16, QF, SF, Final, Win.
  - **Expected:** For every team reachR16 >= reachQF >= reachSF >= reachFinal >= winTitle (a team can't reach a later round more often than an earlier one). All are finite percentages 0-100, none NaN/blank. Win column uses 1-decimal precision.
  - **Guards:** markSize tallies are nested, so reach probabilities must be ordered.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-03** · `high` — Match prediction win/draw/away sum to ~100% with sane scorelines
  - **Precondition:** Any non-finished match prediction is surfaced (match detail or predictions context).
  - **Steps:**
    1. Open a match prediction (homeWin, draw, awayWin and top scorelines).
    2. Add the three outcome probabilities and inspect the scoreline list.
  - **Expected:** homeWin + draw + awayWin ≈ 1.000 (normalized Poisson matrix). The top-6 scorelines are sorted by probability descending, each a non-negative prob, and the most-likely scoreline is consistent with expected goals (e.g. favorite-leaning). expectedGoals.home/away are positive (>=0.18 floor). No NaN.
  - **Guards:** scoreMatrix is normalized (truncation correction); round3 outputs.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-04** · `high` — Golden Boot projection ordering, projected>=current, and win-boot normalization
  - **Precondition:** Players with goals/xG for the active edition.
  - **Steps:**
    1. Open /predictions, Golden Boot Projection table.
    2. Verify ordering by Proj. desc, compare Proj vs G, and sum Win Boot across contenders.
  - **Expected:** Rows ordered by projectedGoals desc (then win prob). No goalkeepers appear (GK filtered). Projected goals >= current goals for each player (future goals are non-negative). Win-Boot probabilities are normalized so they sum to ~100% across all contenders; each is finite 0-100%.
  - **Guards:** winProbability normalized by total; contenders filter excludes GK and low-xG non-scorers.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-06** · `high` — No NaN/undefined anywhere on predictions at 0-games / cold start
  - **Precondition:** Edition state before any match has finished.
  - **Steps:**
    1. Open /predictions immediately at tournament start.
    2. Scan championship chart, stage-reach table, performers, and golden boot.
  - **Expected:** All probabilities render as finite percentages; title odds still sum to ~100%; stage-reach still monotonic; golden boot may be sparse (only players with goals>0 or xG>1) but every shown value is finite. No 'NaN%', 'undefined', or blank numeric cells.
  - **Guards:** Simulator runs from base=0; expectedRemainingGames falls back to groupGamesLeft when forecast missing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-07** · `high` — Predictions reflect NEW edition after tournament switch (no stale forecasts)
  - **Precondition:** Two editions with different favorites.
  - **Steps:**
    1. Open /predictions on edition A; note the championship favorite and golden-boot leader.
    2. Switch to edition B and reopen /predictions.
  - **Expected:** Championship bar chart, stage-reach table, performers, and golden boot all show edition-B teams/players and recomputed odds. No edition-A favorite or player lingers; title odds for B still sum to ~100%.
  - **Guards:** Engine snapshot cleared on store.setDataset; stale-index bug class.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-05** · `medium` — Over-/Under-Performers delta equals Now minus Pre-WC
  - **Precondition:** preTournamentTitleOdds present per team.
  - **Steps:**
    1. Open /predictions, Over- & Under-Performers panel.
    2. For listed teams compute Now - Pre-WC and compare to the Δ badge.
  - **Expected:** Δ badge equals winTitle minus preTournamentTitleOdds (titleProbabilityDelta), green '+' when >=0, red when <0. The panel shows the top-5 risers and bottom-5 fallers sorted by delta. Pre-WC and Now are finite percentages.
  - **Guards:** titleProbabilityDelta = round3(winTitle - preTournamentTitleOdds).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PRED-08** · `low` — Golden Boot degrades gracefully on sources without xG
  - **Precondition:** Historical/degraded edition with goals but no xG.
  - **Steps:**
    1. Switch to a datahub edition and open /predictions Golden Boot panel.
  - **Expected:** xG column is blank/zeroed without breaking projection; projection falls back toward actual goals (goalRate90 blend still finite). Win-Boot probs remain normalized to ~100%. The contender filter (goals>0 or xG>1) means players surface via real goals, not phantom xG.
  - **Guards:** currentXG ?? handling; projection must not NaN when xG=0.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Teams  ·  9 cases

- [ ] **TEAM-01** · `high` — Teams list groups every nation under its confederation in fixed order
  - **Precondition:** Active dataset is the live-2026 edition (DATA_SOURCE=sportmonks) with all 48 nations loaded.
  - **Steps:**
    1. Navigate to /teams.
    2. Observe the panel headers from top to bottom.
    3. Within one panel, note the confederation label and the teams listed beneath it.
    4. Cross-check 2-3 teams against a known mapping (e.g. Brazil under CONMEBOL, Japan under AFC).
  - **Expected:** Panels render in the order UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC (only confederations that have teams). Each team appears under exactly one panel matching its confederation. Each panel subtitle shows the correct team count. No team is missing or duplicated across panels.
  - **Guards:** CONF_ORDER drives ordering and groups with zero teams are dropped; assert the union of all panels equals the full team list.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-02** · `high` — Teams actually render on a HISTORICAL edition (confederation grouping must not empty the page)
  - **Precondition:** Switch the active tournament to a historical datahub edition (e.g. men-1930 or men-1986) via the tournament switcher.
  - **Steps:**
    1. Switch to a historical edition.
    2. Navigate to /teams.
    3. Confirm at least one confederation panel is present and populated with team cards.
  - **Expected:** At least one populated confederation panel renders with clickable team cards. The page is NOT empty. This guards the regression where confederation grouping emptied the entire /teams page on historical editions.
  - **Guards:** Repeat for both a live edition (TEAM-01) and a historical edition; both must show teams. If a historical source lacks confederation tagging, teams must still appear under some grouping rather than vanishing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-07** · `high` — Team detail fixtures rows resolve home/away teams without crashing mid-load
  - **Precondition:** Open a team detail page during the live-load window (snapshot may be swapping).
  - **Steps:**
    1. Navigate to a team detail page immediately after a tournament switch / live refresh.
    2. Observe the Fixtures panel rows.
  - **Expected:** Each fixture row renders both opponents. The page does not throw even though MiniMatchRow uses getTeam(m.homeTeamId)! — i.e. once the snapshot is consistent every referenced team resolves. If a match references an unresolved team the page must not white-screen.
  - **Guards:** Regression watch: non-null assertions on getTeam in fixtures can crash during the live-load window before indexes self-heal to the new snapshot.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-03** · `medium` — Team card shows group, FIFA rank, power rank badge, and title odds
  - **Precondition:** On /teams for the live edition.
  - **Steps:**
    1. Pick a top-ranked team card.
    2. Read the secondary line (Group X · FIFA #N).
    3. Confirm the power-rank badge (#rank) is present when a power ranking exists.
    4. Read the Title odds percentage and confirm the metric bar width tracks it.
  - **Expected:** Group id and FIFA ranking are shown. Power-rank badge appears only when powerRanking is present (absent, not '#undefined', when missing). Title odds render as a percentage; bar reflects the value (scaled to max 15%). A team with 0/undefined forecast shows 0% rather than NaN/blank.
  - **Guards:** forecast?.winTitle ?? 0 must yield 0%, never NaN, when the forecast is missing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-04** · `medium` — Team detail header shows manager, ELO, FIFA rank and power rank correctly composed
  - **Precondition:** Open a live-edition team with a known manager and ELO.
  - **Steps:**
    1. Navigate to /teams/[id] for that team.
    2. Read the subtitle line under the team name.
    3. Verify each present field is joined by ' · ' with no empty segments.
  - **Expected:** Subtitle shows 'Managed by <name>' only when manager is set and not '—', 'FIFA #N' only when fifaRanking is truthy, 'ELO <value>' always, and 'Power rank #N' only when powerRanking exists. No stray ' · · ' separators or 'Managed by —'.
  - **Guards:** Falsy fields are filtered out before join; a source with no manager must not print 'Managed by undefined'.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-05** · `medium` — Team detail squad table groups players by position GK→DF→MF→FW with stats
  - **Precondition:** Open a team detail page with a full squad.
  - **Steps:**
    1. Scroll to the Squad panel.
    2. Read down the Pos column.
    3. Confirm rows are ordered GK first, then DF, MF, FW.
    4. Spot-check a player's number, age, OVR, minutes, goals, assists, xG.
  - **Expected:** Players appear grouped strictly in GK, DF, MF, FW order. Each row shows shirt number, detailed position, age, overall rating, minutes, goals, assists, and xG (1 decimal). Squad panel subtitle count equals the number of rendered rows.
  - **Guards:** positions.flatMap order is fixed; a player with an unrecognised position would be silently dropped — assert rendered row count equals squad length.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-06** · `medium` — Team detail tournament outlook + group position render real Monte Carlo values
  - **Precondition:** Open a team that has a forecast and a standing.
  - **Steps:**
    1. Read the six Tournament Outlook rows (Qualify R32 → Champions).
    2. Confirm each percentage is monotonically non-increasing down the funnel for a normal team.
    3. Read the Group Position panel: rank ordinal, points, W-D-L, goals, xG, qualification probability.
  - **Expected:** Outlook percentages render (0% when forecast missing, not NaN). Group panel shows ordinal rank (1st/2nd...), points, correct W-D-L/goals split, xG to 1 decimal, and a qualification probability percentage. Qualified/Thirds race/Eliminated badge matches status Q/T/E.
  - **Guards:** When standing is null the panel shows 'No group data.' rather than crashing on s.rank.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-09** · `medium` — Degraded source: team xG column shows graceful value, not fabricated numbers
  - **Precondition:** Switch to a historical/datahub edition that lacks xG (degraded, no advanced metrics).
  - **Steps:**
    1. Open a team detail page.
    2. Read the squad table xG column and the Group Position xG stat.
  - **Expected:** On a source without xG, xG values are 0.0 uniformly (and must not be presented as a meaningful ranking). The page renders without implying these are real measured xG numbers; no NaN.
  - **Guards:** hasAdvancedMetrics=false; xG should be visibly inert (all 0.0) rather than randomly fabricated.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **TEAM-08** · `low` — Unknown team id returns notFound, not a crash
  - **Precondition:** App running on any edition.
  - **Steps:**
    1. Navigate to /teams/this-id-does-not-exist.
    2. Observe the response.
  - **Expected:** The Next.js notFound() 404 page renders. No 500 / stack trace.
  - **Guards:** teamView returns undefined → notFound().
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Players  ·  14 cases

- [ ] **PLYR-01** · `high` — Players list defaults to sort by goals (descending)
  - **Precondition:** On /players for the live edition; default controls untouched.
  - **Steps:**
    1. Navigate to /players and wait for 'Loading players…' to clear.
    2. Read the G (goals) column top to bottom for the first ~15 rows.
  - **Expected:** Sort selector defaults to 'Goals'. Rows are ordered by goals descending (the top scorer is row 1). The leading '#' column is a 1-based display index, not a stored rank.
  - **Guards:** Default sort state is 'goals'; API called with sort=goals.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-05** · `high` — Player detail per-90 / percentile bars do not divide-by-zero at 0 minutes
  - **Precondition:** Open a player who has 0 minutes played (early tournament or unused squad member).
  - **Steps:**
    1. Navigate to /players/[id] for a 0-minute player.
    2. Inspect the Percentile Rankings bars and the radar chart.
    3. Inspect the headline Stat tiles (Goals/Assists/xG/xA/Minutes).
  - **Expected:** Page renders with no NaN/Infinity. Per-90 uses minutes floored to 1 internally so values are finite. Minutes tile reads 0. Percentile bars render finite widths (0-100). The player is not crashed out, and not ranked identically to everyone.
  - **Guards:** per90 uses Math.max(stats.minutes, 1); emptyStatsFor supplies zeros when no stats row exists.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-06** · `high` — Percentiles never rank everyone identically when a metric is uniformly zero
  - **Precondition:** Active source lacks an advanced metric (e.g. pressuresApplied all zero across the field).
  - **Steps:**
    1. Open a player detail page on that source.
    2. Look for a Pressures / Prog. passes / xA row in Percentile Rankings and the radar axes.
  - **Expected:** Metrics that are uniformly 0 across all positional peers are OMITTED entirely from percentile rows and the radar (not shown as a false 0th-percentile weakness). Metrics that DO vary still show a real percentile. The radar only plots axes that exist in p.percentiles.
  - **Guards:** store omits a metric when sorted[0]===0 && sorted[last]===0 (WC-016). percentileRows/radarDef filter on percentiles[key] != null.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-08** · `high` — Advanced metrics are HIDDEN on sources that lack them (no fabricated weakness)
  - **Precondition:** Switch to a degraded source (hasAdvancedMetrics=false, e.g. datahub historical).
  - **Steps:**
    1. Open a player detail page.
    2. Inspect Percentile Rankings, the radar, and the Scouting Report development areas.
  - **Expected:** xG, xA, progressive passes/carries, pressures rows are absent from the percentile list and radar. The scouting 'Development areas' never lists an advanced metric as a 0th-percentile weakness. If no advanced traits qualify, weaknesses falls back to 'No glaring weaknesses in the sample.'
  - **Guards:** Both store-level omission and the label filter prevent advanced metrics from surfacing as fake weaknesses on degraded sources.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-10** · `high` — Breakout/young-player flag triggers only for KNOWN ages 17–23, never a 25-year-old or age 0
  - **Precondition:** Active edition has insights/storylines surfaced (home/discoveries pages reference breakout & 'Breakout Star').
  - **Steps:**
    1. Open the insights/storyline surface that lists breakout players.
    2. For each flagged 'breakout'/'Breakout Star' entry, read the displayed age.
    3. Confirm no player aged 24+ is flagged as breakout.
    4. On a source where age is unknown (0), confirm no breakout entries are produced from those players.
  - **Expected:** Breakout insights only include players with age between 17 and 23 (storylines bucket 17–22) AND minutes ≥ 90. A 25-year-old is never flagged. An age-0/unknown player is never flagged as a young breakout, since 0 fails the >=17 lower bound.
  - **Guards:** narratives breakout filter: age >= 17 && age <= 23 && minutes >= 90; storylines breakout: age 17–22. The lower bound is what prevents age-0 from passing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-11** · `high` — Player whose team is mid-resolving does not crash the detail page
  - **Precondition:** Trigger a player view during the live-load window where the player's team may not yet be in the index.
  - **Steps:**
    1. Open /players/[id] right as the dataset snapshot swaps (tournament switch / live refresh).
    2. Confirm the page either renders fully or 404s — never throws.
  - **Expected:** getPlayerView returns undefined when the team is unresolved, so the player is omitted from list views and the detail page resolves to notFound() rather than crashing. No 'cannot read property of undefined' on team. Once the snapshot is consistent the page renders normally.
  - **Guards:** getPlayerView: `const team = getTeam(player.teamId); if (!team) return undefined;` — never use ! on team lookups.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-02** · `medium` — Position filter chips and sort selector re-query and reset the visible window
  - **Precondition:** On /players.
  - **Steps:**
    1. Click the 'Forwards' position chip.
    2. Confirm only FW players are listed.
    3. Change Sort to 'Assists'.
    4. Confirm ordering switches to assists-descending and the list resets to the first 80.
    5. Click 'Show more' and confirm 120 more rows append.
  - **Expected:** Position chip filters rows to the selected position only. Sort change re-fetches and reorders. Changing filter/sort/query resets visible window to 80. 'Show more' increases the window by 120 and only appears while filtered.length > visible.
  - **Guards:** visible resets to 80 on [position, sort, query] change.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-04** · `medium` — Players list xG/xA columns default to 0.0 safely
  - **Precondition:** On /players for a source that may omit xG/xA.
  - **Steps:**
    1. Inspect the xG and xA columns for several rows.
    2. Include a player with no recorded shots/minutes.
  - **Expected:** xG and xA render to 1 decimal, falling back to 0.0 via (xG ?? 0) when the field is missing. No NaN, undefined, or blank cells.
  - **Guards:** (p.stats.xG ?? 0).toFixed(1) guards missing advanced metrics.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-07** · `medium` — Modeled metrics (xA) are labeled '(est.)' in radar, percentile rows, and scouting traits
  - **Precondition:** Active source lists xA (and any other modeled key) in datasetMeta().modeledMetrics.
  - **Steps:**
    1. Open a player whose source models xA.
    2. Read the radar axis labels, the Percentile Rankings row labels, and the Scouting Report strengths/weaknesses wording.
  - **Expected:** Every modeled metric label carries the '(est.)' suffix (e.g. 'xA (est.)', 'creativity (xA) (est.)'). Measured metrics have no suffix. The suffix is consistent across radar, percentile list, and scouting text.
  - **Guards:** est(base, key) appends '(est.)' iff key ∈ modeledMetrics; applied in page.tsx and narratives.ts.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-09** · `medium` — Player detail age/height fields only show when known; unknown age (0) is hidden
  - **Precondition:** Open a player from a source where age/height may be 0/unknown.
  - **Steps:**
    1. Open /players/[id] for a player with age=0 and/or heightCm=0.
    2. Read the metadata subtitle line under the name.
  - **Expected:** 'Age N' is shown only when age is truthy; '<n>cm' only when heightCm is truthy. A player with unknown age shows no 'Age 0'. Foot is always shown. No empty ' · · ' separators.
  - **Guards:** p.age ? `Age ${p.age}` : null and p.heightCm ? ... : null filter falsy values before join.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-03** · `low` — Name filter is case-insensitive substring and shows empty-state when no match
  - **Precondition:** On /players with data loaded.
  - **Steps:**
    1. Type a known surname in lowercase into the name filter.
    2. Confirm matching players appear and the 'Showing X of Y' count updates.
    3. Type a nonsense string (e.g. 'zzzzzz').
    4. Observe the table body.
  - **Expected:** Filter matches case-insensitively on substring. With no matches the table shows 'No players match your filters.' (not a blank table or spinner). The count line reads 'Showing 0 of 0'.
  - **Guards:** Empty result must render the explicit no-match row, distinct from the loading row.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-12** · `low` — Scouting report summary degrades cleanly with missing club/value/age
  - **Precondition:** Open a player with club='—', marketValueEur=0, age unknown.
  - **Steps:**
    1. Read the Scouting Report summary sentence and the badges below it.
  - **Expected:** Summary omits the club parenthetical when club is '—', omits the age prefix when age is 0, and omits the market-value sentence when value is 0. The 'Market value' badge is hidden when marketValueEur <= 0. No '€0m' or '(—)' artifacts.
  - **Guards:** agePart/clubPart/valuePart conditionals; market badge gated on marketValueEur > 0.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-13** · `low` — Shot map shows real shots or explicit empty-state
  - **Precondition:** Open one player with shots and one with none (or a no-shot-data source).
  - **Steps:**
    1. Open a player known to have shots; confirm the Shot Map renders points and the subtitle '<n> shots · <g> goals'.
    2. Open a player with zero shots; observe the panel.
  - **Expected:** With shots, the map renders and the subtitle counts match the shots/goals. With no shots, the panel shows 'No shots recorded yet.' rather than an empty/broken chart. On a hasShotData=false source, players show the empty-state.
  - **Guards:** shots.length > 0 gate.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **PLYR-14** · `low` — Unknown player id returns notFound
  - **Precondition:** App running.
  - **Steps:**
    1. Navigate to /players/nonexistent-id.
    2. Observe response.
  - **Expected:** notFound() 404 renders, no 500.
  - **Guards:** playerDetail returns undefined → notFound().
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Compare  ·  7 cases

- [ ] **CMP-01** · `high` — Compare two players side by side with default metrics and best-value highlighting
  - **Precondition:** On /compare in players mode.
  - **Steps:**
    1. Search and add player A, then player B (2 players selected).
    2. Read the comparison rows for default metrics (goals, assists, xG, xA, key passes, form).
    3. Confirm each metric's better value is highlighted (teal/bold).
  - **Expected:** Two columns render with portraits, names linking to /players/[id], and one row per default metric. The higher value per row is highlighted, EXCEPT when both values are equal (no highlight when all tie). xG/xA show 1 decimal; integer metrics show no decimals.
  - **Guards:** isBest excludes the case where every column equals best (vals.filter(==best).length < selected.length).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **CMP-03** · `high` — Compare two teams side by side; lower-is-better metric highlights correctly
  - **Precondition:** On /compare; switch mode to Teams.
  - **Steps:**
    1. Switch to Teams mode (selection clears).
    2. Add two teams.
    3. Read default team metrics (win title, power, offense, defense, ELO).
    4. Enable the 'FIFA rank' metric and confirm the LOWER FIFA rank is highlighted as best.
  - **Expected:** Team rows render real forecast/power values. Percentage metrics (winTitle etc.) format as %. For 'FIFA rank' (lowerBetter) the smaller number is highlighted. teamVal pulls from forecast first, then powerRanking, then the team object; a team with null forecast/powerRanking yields 0 rather than crashing.
  - **Guards:** lowerBetter → best=Math.min; teamVal falls back gracefully when forecast/powerRanking is null.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **CMP-02** · `medium` — Player compare radar plots percentiles for two players
  - **Precondition:** Two players selected in players mode.
  - **Steps:**
    1. With 2 players selected, scroll to the 'Percentile profile' radar.
    2. Confirm two overlaid series (last names) across the RADAR axes.
  - **Expected:** Radar shows seriesA and seriesB keyed to each player's last name; each axis uses percentiles[key] ?? 0. Radar appears only when mode=players and >=2 selected. Missing percentiles default to 0 without breaking the chart.
  - **Guards:** Radar gated on mode==='players' && selected.length>=2.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **CMP-04** · `medium` — Switching mode clears prior selection and swaps metric set
  - **Precondition:** Players selected in players mode.
  - **Steps:**
    1. With 2 players selected, click the 'Teams' mode toggle.
    2. Observe the selection and metric chips.
  - **Expected:** Selection resets to empty (after the first user-driven mode change), the metric set switches to DEFAULT_TEAM, and the pool reloads from /api/teams. Player chips do not linger in team mode.
  - **Guards:** initRef guards the very first mode effect; subsequent mode changes clear selected.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **CMP-07** · `medium` — Compare degrades on a source lacking advanced metrics
  - **Precondition:** Switch to a degraded source (no xG/xA/progressive); /compare in players mode.
  - **Steps:**
    1. Add two players.
    2. Read xG, xA, prog. passes rows in the comparison and the radar.
  - **Expected:** Advanced metric rows show 0/0.0 inertly (value ?? 0) rather than fabricated figures, and the percentile radar axes for unavailable metrics default to 0 — the comparison does not invent advantages. No NaN or crash.
  - **Guards:** value() uses stats[key] ?? 0; radar uses percentiles[key] ?? 0; on degraded sources those percentiles are absent.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **CMP-05** · `low` — Empty state and selection cap of 4
  - **Precondition:** On /compare, nothing selected.
  - **Steps:**
    1. Observe the page with no selections.
    2. Add entities one at a time up to 4.
    3. Attempt to add a 5th.
  - **Expected:** With 0 selected, the dashed 'Search above to add … and build a comparison card.' empty-state shows. Up to 4 can be added; at 4 the search input is disabled and no 5th is added.
  - **Guards:** add() no-ops when selected.length >= 4; input disabled at 4.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **CMP-06** · `low` — Share link round-trips selection and metrics via URL
  - **Precondition:** On /compare with >=2 entities selected and a custom metric set.
  - **Steps:**
    1. Toggle a couple of metrics on/off.
    2. Click 'Share' (appears at >=2 selected) to copy the URL.
    3. Open the copied URL in a fresh tab once the pool loads.
  - **Expected:** The Share button copies a URL containing mode, ids, and metrics. Opening it restores the same mode, the same selected entities (resolved from ids), and the same metric chips. Ids that no longer exist are silently skipped without error.
  - **Guards:** copyLink writes mode/ids/metrics; init effect resolves ids against pool and filters out missing ones.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Insights  ·  6 cases

- [ ] **INS-01** · `high` — Upset cards name the actual winner and a real ELO underdog
  - **Precondition:** Active edition (e.g. live-2026 or Simulated) has at least one FINISHED match where the lower-ELO side won by >120 ELO points.
  - **Steps:**
    1. Open /insights.
    2. Find every card with the red 'upset' badge.
    3. For each, read the title 'Upset: <winner> stun <loser>' and the body score line.
    4. Cross-check the named winner and score against that match's page (/matches/<id>).
  - **Expected:** The winner named in the title is the team that actually scored more goals; the score in the body/metrics matches the real result; the ELO-gap metric equals the absolute ELO difference and is >120. Body correctly says 'deserved' when the winner had higher xG, 'smash-and-grab' otherwise. No upset card is shown for a draw or for the favourite winning.
  - **Guards:** If no qualifying upset exists in the active edition, zero upset cards is correct — do not flag absence as a bug.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **INS-02** · `high` — Breakout cards only feature genuinely young outfield players with minutes
  - **Precondition:** Edition has player stats populated (>=90 minutes for some U23 outfielders).
  - **Steps:**
    1. Open /insights.
    2. Locate the violet 'breakout' cards.
    3. Read each player's Age metric and position.
    4. Verify the body claims (goals, xG, percentile).
  - **Expected:** Every breakout player is aged 17-23, is NOT a goalkeeper, and has played >=90 minutes. The body's 'At <age>' matches the Age metric. The xG percentile renders as a number+'th' (e.g. '88th') or an em-dash '—' when missing, never 'undefinedth' or 'NaNth'.
  - **Guards:** On feeds without xG percentiles the percentile shows '—' gracefully; that is acceptable, not a bug.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **INS-03** · `high` — Daily Briefing favourite and Golden Boot are internally consistent
  - **Precondition:** Forecasts have loaded (at least one team has a forecast).
  - **Steps:**
    1. Open /insights.
    2. Read the Daily Briefing headline, body and bullets.
    3. Note the favourite team and its Title %.
    4. Compare the favourite and Title % against /predictions for the same edition.
  - **Expected:** The favourite named is the team with the highest winTitle on /predictions, and the Title % matches. The 'X to win it across 8,000 simulations' figure equals the body's Title %. The Golden Boot bullet names the current scoring leader with proj. >= current goals, or reads 'Golden Boot race wide open' when no scorer exists.
  - **Guards:** Briefing headline is hard-coded '13 June 2026 · Matchday 3' as a subtitle label; that static label is expected and not a data assertion.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **INS-06** · `high` — Tournament switch re-points Insights to the active edition
  - **Precondition:** App supports switching editions via the top-right selector.
  - **Steps:**
    1. On /insights, note the favourite and any named teams/players.
    2. Switch the edition to a past men's tournament (e.g. 2018) via the selector.
    3. Reload/observe /insights.
  - **Expected:** Cards now reference only teams/players from the selected edition (e.g. 2018 squads), not 2026. The favourite and Golden Boot leader correspond to that edition's data. No 2026-only content bleeds through.
  - **Guards:** force-dynamic is set, so content must reflect the active edition on each request.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **INS-04** · `medium` — Briefing degrades safely when forecasts have not loaded
  - **Precondition:** Live edition early-load state where no team yet has a forecast (data still streaming).
  - **Steps:**
    1. Switch to World Cup 2026 (live) immediately on a cold start before forecasts populate.
    2. Open /insights and read the Daily Briefing.
  - **Expected:** Briefing shows the safe fallback: headline 'Tournament data is loading', a body stating how many matches are live, and a single bullet 'N live • M still to play'. No crash, no empty headline, no 'undefined' or '0.0%' favourite.
  - **Guards:** This state is transient; if forecasts are already loaded the normal briefing is correct.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **INS-05** · `medium` — Overperformer/form/milestone cards link to the correct entity and are sorted by severity
  - **Precondition:** Forecasts and power rankings populated.
  - **Steps:**
    1. Open /insights.
    2. Click an 'overperformer' card and confirm it lands on /teams/<id>.
    3. Click a 'breakout' or 'milestone' card and confirm it lands on /players/<id>.
    4. Observe the order of cards top-to-bottom.
  - **Expected:** Team cards link to /teams, player cards to /players, match cards to /matches; cards with no entity are not links. High-impact (severity high) cards sort first, then medium, then low. Overperformer Δ vs market is shown with a leading '+' and is positive.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Storylines  ·  5 cases

- [ ] **STORY-01** · `high` — Players to Watch never references xG when the feed lacks it
  - **Precondition:** Switch to a degraded feed (e.g. API-Football live early state or a datahub/historical edition without xG).
  - **Steps:**
    1. Open /storylines on the degraded edition.
    2. Read each Player story blurb (marksman, creator, breakout, etc.).
  - **Expected:** Marksman blurbs omit the xG clause entirely when xG<=0 (no 'underpinned by 0 xG' or 'xG of 0'). xG+xA metric still renders as a number. Breakout percentile shows a number+'th' or '—', never 'undefinedth'. No metric is displayed as a bare 0 implying real measured zero.
  - **Guards:** Feeds that DO carry xG should include the finishing clause; presence of xG copy there is correct.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STORY-02** · `high` — Empty/early state shows the explainer, not garbled cards
  - **Precondition:** Live edition with player stats populated for fewer than 3 teams.
  - **Steps:**
    1. Switch to World Cup 2026 (live) at an early matchday before 3 teams have player stats.
    2. Open /storylines and inspect the 'Players to Watch' panel.
  - **Expected:** When fewer than 3 player storylines exist, the dashed-border explainer renders: 'Player storylines need more matches.' with the correct count ('N team' / 'N teams' pluralized) and the StatsBomb switch hint. Any available player cards still render below the note. No empty grid cells or partial cards.
  - **Guards:** With >=3 player storylines the normal 3-column grid is correct and the explainer must NOT appear.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STORY-03** · `medium` — Each squad archetype is a distinct team and matches its claim
  - **Precondition:** Forecasts and power rankings populated for the active edition.
  - **Steps:**
    1. Open /storylines, scroll to 'Squads to Watch'.
    2. Read the five archetype cards: Favourites, Surprise Package, Dark Horse, Firepower, The Fortress.
    3. Verify each archetype's headline metric against /predictions and /rankings.
  - **Expected:** No team appears in two squad cards (one team per archetype). Favourites = highest winTitle. Surprise Package has a positive Δ vs market shown with '+'. The Fortress shows the highest defense rating; Firepower the highest offense rating. Dark Horse is not one of the top-3 title teams. All percentages render with one decimal and '%'.
  - **Guards:** If fewer than 5 teams have forecasts, fewer cards is acceptable; no card should show '—' where a real value exists.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STORY-04** · `medium` — Breakout/in-form player ages and form are factually grounded
  - **Precondition:** Edition with form indices and ages populated.
  - **Steps:**
    1. Open /storylines.
    2. Find any 'Breakout Star' (violet) or 'In Form' (lime) player card.
    3. Read the age in the breakout blurb and the form index in the in-form blurb.
  - **Expected:** Breakout Star players are aged 17-22 with at least one goal+assist. In Form blurb's form index matches the player's stats.formIndex and player has >=90 minutes. Pluralization is correct ('1 clean sheet' vs '2 clean sheets', '1 assist' vs '2 assists').
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **STORY-05** · `low` — Player and squad cards link to the right pages with portraits/crests
  - **Precondition:** Any populated edition.
  - **Steps:**
    1. Open /storylines.
    2. Click a player card; then go back and click a squad card.
    3. Confirm crests/portraits render.
  - **Expected:** Player cards link to /players/<entityId>; squad cards link to /teams/<entityId>. Squad crest renders only when the team resolves (no broken crest). Portraits load by player id. Metric label 'Boot rank' appears only for players in the Golden Boot list; otherwise 'Form' is shown.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Discoveries  ·  5 cases

- [ ] **DISC-01** · `high` — Underrated-by-continent degrades to a clear message off the live edition
  - **Precondition:** Active edition is NOT live-2026 (e.g. a past or simulated edition).
  - **Steps:**
    1. Switch to a past/simulated edition.
    2. Open /discoveries and read the 'Underrated by Continent' section.
  - **Expected:** Because club affiliations only load for live-2026, byContinent is empty and the EmptyState reads 'Underrated profiles use live club data. Switch to World Cup 2026 in the top-right selector.' No empty grid, no players with missing club logos.
  - **Guards:** On live-2026 with club data loaded, real player cards must appear instead; the live EmptyState 'Club links are still loading' is only correct during the brief loading window.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **DISC-02** · `high` — Underrated players are top-club players of non-favourite nations
  - **Precondition:** Active edition is live-2026 with club map fully loaded.
  - **Steps:**
    1. On live-2026, open /discoveries.
    2. Inspect several Underrated cards across continents.
    3. Read each card's club, league chip, nation, and 'Nation title odds'.
  - **Expected:** Every player plays at a top-5-league or marquee club (tier>=2). Each player's nation has title odds <=6% (favourites excluded). 'Nation title odds' shows a percentage to one decimal matching that nation's winTitle. Each continent group shows at most 3 players, one per nation. Confederation labels are full-form (e.g. 'Europe (UEFA)').
  - **Guards:** Continents with no qualifying player are omitted entirely; an absent confederation group is not a bug.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **DISC-03** · `high` — First-Timers list only true debut nations for the active edition's year
  - **Precondition:** Active edition has known debutant nations for its year (or none).
  - **Steps:**
    1. Open /discoveries, scroll to 'First-Timers · debut nations'.
    2. Note which nations appear and the active edition's year.
    3. Switch to a different edition (different year) and re-check.
  - **Expected:** Listed nations match the debutant set for the active tournament's year only; switching years changes the list accordingly. Each debut card shows squad size, confederation, group (if any), coach (only when a real manager exists, not '—'), and a 'Debut' badge. When the year has no debutants, EmptyState 'No debutant nations recorded for this tournament.' shows instead of an empty grid.
  - **Guards:** Debutant data is keyed off tournament.year; a year with zero recorded debutants legitimately yields the empty state.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **DISC-04** · `medium` — Debut 'Players at European clubs' chips only show when club links exist
  - **Precondition:** Active edition is live-2026 with club map loaded and at least one debutant nation.
  - **Steps:**
    1. On live-2026, open /discoveries debut cards.
    2. Check the 'Players at European clubs' chip row on each debut card.
  - **Expected:** The chip row appears only when keyPlayers is non-empty; each chip shows player name + club and links to /players/<id> (max 6). The blurb's 'leans on European-based talent like <name> (<club>)' names the first key player. When no key players, the blurb falls back to 'A historic debut on the game's biggest stage.' and no chip row renders.
  - **Guards:** Off live editions club links are unavailable, so chips legitimately do not render.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **DISC-05** · `low` — Debut card crest and team links resolve
  - **Precondition:** At least one debutant nation in the active edition.
  - **Steps:**
    1. Open /discoveries.
    2. Click a debut nation's name/flag heading.
  - **Expected:** Heading links to /teams/<id>; the TeamCrest renders only when the team resolves in the store (no broken crest box). Squad size matches the team's squad length on its team page.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## History  ·  5 cases

- [ ] **HIST-01** · `high` — Each edition card shows the correct champion, Golden Boot and tallies
  - **Precondition:** StatsBomb tournament snapshots are loadable.
  - **Steps:**
    1. Open /history.
    2. For each men's and women's card, read champion (+flag), matches, goals, G/Game, xG/Shot, and Golden Boot.
    3. Spot-check goals and matches against a known reference for that World Cup.
  - **Expected:** Champion and flag match the registry for that edition. G/Game equals goals/matches to 2 decimals; xG/Shot is the per-shot average to 2 decimals (a plausible 0.08-0.15 range, never 0 for a StatsBomb edition). Golden Boot names the snapshot's top scorer with its goal count. Women's cards are grouped under 'Women's World Cups', men's under 'Men's World Cups'.
  - **Guards:** Only tournaments with source='statsbomb' appear here (currently four: 2018, 2022, W2019, W2023); the live 2026 edition is intentionally excluded.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HIST-04** · `high` — Explore button switches the active edition and re-points the app
  - **Precondition:** History page loaded.
  - **Steps:**
    1. On /history, click 'Explore <short>' on a specific edition (e.g. 2018).
    2. Navigate to /insights, /analytics, and /groups.
  - **Expected:** After exploring, the whole app re-points to that edition: standings, players, analytics and insights all reflect the chosen year, not 2026. The selector in the top-right reflects the same active edition.
  - **Guards:** This is the cross-page consistency check that ties History switching to the rest of the app.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HIST-02** · `medium` — Summary header aggregates and span are computed across all editions
  - **Precondition:** At least one StatsBomb edition loads.
  - **Steps:**
    1. Open /history.
    2. Read the four header Stats: Tournaments analyzed, Matches, Goals (with '/ game'), Span.
    3. Sum the per-card matches and goals and compare.
  - **Expected:** 'Tournaments analyzed' equals the number of edition cards. Header Matches/Goals equal the sums of the per-card values. The '/ game' figure equals totalGoals/totalMatches to 2 decimals. Span shows min year–max year across the loaded editions.
  - **Guards:** If one snapshot fails to load it is silently skipped (try/catch); header counts then reflect only successfully loaded editions, which is acceptable.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HIST-03** · `medium` — Goals-per-game and xG-per-shot bar charts match the cards and are color-coded by gender
  - **Precondition:** History page loaded with >=2 editions.
  - **Steps:**
    1. Open /history.
    2. Compare each bar in 'Goals per Game' and 'Shot Quality (xG per shot)' to the matching edition card's G/Game and xG/Shot.
    3. Check bar colors.
  - **Expected:** Each bar's value matches its card to 2 decimals. Women's editions render in pink (#ff2e9a), men's in teal. No xG/shot bar is 0 for a StatsBomb edition. Bar labels use the short edition name.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **HIST-05** · `medium` — History never shows metrics as 0 or garbled for an unfinished/empty snapshot
  - **Precondition:** Hypothetical edition with zero matches loaded (guard against divide-by-zero).
  - **Steps:**
    1. Inspect a snapshot whose matches array is empty (or force one).
    2. Observe its card and the header aggregates.
  - **Expected:** goalsPerGame and conversion fall back to 0 via the matches-length guard rather than producing NaN/Infinity. avgGpg uses totalMatches guard. No 'NaN', 'Infinity', or blank values render. (An all-zero edition card would be a data smell to escalate, but must not crash the page.)
  - **Guards:** In normal operation every StatsBomb edition has matches; this guards the divide-by-zero edge only.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Analytics  ·  3 cases

- [ ] **ANL-01** · `high` — Header aggregates derive from real shot data of the active edition
  - **Precondition:** Active edition has shot-level data (StatsBomb or live with xG).
  - **Steps:**
    1. Open /analytics.
    2. Read Avg xG/shot (+shot count), Conversion, Big chances, Set-piece xG %.
    3. Sanity-check against the active edition's match shot data.
  - **Expected:** Avg xG/shot = totalXG/totalShots to 2 decimals with the real shot count in 'N shots'. Conversion = goals/shots % (counts goal and penalty_goal). Set-piece xG % is the share of total xG from corner/set_piece/free_kick/direct_free_kick. With zero shots all four guard to 0/0.0% rather than NaN.
  - **Guards:** On a degraded feed lacking shots these may legitimately be 0; flag only if the edition clearly has shot data but shows 0.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ANL-02** · `medium` — Finishing and creativity scatters reflect filtered eligible players
  - **Precondition:** Active edition has player stats.
  - **Steps:**
    1. Open /analytics.
    2. Hover/inspect points in the 'Finishing' (xG vs Goals) and 'Creativity' (xA vs Assists) scatters.
    3. Confirm which players are plotted.
  - **Expected:** Finishing plots only outfield players (no GK) with >=90 minutes and (xG>0.5 or goals>0); points above the y=x line are overperforming xG as the subtitle claims. Creativity plots players with >=90 minutes and (xA>0.4 or assists>0). Bubble size encodes shots (finishing) / key passes (creativity). No more than 120 points each.
  - **Guards:** Empty scatters are acceptable on a feed with no advanced player metrics; cards should still render axes without crashing.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ANL-03** · `medium` — Leader bars show top-10 by the labelled metric with team colors
  - **Precondition:** Player stats populated.
  - **Steps:**
    1. Open /analytics.
    2. Read xG Leaders, Progressive Passers, Top Tacklers, Pressing Volume bars.
    3. Compare ordering to the players list sorted by each metric.
  - **Expected:** Each bar list is the top 10 sorted descending by its metric; labels are '<TEAM> <Surname>'; bar color is the player's team primary color. Values are rounded to 1 decimal. A missing metric defaults to 0 rather than undefined.
  - **Guards:** On feeds without progressive/pressing data those panels may show 0-valued bars; that is graceful degradation, not a crash.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Betting Edge  ·  25 cases

- [ ] **BET-01** · `high` — Empty state on a non-live tournament
  - **Precondition:** App is running. Use the top-right tournament selector to switch to ANY historical/non-live edition (e.g. a datahub edition or a precomputed past World Cup), NOT live-2026.
  - **Steps:**
    1. Switch the active tournament to a non-live edition.
    2. Navigate to /betting.
    3. Read the body content below the page header and banners.
  - **Expected:** The page renders the EmptyState with the exact copy 'Betting markets are only available for the live World Cup 2026. Switch to it in the top-right selector.' No table, no slip, no Kelly card. The ResponsibleGamblingBanner and SimulationBanner still render above it.
  - **Guards:** This branch fires because getActiveTournamentId() !== 'live-2026' so data.isLive is false and getMarketEvents() is never called. Confirm no network call to the odds provider was made.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-02** · `high` — Empty state on live but no priced fixtures
  - **Precondition:** Active tournament is live-2026. An odds source IS configured (ODDS_API_KEY or API_FOOTBALL_KEY) and returns events, but NONE of those events join to an upcoming (non-FINISHED) fixture — e.g. all priced events correspond to finished matches, or the team-pair join misses entirely.
  - **Steps:**
    1. Ensure live-2026 is active and the odds source returns at least one event but zero join to current fixtures.
    2. Navigate to /betting.
    3. Read the EmptyState copy.
  - **Expected:** EmptyState shows exactly 'No upcoming fixtures are priced by the market right now — check back closer to kickoff.' This is the data.hasMarket === true but rows.length === 0 branch.
  - **Guards:** hasMarket is true when events.length > 0. available is false when rows.length === 0. Distinguish carefully from BET-03 (no source at all).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-03** · `high` — Empty state on live with no odds source (must resolve, not spin)
  - **Precondition:** Active tournament is live-2026. NO odds source configured (neither ODDS_API_KEY nor API_FOOTBALL_KEY set), OR both providers return an empty array.
  - **Steps:**
    1. Unset both ODDS_API_KEY and API_FOOTBALL_KEY (or force both providers to return []).
    2. Navigate to /betting.
    3. Wait for the page to settle and observe the body.
  - **Expected:** EmptyState shows exactly 'Live betting markets are currently unavailable.' The page fully resolves to this static message — it must NOT show a perpetual spinner or 'Loading…' that never resolves. hasMarket is false (events.length === 0) and available is false.
  - **Guards:** getMarketEvents returns [] when no key. This is the !data.hasMarket branch. Regression guard: confirm there is no infinite loading state since the page is a server component returning final HTML.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-04** · `high` — Happy path — model vs market table renders all priced upcoming fixtures
  - **Precondition:** live-2026 active; odds source returns priced events that join to multiple upcoming fixtures.
  - **Steps:**
    1. Navigate to /betting.
    2. Inspect the 'Model vs Market — All Fixtures' table.
    3. Cross-check the fixtures shown against the live fixture list and the source's priced events (and server log line '[oddsApi] N priced events' or '[oddsApiFootball] N priced WC fixtures').
  - **Expected:** Every upcoming (non-FINISHED) fixture that a bookmaker prices appears as a 3-row group (Home win / Draw / Away win). Each group shows the fixture label only on its first row. Columns: Fixture, Pick, Model, Market, Best, EV. Finished matches are absent.
  - **Guards:** betting.ts skips m.status === 'FINISHED' and skips fixtures with no matching priced event (no first cand). A priced event that matches no fixture is logged via '[betting] unmatched market events:' — verify that warning lists only genuinely-absent fixtures, not name-spelling misses.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-05** · `high` — De-vigged market probabilities sum to ~1 per fixture
  - **Precondition:** live-2026 active with priced fixtures.
  - **Steps:**
    1. On /betting, pick any fixture row group in the All Fixtures table.
    2. Read the Market column for Home, Draw, Away.
    3. Sum the three Market percentages.
  - **Expected:** The three Market probabilities sum to approximately 100% (within rounding, ~99.9–100.1%). They are de-vigged: each book's raw implied probs (1/odds) are normalized to sum to 1, then averaged across books — so the bookmaker overround/vig is removed.
  - **Guards:** devig() in oddsApi.ts / oddsApiFootball.ts normalizes per book before averaging. Raw odds-implied probs would sum to >100% (the vig); de-vigged must sum to ~100%.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-07** · `high` — Edge column equals model minus market
  - **Precondition:** live-2026 active with priced fixtures.
  - **Steps:**
    1. On any outcome row, note Model% and Market%.
    2. Compute Model − Market.
    3. Compare to the edge value (note: the table surfaces EV, not edge directly — verify via the value-bet card 'model X vs mkt Y' and the underlying edge field).
  - **Expected:** edge = model − market for each outcome (EdgeOutcome.edge). A positive edge means the model assigns more probability than the de-vigged market. The value-bet card shows 'model {pct} vs mkt {pct}' consistent with this.
  - **Guards:** betting.ts mk(): edge: model - mkt. Confirm sign correctness (model higher → positive).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-08** · `high` — EV column equals model*odds − 1
  - **Precondition:** live-2026 active with priced fixtures.
  - **Steps:**
    1. Pick an outcome row; note Model (as a fraction) and Best odds.
    2. Compute model * odds − 1.
    3. Compare to the displayed EV (shown as a percentage).
  - **Expected:** EV displayed = (model * bestOdds − 1) shown as a signed percentage to 1 decimal. Example: model 0.40, odds 2.80 → 0.40*2.80−1 = +0.12 → '+12.0%'. EV uses BEST odds (not market consensus odds).
  - **Guards:** mk(): ev = price > 0 ? model*price - 1 : -1. If price is 0/invalid, ev is forced to -1 (never NaN). Verify no NaN/Infinity appears anywhere.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-10** · `high` — Value-bet flagging uses bestEv > 0.02 and the card appears only when value bets exist
  - **Precondition:** live-2026 active.
  - **Steps:**
    1. Case A: at least one fixture has bestEv > 0.02. Navigate to /betting.
    2. Case B: no fixture has bestEv > 0.02. Navigate to /betting.
  - **Expected:** Case A: the 'Model Disagrees With the Market' card renders, listing fixtures whose bestEv > 0.02 (max 8). Case B: that card is entirely absent (valueBets.length === 0 → not rendered). The All-Fixtures table still renders in both cases.
  - **Guards:** Client filters rows.filter(r => r.bestEv > 0.02).slice(0,8). Server valueBets uses the same > 0.02 threshold. A fixture with bestEv exactly 0.02 is NOT flagged.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-13** · `high` — Home/away orientation matches OUR fixture even when the book lists it reversed
  - **Precondition:** live-2026 active; at least one priced event where the bookmaker's home_team is OUR away team (pairing reversed relative to our fixture).
  - **Steps:**
    1. Identify a fixture where our home team is the book's away_team (compare provider raw names to the fixture).
    2. On /betting find that fixture's row group.
    3. Verify the 'Home win' Pick row corresponds to OUR home team and uses the market/best for our home side.
  - **Expected:** Outcomes are oriented to OUR fixture: when e.home !== normTeam(ourHome), the market and best objects are swapped (home↔away, draw unchanged). So the 'X win' Pick label, its Model, Market and Best all describe OUR home team — never the book's listing order.
  - **Guards:** betting.ts: direct = e.home === hk; if not direct, market/best home and away are swapped. Bug-class: reversed orientation would pair our home win prob against the away team's price — check a known asymmetric matchup.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-14** · `high` — Divergent team-name spellings still match (alias map)
  - **Precondition:** live-2026 active; priced events include nations the two sources spell differently — e.g. USA / United States, Congo DR / DR Congo, Türkiye / Turkey, Czechia / Czech Republic, Korea Republic / South Korea, Côte d'Ivoire / Ivory Coast.
  - **Steps:**
    1. Confirm such fixtures exist in the live fixtures AND are priced by the source.
    2. Navigate to /betting and verify each such fixture appears in the table.
    3. Check the server console for '[betting] unmatched market events:'.
  - **Expected:** Every divergent-spelling fixture that the source prices appears in the table (the alias map in oddsApi.ts reconciles the names through normTeam). The '[betting] unmatched market events:' warning does NOT list any of these reconciled nations.
  - **Guards:** normTeam strips accents, lowercases, strips 'fa'/'national team', then applies ALIAS. e.g. 'türkiye'→'turkey', 'congo dr'→'dr congo', 'usa'→'united states', 'korea republic'→'south korea', 'czechia'→'czech republic'. Any such name in the unmatched log is a regression.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-16** · `high` — Source selection — API-Football primary, The Odds API fallback, identical shape
  - **Precondition:** live-2026 active. Run twice: (A) API_FOOTBALL_KEY set; (B) API_FOOTBALL_KEY unset but ODDS_API_KEY set.
  - **Steps:**
    1. Run A: with API_FOOTBALL_KEY configured and returning events, load /betting.
    2. Run B: unset API_FOOTBALL_KEY, keep ODDS_API_KEY, load /betting.
    3. Compare the table structure and that fixtures populate in both.
  - **Expected:** Both runs render the same table shape (3 outcomes/fixture, same columns, de-vigged market, best odds, EV) because both providers emit the identical MarketEvent[] shape. In A the log shows '[oddsApiFootball] …'; in B it shows '[oddsApi] …'. If API-Football returns empty/throws, it falls back to The Odds API.
  - **Guards:** getMarketEvents prefers fetchApiFootballMarket() when API_FOOTBALL_KEY set and result non-empty; on empty/exception it logs '[market] API-Football odds unavailable, falling back…' and uses ODDS_API_KEY. Finished matches excluded by betting.ts regardless of source.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-17** · `high` — Math sanity — no NaN/Infinity, EV/edge plausible, value bets truly >2%
  - **Precondition:** live-2026 active with priced fixtures.
  - **Steps:**
    1. Scan every Model, Market, Best, EV cell in the table and the value-bet card.
    2. Confirm no cell shows NaN, Infinity, undefined, or a wildly implausible value (e.g. EV +900%).
    3. For each fixture in the value-bet card, confirm its top EV is strictly greater than 2.0%.
  - **Expected:** All numeric cells are finite and plausible (model/market in 0–100%, odds >= ~1.01, EV within a sane range). Every value-bet-card fixture has bestEv > 0.02 (i.e. its shown top EV > +2.0%). No NaN anywhere.
  - **Guards:** ev guarded by price>0 ? … : -1. devig skips price<=1 and non-finite. If a model prob were undefined it'd surface as NaN% — treat that as a bug (e.g. missing prediction).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-18** · `high` — Add to slip from table and from value-bet card; dedupe by match+side
  - **Precondition:** live-2026 active with at least one priced fixture; betting client loaded.
  - **Steps:**
    1. Click the + button on an outcome row in the All Fixtures table.
    2. Observe the slip on the right ('Your Slip').
    3. Click + for the SAME fixture+side again (from card or table).
    4. Click + for a different outcome of the same fixture.
  - **Expected:** First click adds a selection showing the outcome label, 'HOME v AWAY' match label, and the best odds to 2 decimals. Re-adding the same match+side does NOT create a duplicate (keyed by `${matchId}-${side}`). A different side of the same fixture adds a separate line.
  - **Guards:** add() builds key matchId-side and skips if prev.find(key) exists. The value-bet card's + adds the single best outcome (r.outcomes reduce by max ev).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-20** · `high` — Singles mode slip math
  - **Precondition:** Slip has N selections (N>=2), mode = Singles, stake = S per selection.
  - **Steps:**
    1. Set mode to 'Singles'.
    2. Set stake to a known value S (e.g. 10) with 2 selections of odds o1, o2 and model probs p1, p2.
    3. Read Total stake, Return if all win, Model expected value.
  - **Expected:** Total stake = S * N. 'Return if all win' = sum over selections of S*odds. Model expected value = sum of (model*odds − 1)*S per selection. Values formatted to 2 decimals; EV sign-prefixed and tone-colored (green positive / red negative). No 'Combined odds' row in singles mode.
  - **Guards:** slipMath singles branch: totalStake = stake*slip.length; ret = Σ stake*odds; ev = Σ (model*odds-1)*stake. combOdds row only shown in acca.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-21** · `high` — Accumulator mode slip math
  - **Precondition:** Slip has N selections, mode = Accumulator, stake = S.
  - **Steps:**
    1. Switch mode to 'Accumulator'.
    2. With odds o1..oN and model probs p1..pN, read Combined odds, Total stake, Potential return, Model expected value.
  - **Expected:** Combined odds = product of all selection odds. Total stake = S (single stake, NOT multiplied by count). Potential return = S * combinedOdds. Model EV = (productOfModelProbs * combinedOdds − 1) * S. 'Combined odds' row is shown in acca mode.
  - **Guards:** acca branch: combOdds = Π odds; combModel = Π model; ret = stake*combOdds; ev = (combModel*combOdds-1)*stake; totalStake = stake (not *length).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-23** · `high` — Kelly calculator — stake never exceeds 100% or goes negative
  - **Precondition:** Betting client loaded; Kelly card visible.
  - **Steps:**
    1. Set Decimal odds, Your win probability%, Bankroll.
    2. Case A: enter a positive-edge input (e.g. odds 2.5, prob 60%).
    3. Case B: enter a no-edge/negative input (e.g. odds 2.5, prob 30%).
    4. Sweep the Kelly fraction slider 5%–100%.
  - **Expected:** Full Kelly = (b*p − (1−p))/b with b = odds−1, clamped at 0 (never negative). Suggested stake = max(0,fullKelly)*fraction*bankroll — never negative, never more than 100% of bankroll (fraction<=1 and clamped fullKelly<=… for sane inputs). Case B: fullKelly<=0 → Full Kelly 0.0%, suggested stake 0.00, and the amber note 'No edge at these inputs — Kelly says stake nothing.' appears. Edge(EV) row = p*odds−1 with green/red tone.
  - **Guards:** fullKelly = b>0 ? (b*p-(1-p))/b : 0; k = Math.max(0,fullKelly)*fraction; stake = k*bankroll. Negative-edge must never suggest a positive stake. Verify suggested stake <= bankroll for any fraction<=1.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-24** · `high` — Responsible-gambling banner always present and not dismissible
  - **Precondition:** Any state of /betting (empty or populated).
  - **Steps:**
    1. Load /betting in each empty state (BET-01/02/03) and in the populated state.
    2. Look for the amber ShieldAlert banner above the content.
    3. Attempt to find any dismiss/collapse control.
  - **Expected:** The ResponsibleGamblingBanner renders in ALL states, above the EmptyState/BettingClient. It states 'For analysis & education only — not betting advice.', explains positive edge usually means the model is wrong, mentions legal age and staking only what you can afford, and lists support resources (BeGambleAware.org, GamCare, 1-800-GAMBLER). There is NO dismiss or collapse control.
  - **Guards:** Banner is rendered unconditionally in page.tsx before the available check. Component has no state/close handler.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-06** · `medium` — Best odds are the maximum decimal price across books
  - **Precondition:** live-2026 active; a fixture is priced by multiple books with differing prices.
  - **Steps:**
    1. Identify a fixture priced by >1 book and note each book's decimal prices for one outcome (from raw provider data or logs).
    2. On /betting, read the Best column for that outcome.
  - **Expected:** The Best price equals the maximum decimal price offered by any book for that outcome (best.home/draw/away = Math.max across books), formatted to 2 decimals. It is never an average and never lower than any individual book's price.
  - **Guards:** best.* uses Math.max in both devig implementations. books count shown elsewhere should be >= the number of books that contributed.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-09** · `medium` — EV color coding thresholds
  - **Precondition:** live-2026 active with a spread of EV values (some >0.02, some between, some <-0.05).
  - **Steps:**
    1. Scan the EV column and the value-bet card EV figures.
    2. Note text color for outcomes with EV > +2%, between −5% and +2%, and < −5%.
  - **Expected:** EV > 0.02 renders in accent (positive/teal); EV < −0.05 renders in accent-red; everything in between renders muted. evColor() drives this in BettingClient.
  - **Guards:** evColor = ev>0.02 ? accent : ev<-0.05 ? accent-red : muted. Boundary: exactly 0.02 is NOT accent (strict >), exactly -0.05 is NOT red (strict <).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-12** · `medium` — Rows sorted by bestEv descending
  - **Precondition:** live-2026 active with several priced fixtures of varying bestEv.
  - **Steps:**
    1. On /betting read the bestEv-equivalent (top EV of each fixture group) down the All Fixtures table and the value-bet card order.
    2. Confirm ordering.
  - **Expected:** Fixture groups are ordered so the fixture with the highest single-outcome EV (bestEv) appears first, descending. The value-bet card follows the same order.
  - **Guards:** betting.ts rows.sort by b.bestEv - a.bestEv before return. bestEv = Math.max of the three outcome EVs.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-15** · `medium` — Same-pair rematch disambiguated by nearest kickoff
  - **Precondition:** live-2026 active; the same team pair is priced for two events (e.g. a knockout rematch) so byPair has >1 candidate.
  - **Steps:**
    1. Identify a team pair with two priced events at different commence times.
    2. On /betting confirm the fixture's odds correspond to the event whose commence time is nearest the fixture's kickoff.
  - **Expected:** When a pair has multiple priced events, betting.ts picks the candidate whose commence time is closest to our fixture kickoff (min |commence − kickoff|). The displayed prices match that nearest event, not an arbitrary first.
  - **Guards:** betting.ts loops cands and replaces e when Math.abs(commence-kickoff) is smaller. Only applies when cands.length>1 and kickoffMs is finite.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-19** · `medium` — Slip persists across reload via localStorage wc26:betslip
  - **Precondition:** Betting client loaded with at least one selection in the slip.
  - **Steps:**
    1. Add 2 selections, set a stake, switch mode to Accumulator.
    2. Reload /betting.
    3. Inspect localStorage key 'wc26:betslip' and the rendered slip.
  - **Expected:** After reload the slip, stake, and mode are restored from localStorage. localStorage['wc26:betslip'] holds JSON {slip:[…], stake, mode}. The persist effect only writes after hydration (hydrated flag) so it never clobbers stored state with the initial defaults on first paint.
  - **Guards:** Read effect parses SLIP_KEY on mount; write effect gated by hydrated. Clearing the slip ([]) should also persist as empty.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-22** · `medium` — Empty slip and stake input guards
  - **Precondition:** Betting client loaded.
  - **Steps:**
    1. With an empty slip, read the slip panel.
    2. Add a selection, then type a negative number into the stake input.
    3. Clear the slip via the Clear button.
  - **Expected:** Empty slip shows 'Add selections from the table to build a slip. Saved on this device.' and no mode toggle/math. Stake input clamps to >= 0 (Math.max(0, …)); negative entry becomes 0. Clear button (only visible when slip non-empty) empties the slip and the empty-state copy returns.
  - **Guards:** onChange stake uses Math.max(0, Number(...)). slipMath returns null for empty slip. Clear sets slip([]).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-11** · `low` — Value-bet card caps at 8 entries
  - **Precondition:** live-2026 active with MORE than 8 fixtures having bestEv > 0.02.
  - **Steps:**
    1. Navigate to /betting.
    2. Count the rows in the 'Model Disagrees With the Market' card.
  - **Expected:** At most 8 fixtures are listed in the value-bet card (slice(0,8)), and they are the highest-bestEv ones since rows are pre-sorted descending by bestEv on the server.
  - **Guards:** Server rows.sort((a,b)=>b.bestEv-a.bestEv). Client slice(0,8).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **BET-25** · `low` — Books count displayed and consistent
  - **Precondition:** live-2026 active with priced fixtures.
  - **Steps:**
    1. On the value-bet card, read the 'N books' subtitle for a fixture.
    2. Compare N to the number of books that priced that event.
  - **Expected:** The 'N books' figure equals EdgeRow.books = the count of books that contributed a complete 1X2 (h2h) price for that event (probs.length in devig). It is >= 1 for any priced fixture.
  - **Guards:** books = probs.length; only books with all three valid prices (h&&d&&a) are counted.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Search  ·  20 cases

- [ ] **SRCH-01** · `high` — Surname-only query returns the correct player as the top result
  - **Precondition:** App running on an edition whose roster contains a player whose surname is 'Messi' (e.g. live-2026 / simulation). Note the active edition.
  - **Steps:**
    1. Click the Topbar search box.
    2. Type 'messi' (lowercase, no first name).
    3. Wait for the dropdown to populate (debounced ~160ms) and inspect the Players group.
  - **Expected:** The dropdown shows a Players group whose FIRST entry is the Messi on the active roster (name contains the 'Messi' surname token, with that team's flag/code beside it). No 500/error; the list is not empty when Messi exists in the edition.
  - **Guards:** Assert on the player NAME text, not merely that results exist. If Messi is not in the active edition, this case is N/A — switch to an edition that has him first.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-02** · `high` — Full name 'lionel messi' ranks the exact player first
  - **Precondition:** Active edition roster contains Lionel Messi.
  - **Steps:**
    1. Type 'lionel messi' into the search box.
    2. Inspect the top Players result.
  - **Expected:** Exact player (Lionel / L. Messi) is the #1 player result. Both signal tokens ('lionel' and 'messi') corroborate, so no other same-surname or near-name player outranks him.
  - **Guards:** Top-1 must be the exact entity, not merely present in the list.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-05** · `high` — Accent-insensitive: 'mbappe' (no accent) resolves 'Mbappé'
  - **Precondition:** Active edition roster contains Kylian Mbappé.
  - **Steps:**
    1. Type 'mbappe' (plain ASCII, no accent).
    2. Inspect the top Players result.
  - **Expected:** Diacritics are folded during normalize, so 'mbappe' resolves Kylian Mbappé as the top player result.
  - **Guards:** Top result name should display the accented 'Mbappé'.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-08** · `high` — Adjacent-transposition typo 'halaand' resolves Haaland
  - **Precondition:** Active edition roster contains Erling Haaland.
  - **Steps:**
    1. Type 'halaand' (the 'aa' transposed).
    2. Inspect the top Players result.
  - **Expected:** Damerau OSA distance counts the adjacent transposition as 1 edit, so Haaland resolves as the top player result for 'halaand'.
  - **Guards:** Must clear threshold (scoreName('halaand','Erling Haaland') > 0.55). Confirms the transposition path, not generic Levenshtein.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-11** · `high` — Short ambiguous token 'kane' does NOT false-match 'Sané'
  - **Precondition:** Active edition roster contains both a 'Kane' and a 'Sané' (or at least a Sané-type near neighbor).
  - **Steps:**
    1. Type 'kane' (4-char token).
    2. Inspect every player in the dropdown's Players group.
  - **Expected:** Results contain Kane (if present) but NEVER 'Sané'. Short (<5-char) tokens get zero typo budget, so 'kane' cannot fuzz into 'Sané' (scoreName('kane','Leroy Sané') < 0.55).
  - **Guards:** This is the key false-positive guard. Inspect the full list, not just top-1 — Sané must be absent.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-12** · `high` — Full team name resolves the team as the top Teams result
  - **Precondition:** Active edition includes a known nation (e.g. 'Argentina' / 'Brazil').
  - **Steps:**
    1. Type a full nation name present in the active edition (e.g. 'argentina').
    2. Inspect the Teams group.
  - **Expected:** The Teams group's top entry is that nation, with its flag and 3-letter code shown. Exact normalized name match scores 100.
  - **Guards:** Assert team NAME/code, not just non-empty.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-13** · `high` — 3-letter team code 'USA' resolves United States
  - **Precondition:** Active edition includes United States.
  - **Steps:**
    1. Type 'USA' (uppercase).
    2. Inspect the Teams group.
  - **Expected:** United States is the top Teams result (exact-code match forces score 50). Also covered by the 'usa' alias mapping.
  - **Guards:** Code match is case-insensitive (normalized). Result must be the USA team specifically.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-18** · `high` — Garbage / no-match query degrades gracefully (no 500, 'Press Enter to ask')
  - **Precondition:** App running.
  - **Steps:**
    1. Type a nonsense string with no entity match (e.g. 'zzqwx').
    2. Observe the dropdown.
  - **Expected:** The dropdown shows 'No matches. Press Enter to ask the AI.' Empty teams/players/matches arrays are returned, HTTP 200, no exception.
  - **Guards:** Confirms the empty-result branch and that /api/search never throws.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-19** · `high` — Search never 500s even when fixtures have unresolved (TBD) sides
  - **Precondition:** Active edition has TBD knockout slots or a hollow live feed (homeTeamId/awayTeamId may be undefined). live-2026 before knockouts are seeded is ideal.
  - **Steps:**
    1. Type a team query that resolves to a side appearing in not-yet-determined knockout fixtures (e.g. a likely qualifier).
    2. Inspect the Matches group and confirm the response succeeded.
  - **Expected:** HTTP 200, no crash. The Matches group only lists fixtures where BOTH sides resolve to real teams; any fixture with an undefined home/away is dropped (never rendered as undefined). This is the regression that once crashed /api/search.
  - **Guards:** Verify network panel: /api/search returns 200, not 500. No 'cannot read properties of undefined' in console.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-20** · `high` — Search resolves against the ACTIVE edition's roster after switching tournaments
  - **Precondition:** At least two editions available with disjoint rosters (e.g. live-2026 vs a historical datahub edition like 1970).
  - **Steps:**
    1. On edition A, search a player unique to A and confirm a hit.
    2. Use the TournamentSwitcher to switch to edition B (which lacks that player).
    3. Search the same name again.
    4. Then search a player that exists only in edition B.
  - **Expected:** After switching, the A-only player no longer resolves (empty or no exact hit), and the B-only player now resolves. Search is keyed to the active edition's store snapshot, not a stale index.
  - **Guards:** Directly exercises the stale-index / snapshot-identity regression. Assert presence flips correctly both ways.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-03** · `medium` — Flipped name order 'messi lionel' still resolves the same player
  - **Precondition:** Active edition roster contains Lionel Messi.
  - **Steps:**
    1. Type 'messi lionel' (surname-first).
    2. Inspect the top Players result.
  - **Expected:** Resolution is order-independent: Lionel Messi appears as the top player result, identical to SRCH-02. Token assignment is greedy/order-free.
  - **Guards:** Score parity with the natural order — must be in top results, ideally #1.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-04** · `medium` — Abbreviated 'L. Messi' (feed-style initial) resolves the full player
  - **Precondition:** Active edition roster contains Lionel Messi (stored as 'L. Messi' or 'Lionel Messi').
  - **Steps:**
    1. Type 'L. Messi' into the search box.
    2. Inspect the top Players result.
  - **Expected:** The 'L.' initial plus the full surname token resolves Messi as the top player result. The single-char initial alone is below threshold, but the surname token corroborates it.
  - **Guards:** Confirm the dot/punctuation is normalized away and the initial maps to the first name.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-06** · `medium` — Accented input 'mbappé' resolves identically to the unaccented form
  - **Precondition:** Active edition roster contains Kylian Mbappé.
  - **Steps:**
    1. Type 'mbappé' (with the acute accent).
    2. Inspect the top Players result and compare with SRCH-05.
  - **Expected:** Same top result as 'mbappe' — Kylian Mbappé. Accented and unaccented queries are equivalent after normalization.
  - **Guards:** No empty result and no divergence from the unaccented form.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-07** · `medium` — Surname prefix 'mbap' resolves Mbappé via prefix scoring
  - **Precondition:** Active edition roster contains Mbappé.
  - **Steps:**
    1. Type 'mbap' (a real prefix of the surname).
    2. Inspect the Players group.
  - **Expected:** Mbappé appears among the player results (prefix bonus). A genuine same-prefix player is acceptable, but a real Mbappé/prefix-bearing player must be present.
  - **Guards:** Prefix must score above the 0.55 threshold; result not empty.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-09** · `medium` — One-char-deletion typo 'mbape' resolves Mbappé
  - **Precondition:** Active edition roster contains Mbappé.
  - **Steps:**
    1. Type 'mbape' (one 'p' dropped).
    2. Inspect the top Players result.
  - **Expected:** Single deletion on a >=5-char token is within typo tolerance, so 'mbape' resolves Mbappé as the top player result.
  - **Guards:** 5-char token still gets max=1 typo budget; result not empty.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-14** · `medium` — 3-letter team code 'ENG' resolves England
  - **Precondition:** Active edition includes England.
  - **Steps:**
    1. Type 'ENG'.
    2. Inspect the Teams group.
  - **Expected:** England is the top Teams result via exact country-code match (score 50).
  - **Guards:** Confirms generic code path works beyond the USA alias special-case.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-15** · `medium` — Country alias 'Holland' resolves Netherlands; 'Korea' resolves South Korea
  - **Precondition:** Active edition includes Netherlands and/or South Korea.
  - **Steps:**
    1. Type 'holland' and inspect Teams group.
    2. Clear, type 'korea' and inspect Teams group.
  - **Expected:** 'holland' returns Netherlands; 'korea' returns South Korea (TEAM_ALIASES maps these). Each alias surfaces its real nation among the top team results.
  - **Guards:** Only assert for nations actually present in the active edition; otherwise mark that alias N/A.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-17** · `medium` — Two-char query returns NOTHING (Topbar minimum-length gate)
  - **Precondition:** App running.
  - **Steps:**
    1. Type a single character then watch.
    2. Type a second character so the box holds exactly 2 chars (e.g. 'me').
    3. Observe whether a request fires / dropdown opens.
  - **Expected:** Topbar only queries when trimmed length >= 2; a single char shows nothing. With 2 chars a request may fire but must never 500. No crash on any short fragment.
  - **Guards:** Primary check is no error; secondary is that very short fragments don't spray unrelated false positives.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-10** · `low` — Internal one-char typo on a longer surname (e.g. 'morals' -> Morales) resolves
  - **Precondition:** Active edition roster contains a player with a >=6-char surname (use a real one from the active roster; example pattern 'morales').
  - **Steps:**
    1. Identify a roster surname of length >=6.
    2. Type that surname with one letter deleted/changed (e.g. 'morals' for 'Morales').
    3. Inspect the Players group.
  - **Expected:** The intended player is returned (single-typo on a long token still clears threshold, scoreName > 0.55).
  - **Guards:** Pick a surname that does not collide with another roster name; assert the exact player appears.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SRCH-16** · `low` — Team-name prefix returns the team (partial 'arge' -> Argentina)
  - **Precondition:** Active edition includes Argentina (or any nation; use its first 4 letters).
  - **Steps:**
    1. Type the first 4 letters of a nation's name (e.g. 'arge').
    2. Inspect the Teams group.
  - **Expected:** The nation appears in the Teams group via prefix/startsWith bonus (e.g. 'arge' -> Argentina).
  - **Guards:** Prefix must clear 0.55 threshold; assert the specific nation.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Ask (NLQ)  ·  12 cases

- [ ] **ASK-01** · `high` — 'highest xG among midfielders' returns a midfielder-filtered xG leaderboard
  - **Precondition:** Active edition exposes xG (e.g. sportmonks live-2026 or simulation). On a historical/no-xG edition expect the degrade case (see ASK-09).
  - **Steps:**
    1. Open /ask (or type the question in the Topbar and press Enter).
    2. Submit 'Who has the highest xG among midfielders?'
    3. Read the answer sentence and the evidence table.
  - **Expected:** Intent = leaderboard. Answer names a player with team code and an xG value, phrased '… leads all Midfielders with <n> xG'. Every row in the table is a midfielder (position MF). Rows sorted descending by xG; top row matches the answer sentence. Numbers are sane (non-negative, finite).
  - **Guards:** Spot-check at least one tabled player is genuinely a midfielder. The answer's named player == row #1.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-02** · `high` — 'compare Messi and Mbappé' returns a two-player comparison with both entities
  - **Precondition:** Active edition roster contains both Messi and Mbappé.
  - **Steps:**
    1. Submit 'compare Messi and Mbappé'.
    2. Read the answer and the metric table.
  - **Expected:** Intent = comparison. Both Messi and Mbappé are extracted (surname mention extraction). Table columns are the two players (team code + surname); rows cover Goals/Assists/xG/xA/Shots/Key passes/Prog. passes/Minutes. Answer declares the player with greater goal involvement (G+A). Values match each player's real stats.
  - **Guards:** Both intended entities must appear — not two arbitrary players. If accents block one, that is a bug. Edge metric (G+A) determination must be consistent with the table.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-04** · `high` — 'who will win the World Cup' returns a grounded title-odds ranking
  - **Precondition:** Active edition has forecasts (engine populated).
  - **Steps:**
    1. Submit 'Who will win the World Cup?'
    2. Read the answer and table.
  - **Expected:** Intent = title-odds. Answer names the most-likely champion with a percentage, names the runner-up with its percentage, and cites the team count + simulation count. Table sorted descending by Win title%; #1 row == the named favourite. Probabilities are between 0% and 100%.
  - **Guards:** Favourite in prose == row 1. Percentages well-formed (e.g. '24.3%'), monotonically non-increasing down the table.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-08** · `high` — Nonsense / unanswerable query falls back gracefully
  - **Precondition:** App running.
  - **Steps:**
    1. Submit a query with no detectable intent/entity (e.g. 'what is the meaning of life').
    2. Read the answer and follow-up chips.
  - **Expected:** Intent = unknown. Answer is the graceful guidance message ('I couldn't map that to a specific analytic. Try asking about a metric leaderboard, a comparison, …'). No table rows. Follow-up suggestion chips are shown. No crash, HTTP 200.
  - **Guards:** Must NOT hallucinate an entity (extractPlayers/extractTeam should not fire on ordinary words). Fallback chips present.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-09** · `high` — xG question on a historical edition that lacks xG degrades, does not show garbage
  - **Precondition:** Switch to a historical datahub edition (e.g. 1970) that has no xG metric.
  - **Steps:**
    1. Switch to a historical edition via TournamentSwitcher.
    2. Submit 'Who has the highest xG among midfielders?'
    3. Read the answer and table.
  - **Expected:** The leaderboard still renders without crashing, but xG values fall back to 0 (metricValue returns 0 when the stat is absent) rather than NaN/undefined. Ideally the leader shown has 0.00 xG across the board, signalling the metric is unavailable for this edition rather than fabricating numbers.
  - **Guards:** No NaN, no undefined, no 500. Degradation is the expected behavior, not a populated-but-fake xG column.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-10** · `high` — Ask resolves entities against the ACTIVE edition after switching tournaments
  - **Precondition:** Two editions with disjoint rosters available.
  - **Steps:**
    1. On edition A, submit 'compare <A-only player> and <another A player>' and confirm both resolve.
    2. Switch to edition B (which lacks those players).
    3. Submit the same comparison query.
  - **Expected:** On edition B the A-only players no longer extract; the engine either falls back (unknown / single-entity lookup) or resolves B's roster — never returns the edition-A players. NLQ entity extraction is bound to the active store snapshot, identical to search.
  - **Guards:** Confirms search + Ask share one resolver AND one active-edition store. No stale cross-edition entity leakage.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-05** · `medium` — 'top scorers' returns the Golden Boot race
  - **Precondition:** Active edition has the golden-boot projection populated.
  - **Steps:**
    1. Submit 'top scorers'.
    2. Read the answer and table.
  - **Expected:** Intent = golden-boot. Answer names the leader with current goals, projected goals, and win probability. Table columns include Goals/xG/Proj./Win%. Leader in prose == row 1. Goal counts are integers and consistent with each player's stats.
  - **Guards:** 'top scorer', 'most goals', 'golden boot' must all route here. Numbers grounded, not placeholders.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-06** · `medium` — 'easiest path to the final' returns a knockout-path ranking
  - **Precondition:** Active edition has a bracket and forecasts (reachFinal > 0). Pre-knockout editions may show 'Bracket not yet determined.'
  - **Steps:**
    1. Submit 'Which team has the easiest path to the final?'
    2. Read the answer and table.
  - **Expected:** Intent = easiest-path. Answer names a team with an average projected opponent ELO and a reach-final percentage. Table columns: Team / Avg opp ELO / Reach final% / Win title%. Rows sorted ascending by Avg opp ELO (easiest first); #1 row == the named team. ELO values are realistic (~1400-2100).
  - **Guards:** If the bracket is undetermined, the graceful 'Bracket not yet determined.' message is the acceptable degrade — not a crash. Otherwise assert ascending opponent ELO.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-07** · `medium` — 'best defense' returns the strongest-defense team ranking
  - **Precondition:** Active edition has power rankings with defenseRating.
  - **Steps:**
    1. Submit 'best defense in the tournament'.
    2. Read the answer and table.
  - **Expected:** Intent = best-defense. Answer names the team with the strongest defense and a rating out of 100. Table columns: Team / Offense / Defense / Power / Momentum, sorted descending by Defense; #1 row == named team.
  - **Guards:** Spelling variants ('defence','meanest defense','best defense') route here. The named team must top the Defense column, not the Offense column.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-12** · `medium` — Search box 'Press Enter to ask' handoff routes the query to /ask
  - **Precondition:** App running.
  - **Steps:**
    1. Type a natural-language question into the Topbar (e.g. 'highest xG among midfielders').
    2. Press Enter (do not click a dropdown row).
  - **Expected:** Navigates to /ask?q=... and the AskClient auto-runs the query on mount, rendering the same grounded answer as ASK-01. Confirms the search-to-Ask bridge and that the shared resolver yields identical entity handling in both surfaces.
  - **Guards:** URL contains the encoded query; answer renders without a manual re-submit.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-03** · `low` — 'compare Messi vs Mbappé' (vs phrasing) behaves identically to 'compare'
  - **Precondition:** Active edition roster contains both players.
  - **Steps:**
    1. Submit 'Messi vs Mbappé'.
    2. Confirm intent and entities.
  - **Expected:** The ' vs ' trigger routes to the comparison intent with both players, same structure as ASK-02.
  - **Guards:** Confirms the alternate comparison trigger; both entities present.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **ASK-11** · `low` — Per-90 leaderboard applies the minutes gate ('highest progressive passes per 90 among defenders')
  - **Precondition:** Active edition has per90 stats and minutes data.
  - **Steps:**
    1. Submit 'Highest progressive passes per 90 among defenders'.
    2. Inspect the table's Mins column.
  - **Expected:** Intent = leaderboard with a '/90' metric column. Only defenders with >= 180 minutes appear (per90 path raises minMinutes to 180); column header shows 'Prog. passes/90'. Leader matches answer sentence; values are per-90 rates, not raw totals.
  - **Guards:** Every tabled player has Mins >= 180 and position DF. Confirms the per90 minutes threshold is enforced (avoids tiny-sample outliers).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Globe  ·  7 cases

- [ ] **GLOBE-01** · `high` — 3D globe loads and renders highlighted nations
  - **Precondition:** App running on a WebGL-capable desktop browser; any tournament active.
  - **Steps:**
    1. Navigate to /globe.
    2. Wait for the 'Rendering globe…' spinner to disappear.
    3. Observe the rendered sphere and country polygons.
  - **Expected:** The dark globe renders with the teal atmosphere. Participating nations' polygons are raised and colored (their team color, ~cc alpha); non-participating countries are flat and dark (rgba(45,31,71,0.55)). The hint bar 'Drag to rotate · scroll to zoom · click a highlighted nation' is visible. No blank/black canvas.
  - **Guards:** If features.length stays 0 the world-countries.json fetch failed — globe stays on the spinner. Verify /world-countries.json returns 200 and valid topojson.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GLOBE-04** · `high` — Select a nation opens the country detail panel and drills in
  - **Precondition:** /globe loaded with the live-2026 or a full edition active.
  - **Steps:**
    1. Click a highlighted participating nation.
    2. Observe the right-hand detail panel.
    3. Wait for the squad to load.
    4. Click a player row, then go back and click 'Full profile →'.
  - **Expected:** Auto-rotate stops. Panel slides in showing flag, name, confederation (and Group if assigned). 'World Cup History' shows Titles/Runners-up/First/Best from wcHistory(code). Head Coach shows the manager or 'Not available on this feed' when manager is '—'/empty. Squad loads via /api/teams/[id], grouped GK/DF/MF/FW. A player row links to /players/[id]; 'Full profile →' links to /teams/[id]. No crash if squad is empty (shows 'No squad data on this feed.').
  - **Guards:** Squad fetch reads j.data?.squad ?? [] — a 500 or missing data must yield empty list, not a crash. Closing (X) resets selection and resumes auto-rotate.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GLOBE-06** · `high` — No WebGL crash; graceful behavior without WebGL
  - **Precondition:** Desktop browser.
  - **Steps:**
    1. Load /globe normally and confirm it renders.
    2. Disable WebGL (or use a browser/profile without it) and reload /globe.
  - **Expected:** With WebGL present, no console errors from three.js / react-globe.gl. With WebGL disabled, the page must not throw an uncaught client exception that blanks the whole app shell — the sidebar/topbar remain usable. (Globe is dynamically imported ssr:false so the server render never touches WebGL.)
  - **Guards:** react-globe.gl touches window/WebGL; it is loaded via next/dynamic ssr:false — confirm no server-side WebGL reference error in logs.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GLOBE-02** · `medium` — Auto-rotate, manual rotate and zoom
  - **Precondition:** /globe loaded with polygons visible, no country selected.
  - **Steps:**
    1. Observe the globe without touching it for a few seconds (auto-rotate at speed 0.45).
    2. Drag the globe to rotate manually.
    3. Scroll/pinch to zoom in and out.
  - **Expected:** Globe auto-rotates while idle. Dragging rotates it smoothly; scrolling zooms the camera. Initial point-of-view frames lat 20/lng 0 at altitude 2.4. No jitter, no thrown WebGL errors in the console.
  - **Guards:** Auto-rotate must stop when a nation is selected (see GLOBE-04) and resume on close.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GLOBE-07** · `medium` — Mobile / small viewport fallback and responsive sizing
  - **Precondition:** Mobile viewport or narrow window (<= 640px).
  - **Steps:**
    1. Open /globe at a phone-width viewport.
    2. Select a nation and view the detail panel.
    3. Resize the window narrower and wider.
  - **Expected:** Globe canvas resizes to its container via the ResizeObserver (no overflow/scrollbars on the globe wrapper). The detail panel becomes full-width (max-w-md / w-full) on small screens instead of a fixed 26rem rail, and its body scrolls. Globe remains interactive or degrades without crashing.
  - **Guards:** Confirm the 78vh/min-h-520px container does not collapse to 0 height on mobile (would leave the globe invisible).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GLOBE-03** · `low` — Hover label shows flag + nation name only for participants
  - **Precondition:** /globe loaded.
  - **Steps:**
    1. Hover over a participating nation (e.g. the active tournament's host).
    2. Hover over a non-participating country (e.g. a country with no team).
  - **Expected:** Participating nation shows a tooltip with its flag emoji and full name. Non-participating country shows no label (empty string). Alias mapping resolves names like 'United States of America'→USA, 'Korea Republic'→South Korea, 'Cote d'Ivoire'→Ivory Coast, 'Czech Republic'→Czechia, 'Türkiye'→Turkey.
  - **Guards:** keyFor() normalization/alias bugs surface here as a participant that won't highlight or label.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GLOBE-05** · `low` — Selected nation is visually emphasized
  - **Precondition:** /globe loaded.
  - **Steps:**
    1. Select a nation.
    2. Compare its polygon to the others.
  - **Expected:** The selected nation's polygon uses full team color (not the cc alpha) and a raised altitude (0.12 vs 0.05 for other participants, 0.008 for non-participants). Transition is animated (~300ms).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Settings  ·  3 cases

- [ ] **SET-01** · `high` — Settings load defaults then persist changes to wc26:prefs
  - **Precondition:** App running; /settings reachable.
  - **Steps:**
    1. With no stored prefs, open /settings and note defaults.
    2. Change Odds format to Decimal, Density to Compact, Timezone to Local.
    3. Toggle 'AI insight digests' on.
    4. Inspect localStorage 'wc26:prefs' after each change.
  - **Expected:** Defaults: Odds format Percentage, Density Comfortable, Timezone UTC, notifications goals/kickoff/upsets ON and insights OFF. Each change writes the full prefs object to localStorage['wc26:prefs'] immediately and shows a transient 'Preferences saved.' message (~1.5s). Selected option/toggle reflects the new value.
  - **Guards:** update() does setState + localStorage.setItem + setSaved(true) with a 1500ms reset. Stored prefs are merged over DEFAULT on load ({...DEFAULT, ...JSON.parse}).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SET-02** · `medium` — Settings persist across reload and tolerate corrupt/partial storage
  - **Precondition:** /settings reachable.
  - **Steps:**
    1. Set non-default prefs, then reload /settings — confirm selections restored.
    2. Manually set localStorage['wc26:prefs'] to invalid JSON (e.g. 'not-json') and reload.
    3. Manually set it to a partial object (e.g. {"oddsFormat":"american"}) and reload.
  - **Expected:** Reload restores all saved selections. Invalid JSON is swallowed (try/catch) and the UI falls back to DEFAULT without crashing. A partial stored object is merged over DEFAULT, so missing keys (e.g. notifications) keep their default values rather than becoming undefined.
  - **Guards:** Load effect wraps JSON.parse in try/catch; merge is {...DEFAULT, ...stored}. Note nested notifications partial would shallow-merge — verify no crash if notifications absent.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **SET-03** · `low` — About panel shows competition metadata
  - **Precondition:** /settings reachable; a competition is active.
  - **Steps:**
    1. Open /settings and read the About panel.
  - **Expected:** About panel lists Platform 'WC26 Intelligence v1.0', Competition as '{name} ({season})' from getCompetition(), Hosts as the joined hostCountries, Data source 'Deterministic simulation engine', Simulations '8,000 Monte Carlo runs', and Analytics 'ELO · bivariate-Poisson · xG · power ratings'. Competition/Hosts reflect the active tournament.
  - **Guards:** page is force-dynamic and reads getCompetition() server-side; values should track the active edition.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Favorites  ·  3 cases

- [ ] **FAV-01** · `high` — Favorites empty state and team list load
  - **Precondition:** No favorites stored; /favorites reachable; /api/teams returns teams.
  - **Steps:**
    1. Clear localStorage['wc26:favorites'].
    2. Open /favorites and wait for load.
    3. Read the 'Your Favorites' section and the 'Follow teams' list.
  - **Expected:** While loading, 'Your Favorites' shows 'Loading…'. After load with no favorites it shows 'No favorites yet. Tap a star below to follow a team.' The 'Follow teams' grid lists every team from /api/teams with flag, name, and an unfilled star.
  - **Guards:** ready flag flips in finally(); favTeams = teams filtered by favorites. Empty favorites array yields the empty copy, not Loading.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **FAV-02** · `high` — Toggle favorite persists to wc26:favorites and survives reload
  - **Precondition:** /favorites loaded.
  - **Steps:**
    1. Click the star next to a team in 'Follow teams'.
    2. Confirm it appears in 'Your Favorites' with title odds.
    3. Inspect localStorage['wc26:favorites'].
    4. Reload /favorites.
    5. Click the same star again to unfavorite.
  - **Expected:** Toggling adds the team id to favorites, fills its star (accent-amber), and surfaces a card in 'Your Favorites' linking to /teams/{id} with 'Title odds {winTitle*100}%'. localStorage['wc26:favorites'] is a JSON array of ids. After reload favorites are restored. Toggling again removes the id and the card.
  - **Guards:** toggle() adds/removes id and writes JSON.stringify(next) to KEY before returning the new state. winTitle defaults to 0 → '0.0%' if forecast is null.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **FAV-03** · `medium` — Favorites resilient to corrupt storage and missing forecast
  - **Precondition:** /favorites reachable.
  - **Steps:**
    1. Set localStorage['wc26:favorites'] to invalid JSON and reload /favorites.
    2. Favorite a team whose forecast is null (e.g. a non-qualified or live team with no forecast).
  - **Expected:** Invalid JSON is caught and favorites fall back to [] without crashing. A favorited team with forecast === null renders 'Title odds 0.0%' (winTitle ?? 0) rather than NaN or a crash.
  - **Guards:** Load effect try/catch sets favorites([]) on parse error. Title odds uses (t.forecast?.winTitle ?? 0).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Guide  ·  3 cases

- [ ] **GUIDE-01** · `high` — Every metric the app displays has a glossary entry
  - **Precondition:** None.
  - **Steps:**
    1. Open /guide and read the glossary.
    2. List the metrics shown elsewhere: xG, xA, shot map, ELO, power rating, form, Monte Carlo, Title %, stage-reach %, group-win/advance %, Δ pre-WC vs now, Golden Boot projection, implied probability, vig/de-vig, edge/EV, Kelly.
    3. Confirm each has a definition.
  - **Expected:** All listed metrics appear as glossary terms with plain-language definitions. xG is explained with a concrete example (0.7 vs 0.03). xA, ELO ranges, Monte Carlo (8,000 runs), and Golden Boot projection (folds in xG) are present and accurate. No metric used on Analytics/Predictions/Betting is left undefined.
  - **Guards:** If the app later surfaces a new metric (e.g. field tilt, possession) not in the glossary, flag it as a coverage gap.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GUIDE-02** · `medium` — Glossary deep-link anchors and internal links work
  - **Precondition:** None.
  - **Steps:**
    1. Open /guide.
    2. Navigate to /guide#xg, #xa, #elo, #power, #monte-carlo, #title, #stage-reach, #golden-boot, #vig, #edge-ev, #kelly.
    3. Click the in-body links: 'Rankings' (#power), 'Ask' (footer), and tour cards.
  - **Expected:** Each anchor scrolls to the matching term (scroll-mt-24 offset keeps it below the header). 'Rankings' link goes to /rankings, 'Ask' to /ask. Every tour card links to its stated route (/globe, /live, /groups, /predictions, /bracket, /betting, /clubs, /discoveries, /history). No broken anchors or 404s.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **GUIDE-03** · `low` — Guide accurately describes tournament switching and live-vs-simulated
  - **Precondition:** None.
  - **Steps:**
    1. Open /guide and read Quick Start and the 'Simulated 2026' deep-dive.
    2. Cross-check claims against actual selector behaviour.
  - **Expected:** Quick Start correctly states the top-right selector switches the whole app (live 2026, past editions, Simulated 2026 sandbox). The Simulated section correctly frames it as deterministic/offline and not for real predictions. Descriptions match the editions actually offered in the selector.
  - **Guards:** If the selector's available editions diverge from the guide's list, flag the doc drift.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_


---

## Cross-cutting  ·  12 cases

- [ ] **XCUT-01** · `high` — Tournament-switch matrix: live-2026 → men-2022 → women-2023 → 1990s → 1930s, spot-check core pages each hop
  - **Precondition:** Start on live-2026. Have /, /teams, /players, /standings, /matches open in mind for each hop.
  - **Steps:**
    1. Switch to men-2022; load /, /teams, /players, /standings, /matches.
    2. Switch to women-2023; reload the same five pages.
    3. Switch to a 1990s historical edition (e.g. 1994/1998); reload the five pages.
    4. Switch to a 1930s historical edition (e.g. 1930/1934); reload the five pages.
    5. Switch back to live-2026; reload the five pages.
  - **Expected:** After EACH switch, every page shows the NEW edition's data: teams list belongs to that edition (e.g. 2022 has Argentina champions; 1930 has the original 13), players are that edition's squads, standings/matches are that edition's fixtures with that edition's results. No page shows the previous edition's rows or renders empty. This is the WC-008 regression guard — snapshot-keyed indexes must rebuild on the globalThis snapshot swap so getTeam/getPlayer don't miss every lookup.
  - **Guards:** The classic failure: getTeams()/getPlayers() return the new snapshot's rows while getTeam()/getPlayer() hit a STALE index → lists populate but detail/lookups miss and surfaces render empty. Spot-check at least one detail page (/teams/[id]) per hop, not just lists.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-02** · `high` — Tournament switch rebuilds analytics engine and percentiles
  - **Precondition:** On live-2026, note a value on /analytics or /rankings (e.g. a top scorer / percentile).
  - **Steps:**
    1. Visit /analytics, /rankings, /predictions, /bracket on live-2026.
    2. Switch to men-2022 and revisit all four.
    3. Switch to women-2023 and revisit all four.
  - **Expected:** Derived/analytics surfaces (rankings, predictions, bracket seeds, percentile tables) recompute against the new edition — no carried-over numbers from the prior tournament. setDataset clears _percentileCache and the __wcEngine global on every swap.
  - **Guards:** Bracket must not crash on TBD seeds mid-switch (WC-004); /predictions must not crash on a group-base lookup gap (WC-018).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-03** · `high` — Live-load window: no page crashes within ~60s of a fresh deploy / cold start
  - **Precondition:** Fresh deploy or freshly restarted server with DATA_SOURCE=sportmonks so live-2026 is mid-loading; act within the first ~60s.
  - **Steps:**
    1. Immediately hit /, then /live, /matches, a /matches/[id] (including a knockout/TBD fixture), /standings, /rankings, /bracket, /insights, /storylines.
    2. Run a search from the topbar during the same window.
  - **Expected:** Not one of these pages throws a client-side exception or returns a 500, even while teams/players/fixtures are still resolving and knockout fixtures are TBD. Pages may show partial/loading content but must degrade gracefully. This exercises the #1 bug class: undefined entity lookups (WC-002/003/004/007). Rule: no `!` non-null assertion on a team/player lookup.
  - **Guards:** getPlayerView returns undefined when its team is unresolved (must omit, not crash). MatchCard / live / matchDetail must filter or guard TBD fixtures. /api/search must resolve both sides up front and drop unresolved fixtures (WC-007).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-04** · `high` — Match-state matrix: scheduled / live / halftime / finished labels are correct
  - **Precondition:** An edition with fixtures in multiple states (live-2026 during play, or simulate states).
  - **Steps:**
    1. Open a SCHEDULED fixture, a LIVE fixture, a HALFTIME fixture, and a FINISHED fixture (match card + /matches/[id]).
    2. Read each match's summary/narrative and status label.
  - **Expected:** Scheduled: future tense / no result. Live & Halftime: present-tense narrative, no team described as having 'won' (WC-013). Finished: past tense, winner stated only here. Scores/minute reflect the actual state. Live timeline grows on refresh; finished shows final events.
  - **Guards:** generateMatchSummary must branch LIVE/HALFTIME separately from FINISHED.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-05** · `high` — Timezone: kickoff DAY and time correct everywhere from a non-UTC machine
  - **Precondition:** Set the test machine/browser to a non-UTC zone that flips the calendar day vs UTC (e.g. America/Los_Angeles for an evening NA kickoff).
  - **Steps:**
    1. View kickoff times on /matches, /matches/[id], /live, home upcoming, and any fixture list.
    2. Cross-check the displayed DAY and time against the true local kickoff.
  - **Expected:** Every date/time is rendered in the viewer's own timezone via <LocalTime>. An evening North-American kickoff must NOT roll to 'tomorrow 1pm' (WC-011). Both the day-of-week/date AND the clock time are correct, consistently across all surfaces.
  - **Guards:** Check that no surface still hardcodes timeZone:'UTC'. The day is the trap, not just the time.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-06** · `high` — Hollow live feed falls back to the full simulation (not a blank app)
  - **Precondition:** Force a hollow live response: live feed returns teams/fixtures but few/no squads (<80% teams with squads or <=100 players) — e.g. quota/key/plan failure on the squad calls.
  - **Steps:**
    1. Activate live-2026 under the hollow condition.
    2. Load /, /teams, /players, /standings, /matches.
    3. Open the tournament switcher pill.
  - **Expected:** isHealthyLive() detects the hollow snapshot and activateTournament serves the complete built-in simulation labeled 'Simulation (live feed unavailable)' instead of a blank/broken app (WC-005). Every page is fully populated. The hollow snapshot is NOT cached, so a later switch/reload re-fetches and auto-upgrades to live once healthy.
  - **Guards:** Confirm the console warns '[data] Live feed incomplete …' and that switching away and back re-attempts the live fetch.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-07** · `high` — Graceful degradation: advanced metrics hidden/labeled on sources lacking them
  - **Precondition:** Compare a full-event edition (men-2022 StatsBomb) vs a basic-stats source (live SportMonks/API-Football and historical datahub).
  - **Steps:**
    1. On men-2022 open a player page, golden boot/rankings, /standings, /analytics — note xG/xA/progressive/pressures/touches-in-box values.
    2. Switch to live-2026 (or a datahub historical edition) and open the same surfaces.
  - **Expected:** On a source WITHOUT advanced metrics, those metrics and their percentiles are HIDDEN or explicitly labeled 'not available for this source' — NOT shown as a uniform 0 / '0th percentile' weakness, and golden boot must not read 'xG 0', standings must not read 'xG 0.0/0.0' for every team (WC-016). datasetMeta().hasAdvancedMetrics / hasShotData drive the hiding; percentiles for all-zero metrics are omitted (getPlayerView skips a metric whose sorted column is uniformly 0).
  - **Guards:** Datahub editions are pre-tracking (no xG); SportMonks plan may lack xG. The flag must be derived from data actually present, not hardcoded true.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-08** · `medium` — Early-tournament / zero-minutes data: no divide-by-zero, no uniform ranks
  - **Precondition:** An edition where some players have 0 minutes / 0 stats (live-2026 early, or pre-tournament squads).
  - **Steps:**
    1. Open a player with 0 minutes (per-90 + percentiles).
    2. Open /rankings and /analytics where percentile peers may be sparse.
  - **Expected:** Per-90 math uses minutes floored at 1 (no NaN/Infinity). Percentiles for a position with no qualifying (>=45 min) peers default sensibly (empty table → metric omitted or neutral 50), not every player ranked identically or shown as 0th percentile. Pages render without NaN/Infinity on screen.
  - **Guards:** percentileTables only includes players with >=45 minutes; with none, the table is empty — surfaces must handle the empty table.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-09** · `medium` — Match event timelines across three code paths (live / just-finished / older-finished)
  - **Precondition:** live-2026 with the events poller active (60s).
  - **Steps:**
    1. Open a LIVE match and watch across 1–2 refresh cycles.
    2. Open a match that just FINISHED.
    3. Open an OLDER finished match whose timeline was empty at first load.
  - **Expected:** Live: timeline (goals, VAR/disallowed, cards, subs) grows each refresh. Just-finished: final events are captured. Older-finished: timeline is backfilled exactly once (capped at 8/tick) and not re-fetched thereafter (eventsFetched set). Scorers/teams resolve to real players; own-goal/VAR are surfaced (WC-015).
  - **Guards:** Backfill must be one-time per match even when a finished match genuinely has no events.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-10** · `medium` — SportMonks team-code collisions and predictions stability on live data
  - **Precondition:** live-2026 on SportMonks.
  - **Steps:**
    1. On /teams and /groups confirm Australia vs Austria and Iran vs Iraq are distinct teams.
    2. Open /predictions and /betting.
    3. Open /storylines / breakout discoveries.
  - **Expected:** Australia (AUS) and Austria (AUT), Iran (IRN) and Iraq (IRQ) are separate teams with correct flags/groups (WC-017 uses real short_code). /predictions does not 500 on a group-base lookup gap (WC-018). Breakout does not flag 25-year-olds when SportMonks gives age 0 (requires 17<=age<=23) (WC-019). Betting Edge shows odds joined by team+kickoff date or an honest empty state, never a perpetual 'odds loading…' (WC-021).
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-11** · `medium` — Historical datahub editions populate teams grouped by confederation
  - **Precondition:** Any datahub historical edition active (1930–2015).
  - **Steps:**
    1. Switch to several historical editions and open /teams each time.
    2. Open /matches and /history for the same edition.
  - **Expected:** /teams is populated (grouped by confederation: UEFA/CONMEBOL/CAF/etc.) for every datahub edition — never empty (WC-020 regression: blank confederation filtered every team out). Matches/results render; advanced surfaces degrade gracefully (no xG).
  - **Guards:** Each of the ~27 datahub editions should be spot-checked at least at the group/total level.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_

- [ ] **XCUT-12** · `medium` — Search form variations resolve in the UI across editions
  - **Precondition:** A populated edition active.
  - **Steps:**
    1. From the topbar search, try: surname, full name, flipped order (last first), abbreviated 'F. Last', accented name, name prefix, a typo (one transposition), and a team code/alias.
    2. Repeat one or two on the live edition (abbreviated names).
  - **Expected:** Each form returns the correct primary entity (resolver shared by search + NLQ). No 500. Short tokens don't fuzzy-match unrelated names (kane↛Sané; holland↛Jun-Ho); typos within tolerance still resolve (halaand→Haaland). Abbreviated 'L. Messi' style names resolve on the live feed.
  - **Guards:** Runner-up noise on multi-word names is a known cosmetic (WC-014); only flag if the PRIMARY result is wrong.
  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_
