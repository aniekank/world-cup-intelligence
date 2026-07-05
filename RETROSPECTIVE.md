# Build Retrospective — World Cup Intelligence

An honest post-mortem of building this app, and a reusable field manual for the next
live-data product. Drawn from `BUGS.md` (WC-001…077), `ROADMAP.md`, and the git history.
Companion artifact (visual version): a flight-recorder-styled build retrospective.

**Written:** 2026-07-04, after ~77 tracked issues and a full tournament run.

The one idea underneath all of it: **catch the defect at the station where it's made, not
at final inspection** (Deming / Toyota, applied to code). Almost everything below is a way
to move discovery and verification off the live path and earlier in the process — the exact
opposite of vibe coding.

---

## 1. Where the bugs came from (root-cause taxonomy)

The bugs weren't random. They cluster into six causes, ranked by share of tracked issues
(which is roughly cost). Each cluster's countermeasure is the thing that dissolves it next time.

| # | Cluster | ~Share | Severity | Representative defects |
|---|---------|--------|----------|------------------------|
| 1 | External feed instability + provider migration | ~40% | Critical | WC-005/008/044/051/055/073/077; **WC-051/052/053/054/056 = swap regressions** |
| 2 | Real-vs-modeled boundary leaked | ~12% | High | WC-062/067/069/070/074/076 |
| 3 | Live match-state modeled after the fact | ~10% | High | WC-039/050/057/058/071/077 |
| 4 | Missing fields rendered as real | ~10% | Medium | WC-016/021/023/026/056/065/066 |
| 5 | Non-null assertions on transient undefined | ~10% | Medium | WC-002/003/004/007/008/040 |
| 6 | Search / NLQ breadth (well-managed) | ~15% | Low | WC-006/009/010/014, 034–067 |

**1 · The live feed was the dominant bug source.** Hollow feeds, stale indexes, a pagination
cap hiding Messi's goals, a lagging aggregate + dropped events, quota amplification. Worst of
all, the mid-tournament SportMonks→API-Football swap leaked provider quirks straight into the
app as a regression wave (WC-051/052/053/054/056).
*Countermeasure:* an **anti-corruption layer** (zod-validated boundary per provider) + **recorded
fixtures and a replay harness** + a **golden-fixture conformance suite both providers pass**.
Never verify against the live API — that is what drained the quota.

**2 · Predictions and stale phase shown as fact.** "Currently 1st in Group H" during the
knockouts, a three-week-old 7-1 headlining forever, inverted `expectedFinish`, "the better team
won" when they lost on pens.
*Countermeasure:* separate **observed from modeled at the type level**; make `TournamentPhase`
a **required argument** to any status-rendering function so a stale-phase sentence can't compile.

