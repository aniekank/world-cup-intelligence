# 🏆 TASK Enterprises presents — World Cup Intelligence

A production-grade World Cup analytics platform combining the live coverage of **FotMob/SofaScore**, the advanced metrics of **Opta**, the natural-language query power of **StatMuse**, the probabilistic forecasting of **FiveThirtyEight**, and the dense, information-first UI of a **Bloomberg Terminal**.

It tracks every match, player, team, group and bracket; computes advanced metrics; runs **8,000-simulation Monte Carlo** tournament forecasts; generates AI insights; and answers natural-language questions about the whole tournament — live for 2026, and across past tournaments for context.

**Live demo:** _add your Render URL here_ &nbsp;·&nbsp; **Built by:** [Tobi Smith-Kayode](https://www.linkedin.com/)

> **Runs instantly with zero infrastructure.** `npm install && npm run dev` boots the full 48-team tournament from a deterministic simulation engine — no database, no keys required. Add an API-Football key for the live 2026 feed (see Deploy).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 19 analytics/AI tests
npm run typecheck    # strict TS, zero errors
npm run build        # production build (28 routes)
```

Optional configuration (`cp .env.example .env`):

| Variable | Default | Purpose |
|---|---|---|
| `DATA_SOURCE` | `seed` | `seed` (offline simulation), `statsbomb` (real historical), or `apifootball` (live 2026) |
| `API_FOOTBALL_KEY` | — | Live 2026 feed via API-Football (required when `DATA_SOURCE=apifootball`) |
| `ANTHROPIC_API_KEY` | — | Upgrades AI narratives to Claude-authored prose (optional; deterministic generator is the always-on fallback) |
| `NEXT_PUBLIC_SITE_URL` | `localhost:3000` | Absolute base URL for social/Open Graph images |

---

## Deploy

This is a **stateful single-process app** (a `globalThis` in-memory cache plus a background live-data load on boot), so it deploys as **one always-on Node instance**, not as serverless functions. A serverless host would not share the in-memory cache between invocations or reliably finish the background load.

**Render (recommended):** the repo includes [`render.yaml`](./render.yaml). In the Render dashboard choose **New → Blueprint**, connect this repo, then set the one secret env var:

| Env var | Value |
|---|---|
| `DATA_SOURCE` | `apifootball` (set by the blueprint) |
| `API_FOOTBALL_KEY` | your API-Football key (set in the dashboard, never committed) |

Build `npm install && npm run build`, start `npm start`, health check `/api/health`, Node 20. The `free` plan sleeps after ~15 min idle and cold-starts the data load on the next visit; switch to `starter` to keep it warm. Any host that runs one persistent Node process works the same way (Railway, Fly.io, a small VPS).

---

## What it does

**16 pages** · **11 API endpoints** · **17 analytics models** · **9 AI capabilities**

- **Home** — daily AI briefing, live/upcoming matches, title contenders, power top-5, golden-boot race, auto-detected insights.
- **Live Match Center** — in-play scores with momentum and win-probability.
- **Matches / Match detail** — schedule, results, win-probability bars, AI match reports, team-stat comparisons, event timelines, dual shot maps.
- **Teams / Team detail** — 48 nations by confederation; per-team outlook, group position, squad, fixtures, form.
- **Players / Player detail** — full database with positional filters; scouting profile with percentile radar, attribute bars, AI scouting report, and a per-player shot map.
- **Groups / Standings** — 12 live group tables with full FIFA tiebreakers, xG context, qualification probability, and the best-thirds race.
- **Knockout Bracket** — projected R32→Final tree with ELO-derived advance probabilities.
- **Predictions** — Monte Carlo championship odds, stage-reach matrix, over/under-performers, golden-boot projection.
- **Analytics** — Opta-grade scatter plots (finishing, creativity, team profile) and metric leaderboards.
- **Rankings** — composite Tournament Power Rating with Momentum Index.
- **AI Insights** — auto-mined stories (upsets, breakouts, form swings, milestones).
- **Ask** — natural-language analytics search ("highest xG among midfielders?", "easiest path to the final?").
- **Favorites / Settings** — personalization persisted locally.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 14 App Router · React Server Components · Tailwind       │
│                                                                   │
│  Pages (RSC)            Client islands         API routes         │
│  src/app/*/page.tsx     Topbar search          src/app/api/*      │
│                         PlayersExplorer         (REST + cache)     │
│                         AskClient                                 │
│        │                                            │             │
│        └──────────────┬─────────────────────────────┘             │
│                       ▼                                           │
│         Server query layer  (src/server/queries.ts)              │
│         denormalized view models · joins · 'server-only'         │
│            │                  │                  │               │
│            ▼                  ▼                  ▼               │
│   Repository (src/data)  Analytics (src/analytics)  AI (src/ai)  │
│   • seeded generator     • ELO  • Poisson           • NLQ engine │
│   • PRNG (deterministic) • Monte Carlo (n=8,000)    • narratives │
│   • store + indexes      • power/form/golden boot   • Claude opt │
│   • per-90 + percentiles • standings + bracket                   │
└─────────────────────────────────────────────────────────────────┘
                       │ (DATA_SOURCE=postgres)
                       ▼
              Prisma → PostgreSQL  (prisma/schema.prisma)
```

### Layering

- **`src/domain/types.ts`** — the single source of truth. Every layer shares these types; the Prisma schema mirrors them so swapping the seeded store for Postgres is a drop-in.
- **`src/data`** — repository layer. A seeded PRNG (`prng.ts`) deterministically generates 48 squads, the fixture list, and a match-by-match simulation emitting per-shot xG, event streams and team stats (`generate.ts`). `store.ts` memoizes the dataset, builds indexes, and computes per-90 + positional-percentile tables.
- **`src/analytics`** — pure-TypeScript, fully unit-tested models (see below). `index.ts` composes them into one memoized `EngineSnapshot`.
- **`src/ai`** — `nlq.ts` is an offline intent-parsing analytics engine; `narratives.ts` generates insights/summaries/reports and optionally calls Claude.
- **`src/server/queries.ts`** — composes the above into denormalized view models for pages and API.
- **`src/app`** — RSC pages (data fetched server-side, no client waterfalls), thin client islands for interactivity, REST API routes.

### Housing real 2026 World Cup data

The app ships on the **simulation engine** (zero infra). To house the **real** 2026
tournament, the data layer is pluggable behind a `DataProvider` (`src/data/provider.ts`):

| `DATA_SOURCE` | Provider | Data |
|---|---|---|
| `seed` (default) | Simulation engine | Generated, internally consistent, offline |
| `statsbomb` | StatsBomb open data (`src/data/providers/statsbomb.ts`) | **Real, free, full shot-level** — xG + coordinates, pressures, carries. Historical WC (2022). |
| `footballdata` | football-data.org v4 (`src/data/providers/footballData.ts`) | **Real** teams, fixtures, scores, standings, scorers (no xG) |
| `apifootball` | API-Football v3 (`src/data/providers/apiFootball.ts`) | **Real** live 2026 + xG totals, player stats (~$19/mo) |

**Run the full app on real data right now (free):**

```bash
npm run data:statsbomb        # builds src/data/cache/statsbomb.json (2022 WC, 64 matches)
DATA_SOURCE=statsbomb npm run dev
```

This gives the **entire** app — real shot maps, real xG, real percentile scouting (Mbappé 8G/4.2xG, the real Final 3-3, pens 4-2) — at $0. The analytics engine adapts to the format automatically (2022 = 32 teams / 8 groups / Round-of-16).

**Switch the whole app to live data** with two env vars:

```bash
DATA_SOURCE=footballdata
FOOTBALL_DATA_API_KEY=your_free_key   # football-data.org
```

On server start, `src/instrumentation.ts` fetches the live feed and swaps it into the
shared dataset cache that every page reads — no per-route changes. Any failure (bad key,
feed down) logs and falls back to the simulation, so the app never boots broken. Live
teams are enriched with real flags/colors/ratings via `src/data/enrichment.ts` (keyed by
FIFA code), since the free feed omits them.

Prefer to verify before flipping the switch? **`GET /api/ingest`** maps live data and
returns a summary (team/fixture/scorer counts) without changing the running source.

**Important honesty about metrics:** free/most feeds provide scores, scorers and
standings but **not shot-level data**, so xG, PPDA, progressive passes and player
photos require a *licensed* feed (Opta / StatsBomb / Sportmonks). The adapter sets
`hasAdvancedMetrics = false` and the analytics engine degrades gracefully to
ELO/form-based models where shot data is absent. Drop a licensed feed into the same
adapter to light up the full Opta-grade metric set. Procedural crests/portraits stand
in for licensed imagery until real assets are provisioned.

### Why a deterministic generator instead of a live feed?

A real platform ingests Opta/StatsBomb feeds. For a self-contained, reviewable deliverable, a **seeded simulation** gives the best of both worlds: every number (goals, xG, assists, the golden-boot race, the title odds) is internally consistent and *real analytics compute on top of it*, yet the app needs no network, keys, or database. The repository boundary (`src/data/store.ts`) is the seam where a production feed/Prisma drops in.

---

## Analytics engine

| Model | File | Method |
|---|---|---|
| Expected Goals (xG) | `data/generate.ts` | Per-shot logistic model on distance × angle × situation |
| xA, shot conversion, xG/shot | `data/store.ts` | Per-90 aggregation from shot/event streams |
| Match win probability | `analytics/poisson.ts` | **Bivariate-Poisson** joint score grid → W/D/L, BTTS, O/U, correct score |
| ELO ratings | `analytics/elo.ts` + `generate.ts` | World-Football-ELO with margin-of-victory multiplier, updated live |
| **Tournament simulation** | `analytics/simulate.ts` | **Monte Carlo, n=8,000** — completes groups, resolves best-thirds, seeds & plays the knockout |
| Qualification / stage-reach / title odds | `analytics/simulate.ts` | Aggregated across simulation runs |
| Tournament Power Rating | `analytics/power.ts` | ELO tier + deep-run equity + xG differential |
| Team Momentum Index | `analytics/power.ts` | Recency-weighted over/under-performance vs ELO expectation |
| Player Form Index | `data/generate.ts` | Rolling goal/xG involvement per 90 |
| Group standings | `analytics/standings.ts` | Full FIFA tiebreakers incl. head-to-head + fair-play |
| Projected bracket | `analytics/bracket.ts` | Standard seeding + ELO advance probabilities |
| Golden Boot projection | `analytics/goldenboot.ts` | Finishing-adjusted xG rate × expected remaining minutes; Poisson-race win prob |
| Percentiles | `data/store.ts` | Positional peer ranking (≥45 min) via binary search |

All models are deterministic and covered by `src/analytics/engine.test.ts` (19 tests): probability normalization, ELO monotonicity, bracket size, score-matrix sums, golden-boot ordering, and AI-intent coverage.

---

## AI layer

- **Natural-language analytics** (`ai/nlq.ts`) — parses intent (leaderboard, comparison, over/under-performance, breakout discovery, knockout path, title odds, golden boot, entity lookup), extracts entities (metrics, positions, teams, players, "per 90"), and returns a structured, evidence-backed `NLQueryResult` (answer + table + viz hint + follow-ups). **Works fully offline.**
- **Narrative generation** (`ai/narratives.ts`) — match summaries, AI scouting reports (strength/weakness from percentiles), daily intelligence briefing, and insight mining (upset detection, over/under-performers, breakouts, momentum, milestones).
- **Claude upgrade path** — when `ANTHROPIC_API_KEY` is set, `narrate()` hands the structured payload to Claude (default model `claude-opus-4-8`) for premium prose; otherwise the deterministic draft is returned. The product is never gated on connectivity.

---

## Visualization system

Recharts wrappers (`components/charts/Recharts.tsx`): horizontal ranking bars, 1–2 series radar, bubble scatter, area/momentum trends. Custom SVG: shot map (xG-sized, outcome-colored), probability split bars, bracket tree, metric bars, form strings — all themed via the terminal design tokens in `tailwind.config.ts`.

---

## API

REST route handlers under `src/app/api`, each returning a `{ data, meta }` envelope with tiered `Cache-Control` (stale-while-revalidate):

`GET /api/health` · `/api/teams` · `/api/teams/[id]` · `/api/players?position&team&sort&limit` · `/api/players/[id]` · `/api/matches?status&stage&group` · `/api/matches/[id]` · `/api/standings` · `/api/predictions` · `/api/rankings` · `/api/insights` · `/api/search?q` · `GET|POST /api/ask` (Zod-validated).

---

## Production strategy (designed for 1M+ MAU)

**Caching.** Three TTL tiers — `live` (15s) for in-play, `standard` (300s) for analytics, `static` (24h) for reference — emitted as `s-maxage` + `stale-while-revalidate` so a CDN (Vercel Edge / CloudFront) absorbs the vast majority of reads. RSC pages are statically prerendered where possible (24/28 routes); dynamic detail pages are server-rendered and edge-cached. The analytics `EngineSnapshot` and dataset are memoized per process; in production the Monte Carlo + aggregates run in a background worker and land in **materialized tables** (`PlayerStats`, `Standing`, `TeamForecast`, `PowerRanking`) keyed for O(1) reads.

**Scaling.** Stateless RSC/route handlers scale horizontally behind the CDN. Postgres read replicas serve the heavy read paths; the analytics worker writes the materialized aggregates on each data tick. Hot endpoints (`/api/standings`, `/api/predictions`) are CDN-cached and rarely hit origin.

**Observability.** `/api/health` liveness/readiness probe. Hooks for OpenTelemetry (`OTEL_EXPORTER_OTLP_ENDPOINT`) and Sentry (`SENTRY_DSN`) are wired via env. Recommended golden signals: route latency (p50/p95/p99), cache hit-rate per tier, simulation worker duration, error rate, and Core Web Vitals.

**Security.** Strict security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) set in `next.config.mjs`; no `x-powered-by`. All request input is Zod-validated (`/api/ask`) and length-bounded. Server-only modules are fenced with `import 'server-only'` so data/secrets never reach the client bundle. The Anthropic key is read server-side only. Production additions: rate limiting at the edge, auth (NextAuth) for personalization/notifications, and per-user RLS in Postgres.

