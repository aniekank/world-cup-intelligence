# Build Retrospective — World Cup Intelligence

An honest post-mortem of building this app: where the bugs actually came from, and
how to approach the next live-data product to minimize them. Companion to `BUGS.md`
(the defect record this analysis is drawn from) and `ROADMAP.md`.

**Written:** 2026-07-04, after ~77 tracked issues (WC-001…077) and a full tournament run.

---

## 1. Where the bugs came from (root-cause taxonomy)

Drawn from `BUGS.md`. The bugs were not random — they cluster into a few structural
causes. Rough share of tracked issues in each:

| # | Cluster | ~Share | Representative bugs |
|---|---------|--------|---------------------|
| 1 | **External live feed instability + provider migration** | ~40% | WC-005 hollow feed, WC-008/044 stale indexes, WC-051 pagination cap, WC-055 lagging aggregate + dropped events, WC-073 quota amplification, WC-077 halftime jitter; **WC-051/052/053/054/056 = regressions from the SportMonks→API-Football swap** |
| 2 | **Live match-state modeled after the fact** | ~10% | WC-039 live clock, WC-050 ET/pens, WC-057 stuck-LIVE, WC-058 draw% in KO, WC-071 shootout shown 0-0 FINISHED, WC-077 halftime |
| 3 | **Real-vs-modeled boundary leaked** | ~12% | WC-062/067 "currently 1st in group" in KO, WC-069 stale 7-1 headline, WC-070 inverted expectedFinish, WC-074 "better team won", WC-076 draw-framed track record |
| 4 | **Missing fields rendered as real** | ~10% | WC-016/021/066 xG zeros, WC-023/056 fabricated 78 attributes, WC-026 €0m, WC-065 absent clean sheets |
| 5 | **Non-null assertions crashing on transient undefined** | ~10% | WC-002/003/004/007/008/040 (`getTeam(id)!.flag` during live load) |
| 6 | **Search/NLQ breadth** | ~15% | WC-006/009/010/014, WC-034…067 — mostly edge coverage, well-managed via one shared resolver + a generative corpus |

**Meta-point:** most of these were inherent to the bet — a live product against a real,
mid-tournament, incomplete third-party feed, on a trial that lapsed, built solo. That is
close to the hardest possible data situation. A large fraction of "bugs" were really
"reality didn't match the feed's happy path, discovered in production."

---

## 2. Architectural recommendations (by leverage)

1. **Treat every external feed as hostile — ~80% of the win.**
   - *Anti-corruption layer:* one boundary module per provider that validates the raw
     response against a strict schema (zod) and maps to your domain types. Provider quirks
     (null codes, id namespaces, missing dob/xG, lagging aggregates) get normalized in one
     place and never leak. Kills most of cluster 1.
   - *Recorded fixtures + replay harness:* capture real API responses to disk as versioned
     JSON; run the whole pipeline against them offline. Never touch the live API to test
     (that is what drained the quota). Replay a real match tick-by-tick — catches state bugs
     like WC-077 before they ship.
   - *Contract test* that fails loudly when the feed shape drifts.
2. **Design the domain model — including hard cases — before any UI.** A match-status state
   machine (`SCHEDULED → LIVE → HT → ET → BREAK → PENALTIES → FINISHED`) with `phase` and
   `decidedBy` first-class, plus written invariants. "A started match never reverts to
   scheduled" is WC-077 as a one-line invariant instead of a production hunt. Kills cluster 2.
3. **Make the provider interface real from day one; never migrate without a conformance net.**
   Both providers implement the same validated interface and pass the same golden-fixture
   conformance suite. The mid-tournament swap would have surfaced every gap in CI, not over
   two weeks in production. Kills the WC-05x regression wave.
4. **Separate observed from modeled at the type level.** Brand the types; make
   `TournamentPhase` a *required argument* to any function that renders a status sentence, so
   "Currently 1st in Group H" can't compile without a phase check. Kills cluster 3.
5. **One "no-fabrication / degrade-honestly" contract.** Every metric carries an `available`
   flag; a single `<Metric>` component hides/labels when absent; a test asserts no raw `0`
   leaks for a source lacking the field. (You converged on `hasXg`/`hasAttrs` — start there.)
   Kills cluster 4.
6. **Ban `!` on external/async lookups** (lint rule) + "degrade, never throw" at each page
   boundary. Kills cluster 5.
7. **Resilience as a designed subsystem.** Define the fallback ladder upfront —
   live → last-known-good cache → simulation — with a user-facing state for each and a quota
   budget (one boot fetch, backoff on limit). Collapses the WC-041/042/044/045/048/072/073/075
   chain into one built-right system.
8. **Observability from day one.** Ship the debug endpoint + structured state-transition logs
   *before* launch, not during the WC-077 hunt.
9. **Sequence: stabilize the data spine before breadth.** Don't build broad on an unstable base.