**3 · Live match-state retrofitted, not designed.** Clock, ET/pens, stuck-LIVE, draw% on a
knockout, a shootout shown as a 0-0 FT, the halftime disappearance.
*Countermeasure:* model the **state machine before any UI** (`SCHEDULED → LIVE → HT → ET → BREAK
→ PENALTIES → FINISHED`, with `phase` + `decidedBy`), with written invariants ("a started match
never reverts to scheduled" = WC-077 as a one-liner) and a **golden match-replay test**.

**4 · Absent data rendered as real.** xG as 0, fabricated "78" attributes, "€0m valuation".
*Countermeasure:* one **no-fabrication contract** — every metric has an `available` flag, a single
`<Metric>` hides/labels when absent, and a test asserts no raw `0` leaks for an absent field.

**5 · Non-null assertions crashing on transient undefined.** `getTeam(id)!.flag` during live load.
*Countermeasure:* **lint-ban `!` on lookups**; return `undefined` + guard; "degrade, never throw"
per page boundary.

**6 · Search / NLQ breadth — the model to copy.** Large but additive, low-severity, handled via
**one shared resolver + a generative corpus** (WC-010).
*Countermeasure:* keep it, and add **LLM-as-judge** checks on the generated prose.

**Meta-point:** most of these were inherent to the bet — a live product against a real,
mid-tournament, incomplete third-party feed, on a trial that lapsed, built solo. A large fraction
of "bugs" were really "reality didn't match the feed's happy path, discovered in production."

---

## 2. Procedural & operational critique

The architecture explains why the code broke; this explains why the breaks were found so late and
cost so much. Unifying theme: **discovery and verification happened in the most expensive place —
users, on prod, during matches, after deploy — and verification consumed the production resource.**

- **Verification ran against production and burned the quota.** The act of checking exhausted the
  API budget (WC-073 was partly self-inflicted), and live behavior could only be observed while a
  match was on. *Fix:* a fixture-backed replay harness (§5) as an offline oracle.
- **Straight-to-main, no CI gate; CI arrived late.** Nothing mechanical caught a regression before
  it went live; the test harness itself landed mid-project. *Fix:* branch protection + CI gates
  from commit one. A conformance gate blocks the entire WC-05x wave for free.
- **One environment — you debugged on the site users see.** The status banner (WC-072) exists
  *because* a bad deploy is instantly public. *Fix:* a staging rung + a smoke test before promotion.
- **Outages found from users, not alerts.** Umami is analytics, not error/uptime monitoring; no
  quota alarm; no match-day runbook. *Fix:* Sentry + a synthetic uptime check + a quota alarm + a
  one-page runbook; ship the `?debug=1` endpoint at launch, not during the fire.
- **A pipeline on an expiring trial, and a single provider.** The frozen-overlay capture was an
  emergency that became a permanent wart. *Fix:* data-source due diligence in discovery (runway,
  quota, field coverage) + a warm second source behind the same interface.
- **Records outran by the pace; "fixed" without a repro.** The roadmap sat two weeks stale with a
  shipped feature marked "proposed." *Fix:* a Definition of Done that includes "flip the roadmap on
  merge" and "reproduce-first" (write the failing test, then fix, then watch it pass — WC-077).

---

## 3. The corners you cut, and the bill each one sent

Split by whether the corner was defensible under a "ship during the tournament" clock, or just
cheap to fix and skipped anyway. The corners that bit hardest were mostly the cheap ones.

**Defensible under the clock** (reasonable calls, but each accrued interest):

| Corner cut | Came back as |
|------------|--------------|
| No staging environment (early) | Debugging on prod + the WC-072 band-aid banner; should've been the first add once you had users |
| Built on an expiring trial | A rushed frozen-overlay capture, now permanent load-bearing scaffolding with no retirement plan |
| Skipped modeling the hard cases | A long tail of state bugs (WC-039/050/057/058/071/077) |
| Breadth before depth | One provider quirk broke five surfaces at once; nothing could stabilize while everything moved |
| A tournament-shaped domain model | `DatasetSnapshot` is bracket-shaped — now the main friction for the multi-sport spin-off |

**Cheap to fix, skipped anyway** (near-free to prevent, and these bit hardest):

| Corner cut | Came back as |
|------------|--------------|
| Commit straight to main, no gate | The WC-051/052/053/054/056 migration regression wave |
| Verified against the live API | A drained quota (WC-073) + a match-gated feedback loop |
| Non-null assertions everywhere | Whole-page crashes (WC-002/003/004/007/008/040) |
| No monitoring or alerting | Users as your pager for every outage |
| No integration or contract tests | No net where 40% of bugs lived — the data boundary had zero upfront coverage |
| Premature "fixed" without a repro | Wasted cycles + reopened bugs; WC-077 (repro-first) is the counter-model |
| Workarounds left in, undocumented | The `eval('require')('zlib')` edge hack (WC-075) — quiet, load-bearing debt |
| Ad-hoc secrets & config ops | The API-key incident and the Render rollback-pin confusion |

The encouraging read: the defensible corners were about scope and hosting under real constraints;
the corners that actually bit were mostly **process** ones — gates, harness, monitoring — that were
cheap and got skipped anyway. The expensive lessons don't cost much to fix next time.

---

## 4. The delivery strategy to run next time

**First, a correction — this is not "the SDLC".** The canonical SDLC is a set of *activities*
(requirements, design, build, test, deploy, operate), and the models (Waterfall, V-Model, Agile,
Spiral, DevOps) rearrange how you move through them. What follows is a **delivery strategy**: the
order to build things so the riskiest parts fail cheapest. Each phase contains all six activities
in miniature. Read it as an itinerary laid over the SDLC (borrowing from risk-driven/Spiral, the
walking skeleton/tracer bullet, and shift-left testing), not a replacement for it.

- **Phase 0 · Discovery & spec.** Domain spec + enumerate the hard cases up front (ties, pens, ET,
  phase). Data-source due diligence: contract runway, quotas, field-coverage matrix per provider.
  *Gate:* written spec + provider capability matrix reviewed. *Prevents:* clusters 2, 3, 4 + trial scramble.
- **Phase 1 · Foundations.** Domain model + state machine + branded observed/modeled types; the
  anti-corruption layer for one provider; recorded fixtures; CI green from commit one.
  *Gate:* conformance suite + typecheck green in CI on every PR. *Prevents:* cluster 1 (incl. swap), cluster 5.
- **Phase 2 · Vertical slice.** One source end-to-end on fixtures; build the resilience ladder
  (live → cache → sim) and observability (debug endpoint + transition logs) here, as design.
  *Gate:* full-match replay test passes; smoke green on a preview URL. *Prevents:* the resilience patch chain.
- **Phase 3 · Breadth.** Add surfaces on the stable spine, each meeting the Definition of Done.
  *Gate:* PR review + tests + DoD before merge. *Prevents:* record drift, half-shipped features, WIP sprawl.
- **Phase 4 · Hardening & launch.** Soak on staging; wire monitoring/alerting; write the match-day
  runbook; run a quota/load rehearsal. *Gate:* smoke green on staging + alerts live. *Prevents:* user-found outages.
- **Phase 5 · Operate.** Run to the runbook. Every incident → a BUGS.md entry *with a regression
  test* before it's closed. *Gate:* incident → failing test → fix → green → post-mortem line.

---

## 5. Staging & testing setup (stop debugging live)

Concrete for the stack (Next.js on Render, Upstash, GitHub). Ladder:
**Local (fixtures) → PR preview (fixtures) → Staging (own key/quota) → Production (manual promote).**

1. **Fixture mode.** A `DATA_SOURCE=fixtures` switch serves recorded JSON from `/fixtures`. An
   `npm run record` (RECORD=1) script hits the real API *once*, off the hot path, and writes raw
   JSON. Local dev + all of CI run on fixtures — zero quota, deterministic.
2. **Branch protection + CI on every PR.** GitHub Actions: `typecheck` + `vitest` (on fixtures) +
   `test:contract` (zod-validate the recorded raw samples). Contract failure = red build, not a
   production regression.
3. **Ephemeral preview per PR (Render).** `render.yaml` → `previews: generation: automatic`, with
   `DATA_SOURCE previewValue: fixtures` so previews never touch the live API.
4. **Staging service + smoke test.** A second Render service auto-deploys from `main` (its own key
   and quota, or fixtures). A tiny Playwright smoke — home renders, `/api/live-status` sane, zero
   console errors — must pass before promotion. Promotion to prod is deliberate (protected branch /
   tag / manual deploy hook), never an auto-deploy of an unverified commit.
5. **Monitoring.** Sentry (errors, all envs); a synthetic uptime check on `/api/live-status`; a
   quota logger that warns at 80%; separate keys per env (prod key only in the prod env group; CI
   uses fixtures and needs none).

---

## 6. Leveraging gen-AI workflows

This app was built with an AI agent, so the harness around the agent is the real product. The
biggest miss: the agent had **no offline oracle**, so it verified against production and burned the
quota. Fix the harness and most process failures fix themselves.

- **Harness engineering** *(the single biggest lever)* — give the agent the fixture + replay harness
  as its verification loop; fixtures double as evals.
- **CLAUDE.md as guardrails** — encode invariants (no `!` on lookups, no fabrication, phase-required,
  degrade-never-throw, reproduce-first) so the agent self-enforces the DoD.
- **Spec & plan first** — plan mode: enumerate edge cases before code; critique the plan.
- **Reproduce-first loop** — failing test → fix → green as the default (WC-077).
- **Subagent fan-out** — one agent per call-site for a migration (worktrees); an adversarial review
  agent on every diff = the merge gate you were missing.
- **Evals & LLM-as-judge** — extend the NLQ generative corpus; judge the narrative prose.
- **Memory as shared state** — keep BUGS.md/ROADMAP/memory current; a stale record is a stale prompt.
- **Golden-transcript replay** — record one match's tick-by-tick feed; replay it to exercise the
  live state machine deterministically (the exact harness that surfaces WC-077 pre-deploy).

*Technologies to reach for:* zod + typed clients, msw/nock cassettes, Pact (contract tests),
fast-check (property tests on the state machine), Playwright + agent (agentic E2E), tRPC / end-to-end
types (kills the observed-vs-modeled leak at compile time), feature flags, Sentry + synthetic monitors.

---

## 7. Product-agnostic principles

None of this is really sports- or even software-specific — it's manufacturing quality thinking
applied to code. #1 is the master; the rest are ways to obey it.

1. **Defects get ~10× costlier at every station they travel** (design → unit → integration →
   staging → prod → user). Move discovery one station left. *(cost-of-defect curve · shift-left)*
2. **Optimize feedback-loop latency above almost everything** — time from change to trustworthy
   signal sets iteration speed. *(DORA metrics · lead time · MTTR)*
3. **Wrap every dependency you don't control** — validate + translate at the boundary. *(anti-corruption layer, DDD)*
4. **If verification is expensive, build a cheap oracle** — record once, replay forever. *(consumer-driven contract testing)*
5. **Every domain has its "ties and penalties"** — model the edge cases as a state machine with
   invariants before the happy-path UI. *(domain modeling · invariants)*
6. **Keep observed facts and derived values typed apart.** *(type-level separation)*
7. **Instrument before you scale** — you can't operate what you can't see. *(observability)*
8. **Limit WIP; stabilize a slice before going wide.** *(flow · theory of constraints)*
9. **Reproduce first, and make gates the default.** *(definition of done · CI gates)*

---

## 8. Week-one spine checklist (next build)

Stand up all of this before a single user-facing surface.

- [ ] **Domain model + state machine** — status incl. ET/pens/phase/`decidedBy`; invariants + tests;
      observed-vs-modeled type branding; `phase` required by every status-rendering function.
- [ ] **Anti-corruption layer** — one provider, zod at the boundary, mapped to domain types.
- [ ] **Golden fixtures + replay harness** — capture responses; run the pipeline offline; replay one
      match tick-by-tick; a conformance suite any adapter must pass.
- [ ] **Resilience ladder + status contract** — live → cache → sim; a quota budget (one boot fetch, backoff).
- [ ] **No-fabrication kit** — availability flags + a single Metric component; a test no raw 0 leaks.
- [ ] **Safety lints** — ban `!` on lookups; degrade-never-throw page boundary.
- [ ] **Gates from commit #1** — CI (typecheck + tests + conformance) on every push; branch + PR even
      solo; staging deploy on fixtures + smoke test before prod.
- [ ] **Ops from day one** — debug endpoint + transition logs; uptime + quota + error alerts; a runbook.
- [ ] **Agent harness** — CLAUDE.md invariants + DoD; fixtures as the agent's offline verification loop;
      reproduce-first; a review agent on every diff.
- [ ] **Sequence discipline** — spine rock-solid on one source, then add surfaces.

---

## What went right (keep doing)

- **Disciplined `BUGS.md`** — root cause + fix + commit hash per entry; it made this retrospective possible.
- **A hermetic test per bug** — the suite grew to 112, a real regression net.
- **The shared NLQ resolver + generative corpus (WC-010)** — the right pattern; cluster 6 is the model, not the problem.
- **"Never fabricate, degrade honestly"** as a stated principle, and durable lesson capture in memory.

---

## The one-line takeaway

The highest-leverage change is **recorded fixtures behind an anti-corruption layer**: it converts
*"discover the feed's lie in production"* into *"discover it once, in a test."* Nearly every cluster,
technical and operational, shrinks the moment discovery and verification move off the live path.
