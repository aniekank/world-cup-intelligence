# Roadmap — World Cup Intelligence

Proposed features and enhancements, so good ideas don't get buried under bug-fixing.
Companion to `BUGS.md` (which tracks defects). Updated as items ship.

**Last updated:** 2026-06-17

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
| 📋 | **Fail-fast on bad key** | Detect auth failures and stop retrying immediately, so a dead key never bogs down boot (and never trips a deploy health-check rollback). |
| 📋 | **`API_FOOTBALL_HOST` toggle** | Support both the direct `api-sports.io` host and the RapidAPI host via one env var (would have saved the key incident). |
| ✅ | **SportMonks player metadata + coaches** | Per-team `players.player;coaches.coach` calls give real **ages** (breakout works), heights, **full rosters** (1249 players), and **managers** (Scaloni/Deschamps/…) — which unblocks manager stories. Market value still absent. |
| ✅ | **Historical archive — every World Cup** | All other editions 1930–2015 (men + women) from the Fjelstul DB via datahub.io (`npm run data:datahub`): real results, scorers (Müller's 10, Pelé), squads, managers, champions. Bundled as 27 switchable editions; WC-016 degradation hides the advanced surfaces (pre-tracking era). Deep StatsBomb kept for 2018/2022/W-2019/W-2023. |

---

*To propose something new, add a row with status 📋 and a one-line description. When it ships, flip to ✅ and note the file/commit.*