---

## 3. Procedural & operational critique

The architecture layer explains why the code broke. This layer explains why the bugs were
found so late and cost so much. The unifying theme: **discovery and verification happened in
the most expensive possible place — by end users, on the live surface, during matches, after
deploy — and verification consumed the production resource.** Move both earlier and off prod.

**Development workflow / quality gates**
- Straight-to-`main`, no branch/PR/CI-blocks-merge — nothing mechanically caught a regression
  before it was live. A conformance-suite merge gate would have blocked the WC-05x wave.
- CI arrived mid-project (the "add CI" / "stub server-only" commits) — gates should exist at
  commit #1.
- No enforced Definition of Done — each recurring cluster is partly a skipped DoD checkbox
  (handles-missing-data, knockout/tie case, no-fabrication, roadmap updated, has a test).
- Premature "fixed" claims — fixing by reasoning and declaring victory without a reproduction.

**Testing practice** (distinct from test architecture)
- Verification ran against production and **burned the shared quota** (WC-073 was partly
  self-inflicted by the act of checking). Separate test path / read-only replay needed.
- Verification was **gated by the real-world schedule** — you could only observe live behavior
  when a match was on. Strongest argument for the fixture/replay harness.
- No timezone/clock test matrix (WC-011, frozen briefing date, UTC grouping).

**Release & environments**
- One environment — you debugged on the site users see. The status banner exists *because*
  there is no staging.
- Deploy operations generated their own incidents (Render rollback-pin confusion, dev/prod
  `.next` collision).
- No pre-deploy smoke test ("home renders, live-status sane, zero console errors").

**Operations & observability**
- Outages were discovered **from the user, not an alert**. Umami is analytics, not error/uptime
  monitoring. No error tracking, no uptime check, no quota-usage alert.
- No runbook for a live-event product — a time-boxed event with a fixed schedule and hard end
  date, yet no match-day checklist or "feed died mid-match → do X."

**Planning, vendor & resource management**
- A pipeline built on an **expiring trial** — the frozen-overlay capture was an "URGENT before
  the trial ends" scramble that became a permanent architectural wart.
- Single provider + single person = two SPOFs; no warm second source behind the same interface.
- High work-in-progress (live + historical + NLQ + betting + lab + marketing at once) inflated
  regression risk and starved any one track of stabilization.
- Record-keeping outran by the pace — the roadmap sat unreconciled for ~2 weeks with a shipped
  feature marked "proposed." A "flip the roadmap on merge" habit closes it.

---

## 4. What went right (keep doing)

- **Disciplined `BUGS.md`** — root cause + fix + commit hash on every entry. Rare, and it made
  this retrospective possible.
- **A hermetic test per bug** — the suite grew to 112 and became a real regression net.
- **The shared NLQ resolver + generative corpus (WC-010)** — the right pattern; it's why the
  huge NLQ surface stayed manageable (cluster 6 is the model, not the problem).
- **"Never fabricate, degrade honestly"** as a stated principle.
- **Durable lesson capture** in the memory notes.

---

## 5. Next-build "week-1 spine" checklist

Before building any surface, stand up the spine:

- [ ] **Domain model + state machine** — match status incl. ET/pens/phase/`decidedBy`; written
      invariants; tests. Decide observed-vs-modeled type branding. `TournamentPhase` required by
      every status-rendering function.
- [ ] **Provider interface + anti-corruption layer** for ONE provider — zod schema at the
      boundary, mapped to domain types. Nothing raw leaks past it.
- [ ] **Golden fixtures + replay harness** — capture real responses to disk; run the whole
      pipeline offline; replay one match tick-by-tick. A provider-conformance suite any adapter
      must pass.
- [ ] **Resilience ladder + status contract** — live → cache → sim, one user-facing state each;
      quota budget (one boot fetch, backoff on limit).
- [ ] **No-fabrication kit** — `available` flags + a single `<Metric>` component; a test that no
      raw `0` leaks for an absent field.
- [ ] **Safety lints** — ban `!` on lookups; "degrade, never throw" page boundary.
- [ ] **Gates from commit #1** — CI runs typecheck + tests + conformance on every push; branch +
      PR even solo; staging deploy on fixtures + smoke test before prod.
- [ ] **Ops from day one** — debug endpoint + structured transition logs; uptime + quota + error
      alerts; a one-page match-day runbook.
- [ ] **DoD checklist** — missing-data handled, knockout/tie case, no fabrication, test added,
      roadmap flipped, smoke-tested.
- [ ] **Sequence** — get the spine rock-solid on one source, *then* add surfaces.

---

## The one-line takeaway

The single highest-leverage change is **recorded fixtures behind an anti-corruption layer**: it
converts *"discover the feed's lie in production"* into *"discover it once, in a test."* Nearly
every cluster above — technical and operational — shrinks once discovery and verification move
off the live path.
