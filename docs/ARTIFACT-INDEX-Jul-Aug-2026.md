# World Cup Intelligence — Artifact Index (July 5 → August 17, 2026)

_Everything produced for WCI across the tournament's final stretch, the freeze, and the wind-down. Paths are absolute unless marked (repo). Compiled 2026-08-17._

---

## 1. Code shipped (all in `aniekank/world-cup-intelligence`, main)

### Features
| Date | Commit | What |
|---|---|---|
| Jul 7 | fb85fdf | **The Business End** (`/scenarios`) — deep-round previews with conditional title math (P(title \| win this tie)) |
| Jul 12 | 33b01a4 | **ENH-6 — "This round, the last four Cups"** history panel on the Business End; stage-generic (semis → final) |
| Jul 19–20 | 0b9b8a4, 50edae0 | **The Freeze** (tasks #37–39) — tournament-complete retrospective home, permanent Complete banner/pill, Business End settled state, Track Record "final reckoning," README epilogue, **pinned final snapshot shipped inside the build** |

### Bugs fixed (BUGS.md, all with hermetic regression tests; tracker closed clean at 89)
| ID | Date | Commit | One line |
|---|---|---|---|
| WC-078 | Jul 7 | 303cb26 | Civilizations page phase-aware status + full-tournament records |
| WC-079 | Jul 7 | c02dc2d | Analytics: real team xG, hide absent metrics, soundness fixes |
| WC-080 | Jul 7 | 7f8b21e | Storylines state each side's fate when knocked out |
| WC-081 | Jul 7 | 90469b9 | Phase-lag sweep across insights & discoveries |
| WC-082 | Jul 7 | ab56f0a | Title odds renormalize to 100% post-elimination |
| WC-083 | Jul 7 | ba1ea20 | Phantom "subbed out" across the provider-id boundary |
| WC-084 | Jul 7 | 4f473f0 | Live match stats "finalize at full-time" explainer |
| — | Jul 8 | 9eccb75 | Scenarios: "most likely after 90′" label (not a predicted draw) |
| WC-085 | Jul 11 | 92ad755 | Eliminated Brazil read as "overperformer" — titleProbabilityDelta recomputed post-reconciliation |
| WC-086 | Jul 12 | edef8d3 | Missing 2nd semi-final — `pendingKnockoutTies` synthesis + bracket-gap refresh probe |
| WC-087 | Jul 14 | 55a8c82 | **Phantom home-field advantage** at a neutral-venue tournament — match model made venue-neutral; mirror-symmetry property test |
| WC-088 | Jul 16 | 889a378 | "3rd Place Final" classified as a second FINAL — would have crowned the wrong champion; caught 3 days early |
| WC-089 | Jul 20 | 5c945a5 | Frozen edition kept ticking (relabel + scorer clobber; Bellingham off the Golden Boot) — a complete tournament never ticks |

### Data pinned in-repo
- `src/data/cache/wc2026-final.json` — the complete tournament (104 matches, 1,266 players, all event timelines); loaded like the archive editions; **zero provider calls forever**
- `data/cache/final-export/` — prod-API export the night of the final (matches/teams/predictions/standings/rankings) — freeze insurance
- Exporter: `FREEZE_EXPORT=1 npx vitest run src/data/freeze-final-snapshot.test.ts`

## 2. Documents (repo)
| File | What |
|---|---|
| `README.md` | Champion stamp + **Epilogue** with the self-graded ledger (69/104 · groups 44/72 · KO 25/32 · Brier 0.528 vs 0.615, +14% skill · 89 bugs) |
| `BUGS.md` | Full tracker, WC-001 → WC-089 + ENH-1 → ENH-6, root causes and fixes |
| `SPINOFF.md` | **One engine, two chassis** — the post-tournament plan: club-football spin-off (top-5 leagues + UCL, cross-league rating universe), tournament chassis parked for the 2027–28 franchise calendar, organ-harvest inventory, WCI freeze checklist, build plan (revised: NFL standalone product jumps the queue) |
| `RETROSPECTIVE.md` (Jul 5) | Build retrospective — root-cause taxonomy + process/ops critique |
| `ROADMAP.md` | Updated through the freeze |
| `docs/Annotated-Source-Tour.html` | Designed single-page guided walkthrough of the codebase (committed Jul 19) |
| `docs/Codebase-Explainer.html` (Jul 5) | Updated codebase explainer |
| `docs/ARTIFACT-INDEX-Jul-Aug-2026.md` | this file |

## 3. Desktop documents — `~/Desktop/WorldCup-Docs/`
`wci-code-annotated.html` · `wci-code-census.html` · `wci-code-explained.html` · `wci-codebase-explainer.html` · `wci-plain-english.html` — the family of code-explainer pages (annotated tour, line census, plain-English walkthrough)

## 4. LinkedIn assets — `~/Desktop/WorldCup-Carousel-Assets/`
| Asset | Post |
|---|---|
| `WorldCup-Intelligence-Great8-Carousel.pdf` (+ `build-carousel-great8.js`, `carousel-great8.html`, `_deck/img/*`) | Quarter-final preview carousel (7 slides, emoji flags, 500-word cap) — the "4 for 4" receipts |
| `Final4-Receipts-Graphic.png` / `Final4-Receipts-Graphic-v2.png` (+ `final4-graphic.html`) | Semi-final day graphic — v2 carries the WC-087 correction (52/48, 47/53, audit box) |
| `SongLab-Refuses-Graphic.png` (+ `songlab-graphic.html`) | Companion product post, SongLab brand palette |
| `Final-Whistle-Graphic.png` (+ `final-whistle-graphic.html`) | Closing single-image graphic — the confession + final ledger |
| **`WorldCup-Intelligence-FinalWhistle-Carousel.pdf`** (+ `carousel-final-whistle.html`, `_fw/slide-*.png`) | 7-slide closing document carousel — **rendered 2026-08-17** (Chrome's PDF path hung twice in July; produced slide-by-slide + stitched) |

## 5. LinkedIn copy — `~/Desktop/LinkedIn Carousels/`
- `LinkedIn-WC-Great8-Carousel.md` — QF post body + first comment + checklist
- `LinkedIn-WC-QF-BoldCall-Post.md`
- **`LinkedIn-WC-FinalWhistle-Post.md`** (saved 2026-08-17 from session drafts) — the closing post, the semi-final-day corrected post, the FIFA-verified match-night comment, SongLab companion pointer

## 6. Substack (WCI-adjacent essays) — `~/Desktop/Substack/drafts/` + `review/`
`00-it-was-never-about-football` · `01-morocco-never-plays-just-france` · `02-i-build-betting-tools-manifesto` · `03-the-samba-died-in-church` · `04-nigeria-again` · `05-they-stayed-for-the-costco`, plus `BACKLOG.md` (Machine vs the Market retrospective essay = time-sensitive; every number it needs is in the README Epilogue) and `GROWTH.md`

## 7. Kickoff / succession documents (Desktop shelf `~/Desktop/AI Learning & Reference/`)
- `NFL-Product-Kickoff.md` — standalone fantasy+betting product (own repo), prompt #1 for its first session
- (`SPINOFF.md` in-repo is the club-football kickoff, prompt #1 for that repo)
- `Fraud-Guard-Kickoff.md` + `Fraud-Guard-Brief.html` — the learning build (repo staged at `~/Documents/FraudGuard`)

## 8. Production state (verified)
- `world-cup-intelligence.onrender.com` — source label `World Cup 2026 · Final (frozen)`, generatedAt pinned 2026-07-20T00:30Z, `complete: true`, champion hero + Track Record "final reckoning" live, zero API calls
- **Outstanding dashboard errands (his):** cancel API-Football; review Render plan

## 9. Memory files updated (`~/.claude/projects/-Users-tobismith-Documents-WorldCup-App/memory/`)
`post-wc-freeze-plan.md` (result, freeze verified, SPINOFF + NFL decisions) · `maintain-bugs-md.md` (tracker closed at WC-089) · `substack-two-columns.md` · `career-facts-resume-tailoring.md`

---

### The three-week arc in one paragraph
Final-week production bugs found and fixed live (WC-085 → 088, incl. the phantom home-field audit published on LinkedIn the same morning and the third-place-as-FINAL bug caught three days before it would have crowned the wrong champion) → Spain 1–0 Argentina, app crowned the right champion → freeze shipped in one session (retrospective UI, in-repo pinned snapshot, final reckoning) → the freeze's own bug (WC-089, Bellingham) caught the next day and closed → SPINOFF.md and the NFL kickoff wrote the succession → closing LinkedIn graphics and posts → resume updated with the whole story. Tracker: 89 bugs, 0 open. Ledger: 69/104, Brier 0.528, +14% skill, Argentina favoured, Spain won.