**Deployment.** Optimized for **Vercel** (zero-config Next.js, edge caching, ISR). Containerized alternative: `next build && next start` behind any Node runtime + a CDN. With `DATA_SOURCE=postgres`: `prisma migrate deploy` then run the analytics worker on a cron/queue.

---

## Project structure

```
src/
  domain/types.ts            Shared domain model (source of truth)
  data/                      Repository: prng, teams, pool, generate, store
  analytics/                 elo · poisson · standings · simulate · power ·
                             bracket · goldenboot · index · engine.test.ts
  ai/                        nlq · narratives
  server/queries.ts          Denormalized view models (server-only)
  lib/                       utils · format · api (cache envelope)
  components/                ui/ · charts/ · layout/ · MatchCard · players/ ·
                             ask/ · favorites/ · settings/
  app/                       16 pages + 11 API routes + layout/loading/404
prisma/schema.prisma         Production Postgres schema (mirrors domain)
```

---

## Tech stack

Next.js 14 (App Router, RSC) · TypeScript (strict, `noUncheckedIndexedAccess`) · Tailwind CSS · Recharts + custom SVG · Zod · Prisma/PostgreSQL (production target) · Vitest · optional Anthropic Claude.

*Simulated dataset for demonstration. Team strengths and player pools are calibrated to be realistic but results are model-generated, not real fixtures.*
