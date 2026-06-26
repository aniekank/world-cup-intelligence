import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Globe2,
  Radio,
  Sparkles,
  Trophy,
  Layers,
  Coins,
  Shirt,
  Gem,
  History,
  Dices,
  Target,
  Activity,
  Gauge,
  Newspaper,
  Brain,
  FlaskConical,
  Swords,
} from 'lucide-react';
import { PageHeader, Panel, Badge } from '@/components/ui';
import { RUNS } from '@/analytics/simulate';

export const metadata: Metadata = { title: 'Guide' };
export const dynamic = 'force-dynamic';

/** A walkthrough of each major area of the platform. */
const TOUR: { icon: typeof Globe2; title: string; href: string; body: string }[] = [
  {
    icon: Globe2,
    title: 'World Explorer',
    href: '/globe',
    body: 'A 3D globe. Drag to spin it, scroll to zoom, and click a country to jump to its squad, coach, and World Cup history. The best place to start if you want to browse by nation.',
  },
  {
    icon: Radio,
    title: 'Live Center & Matches',
    href: '/live',
    body: 'Scores and fixtures for the active tournament. On the live 2026 dataset this updates in your browser as real matches are played — no reload needed; open any match for the lineups, shot map, momentum, and an auto-written recap.',
  },
  {
    icon: Newspaper,
    title: 'Results & Recaps',
    href: '/results',
    body: 'Every finished match, newest first — final score, goalscorers, and a plain-language recap of how it played out. Grouped by the day it was played in your own timezone.',
  },
  {
    icon: Layers,
    title: 'Groups & Standings',
    href: '/groups',
    body: 'The group tables. Top two of each group advance directly; the best third-placed teams fill the remaining knockout berths. Each row links to the team page.',
  },
  {
    icon: Sparkles,
    title: 'Predictions',
    href: '/predictions',
    body: `The forecast. We play the rest of the tournament ${RUNS.toLocaleString()} times and count how often each team wins its group, reaches each round, and lifts the trophy. See the glossary below for what every column means.`,
  },
  {
    icon: Trophy,
    title: 'Bracket',
    href: '/bracket',
    body: 'The single most-likely knockout path from the Round of 32 to the Final, with each tie decided by the stronger side’s win probability.',
  },
  {
    icon: Target,
    title: 'Track Record',
    href: '/track-record',
    body: 'How the model has actually done — its pre-match predictions scored against real results, with accuracy and calibration. We show our work, hits and misses alike.',
  },
  {
    icon: Coins,
    title: 'Betting Edge',
    href: '/betting',
    body: 'A comparison tool — our model’s probabilities lined up against real bookmaker prices to flag where they disagree. It is for analysis and education, not tipping. Read the responsible-gambling notice at the top of that page.',
  },
  {
    icon: FlaskConical,
    title: 'Model Lab',
    href: '/lab',
    body: 'An interactive look under the hood: the Poisson scoreline grid, a Monte Carlo simulator you can re-run, calibration curves, and more. For when you want to see how the predictions are actually made.',
  },
  {
    icon: Brain,
    title: 'AI Insights & Ask',
    href: '/ask',
    body: 'Ask a plain-English question — “who has the best xG per 90?”, “Spain’s playing style”, “how many goals has Mbappé scored?” — and get an answer straight from the data. AI Insights surfaces the day’s storylines automatically.',
  },
  {
    icon: Swords,
    title: 'Clash of Civilizations',
    href: '/civilizations',
    body: 'A playful lens on the bracket — group nations by region, language, or other shared traits and see how the “civilizations” stack up against each other.',
  },
  {
    icon: Shirt,
    title: 'Club Connections',
    href: '/clubs',
    body: 'Which club each player comes from, grouped by league, club, and nation. See how many of a country’s squad play in the Premier League, or which club sends the most players to the World Cup.',
  },
  {
    icon: Gem,
    title: 'Discoveries',
    href: '/discoveries',
    body: 'Underrated players to watch from each continent, plus nations making their World Cup debut. Stories you would miss on the headline pages.',
  },
  {
    icon: History,
    title: 'Through the Years',
    href: '/history',
    body: 'Browse every World Cup ever played — all the men’s tournaments back to 1930 and every Women’s World Cup since 1991. The four most recent (2022, 2018, Women’s 2023 & 2019) carry full event data — advanced stats and shot maps; older editions show results, scorers, and squads. Switch edition with the selector in the top-right and the whole app re-points to that year.',
  },
];

/** Plain-language definitions, grouped. Each has an `id` for deep-linking. */
const GLOSSARY: {
  category: string;
  icon: typeof Target;
  terms: { id: string; term: string; short?: string; body: React.ReactNode }[];
}[] = [
  {
    category: 'Chance & shot quality',
    icon: Target,
    terms: [
      {
        id: 'xg',
        term: 'xG — Expected Goals',
        short: 'chance quality',
        body: (
          <>
            <p>
              The single most useful stat in modern football. Every shot is given a probability of becoming a goal
              based on <em>where</em> and <em>how</em> it was taken — distance, angle, header vs foot, one-on-one vs a
              crowd. A tap-in from the six-yard box might be worth <strong>0.7 xG</strong>; a hopeful 30-yard strike{' '}
              <strong>0.03 xG</strong>.
            </p>
            <p className="mt-2">
              Add up a team’s shots and you get how many goals they “should” have scored from the chances they created.
              If a team wins 1–0 but is out-chanced <strong>0.4 to 2.1 xG</strong>, the scoreline flattered them — they
              rode their luck. Over many games, xG predicts future results better than goals do, because finishing is
              streaky but chance creation is repeatable.
            </p>
          </>
        ),
      },
      {
        id: 'xa',
        term: 'xA — Expected Assists',
        short: 'pass quality',
        body: (
          <p>
            The same idea applied to the pass <em>before</em> the shot. A through-ball that sets up a clear chance earns
            high xA even if the striker misses. It rewards the creator for the quality of the opportunity they made.
          </p>
        ),
      },
      {
        id: 'shotmap',
        term: 'Shot map',
        body: (
          <p>
            A picture of where every shot was taken. Bigger dots = higher xG (better chances); colour marks goals. A
            cluster of big dots in the box means a team is creating clean looks; lots of small dots from distance means
            they are settling for low-percentage shots.
          </p>
        ),
      },
    ],
  },
  {
    category: 'Ratings & strength',
    icon: Gauge,
    terms: [
      {
        id: 'elo',
        term: 'ELO rating',
        short: 'team strength',
        body: (
          <p>
            A single number for how strong a team is, borrowed from chess. Win and you take points from your opponent;
            the bigger the upset, the more points move. The gap between two teams’ ELO translates directly into a win
            probability, which is how we resolve every simulated match. Roughly: 2000+ is elite, 1800 is solid, 1500 is
            a minnow.
          </p>
        ),
      },
      {
        id: 'power',
        term: 'Power rating',
        body: (
          <p>
            Our blended strength score combining attack and defence quality into one figure, used to rank teams on the{' '}
            <Link href="/rankings" className="text-accent hover:underline">
              Rankings
            </Link>{' '}
            page. Higher is better.
          </p>
        ),
      },
      {
        id: 'form',
        term: 'Form',
        body: (
          <p>
            The string of recent results (W / D / L), most recent last. A quick read on momentum, but a small sample —
            three good results can hide a weak underlying performance, which is where xG helps.
          </p>
        ),
      },
    ],
  },
  {
    category: 'The forecast',
    icon: Activity,
    terms: [
      {
        id: 'monte-carlo',
        term: 'Monte Carlo simulation',
        short: 'how the forecast works',
        body: (
          <p>
            Rather than guess one outcome, we play the entire rest of the tournament{' '}
            <strong>{RUNS.toLocaleString()} times</strong>. Each run completes the groups, seeds the bracket, and plays out every knockout
            tie using the teams’ win probabilities — with a dose of randomness, so upsets happen just like in real life.
            We then count how often each thing occurred. That count <em>is</em> the probability.
          </p>
        ),
      },
      {
        id: 'title',
        term: 'Title % (Win)',
        short: 'odds of winning it all',
        body: (
          <p>
            The share of those {RUNS.toLocaleString()} simulations a team won the whole tournament. <strong>Title 18%</strong> means
            they lifted the trophy in about {Math.round(0.18 * RUNS).toLocaleString()} of {RUNS.toLocaleString()} runs. It already
            accounts for how hard their likely path is.
          </p>
        ),
      },
      {
        id: 'stage-reach',
        term: 'Stage-reach % (R16 · QF · SF · Final)',
        short: 'how far they go',
        body: (
          <p>
            How often a team reached each round — the Round of 16, quarter-final, semi-final, and final. These only fall
            as you move right (you must reach the semi before the final), and the drop-off shows where a team’s run is
            most likely to end.
          </p>
        ),
      },
      {
        id: 'group-win',
        term: 'Group-win % & advance %',
        body: (
          <p>
            The chance of finishing top of the group versus merely qualifying. Winning the group usually means an easier
            knockout draw, so a high advance % paired with a low group-win % flags a team likely to take the hard road.
          </p>
        ),
      },
      {
        id: 'delta',
        term: 'Pre-WC vs Now (Δ)',
        body: (
          <p>
            How a team’s title chance has moved since before kick-off. A green <Badge tone="accent">+</Badge> means
            they’re over-performing the pre-tournament market; red means they’ve disappointed. It’s the story of who is
            rising and fading.
          </p>
        ),
      },
      {
        id: 'golden-boot',
        term: 'Golden Boot projection',
        body: (
          <p>
            The race for top scorer. We take each player’s goals so far, fold in their xG (so a striker scoring from
            thin chances isn’t expected to keep it up — and an unlucky one is expected to bounce back), and project a
            final tally. “Win Boot” is how often they finished top scorer across the simulations.
          </p>
        ),
      },
    ],
  },
  {
    category: 'Betting numbers',
    icon: Coins,
    terms: [
      {
        id: 'implied-prob',
        term: 'Implied probability',
        body: (
          <p>
            What a bookmaker’s odds say the chance is. Decimal odds of <strong>4.0</strong> imply a{' '}
            <strong>1 ÷ 4.0 = 25%</strong> chance. Comparing this to our model’s probability is the whole game.
          </p>
        ),
      },
      {
        id: 'vig',
        term: 'Vig / overround (de-vig)',
        body: (
          <p>
            The bookmaker’s built-in margin: add up the implied probabilities of every outcome and they total{' '}
            <em>more</em> than 100%. That extra is the house edge. “De-vigging” strips it out to get the market’s true
            estimate, which is what we compare against — a fairer fight.
          </p>
        ),
      },
      {
        id: 'edge-ev',
        term: 'Edge & Expected Value (EV)',
        short: 'model vs market',
        body: (
          <p>
            <strong>Edge</strong> is the gap between our probability and the market’s. <strong>EV</strong> turns that
            into an average profit-or-loss per unit staked if the bet were repeated forever. Important: a positive edge
            almost always means <em>our model is wrong</em>, not that there’s free money — the market is very sharp.
          </p>
        ),
      },
      {
        id: 'kelly',
        term: 'Kelly stake',
        body: (
          <p>
            A formula for how much to stake given your edge and the odds — it grows the bankroll fastest in theory while
            avoiding ruin. We show a fractional (conservative) Kelly, because full Kelly is famously wild. Shown for
            discipline and illustration, <strong>not</strong> as a recommendation to bet.
          </p>
        ),
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Start Here"
        title="How to use this platform"
        description="A two-minute orientation, then a plain-language glossary of every number you’ll see. No prior stats knowledge needed."
      />

      {/* Quick start */}
      <Panel title="Quick start" subtitle="The two things to know first">
        <ol className="space-y-3 text-sm text-terminal-text">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
              1
            </span>
            <p>
              <strong className="text-terminal-bright">Pick which tournament you’re looking at.</strong> The selector in
              the top-right switches the entire app between the live{' '}
              <span className="text-terminal-bright">World Cup 2026</span>, every past World Cup — all the men’s
              tournaments back to <span className="text-terminal-bright">1930</span> and every Women’s World Cup — and a{' '}
              <span className="text-accent-violet">🎲 Simulated 2026</span> sandbox. Every page — standings, predictions,
              players — re-points to your choice.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
              2
            </span>
            <p>
              <strong className="text-terminal-bright">Live vs Simulated.</strong> On{' '}
              <span className="text-terminal-bright">World Cup 2026 (live)</span> the data is real and updates as matches
              are played, so early on some pages are still filling in. The{' '}
              <span className="text-accent-violet">🎲 Simulated</span> dataset is a complete, made-up tournament where
              every match already has a result — perfect for exploring every feature, but its forecasts and betting
              numbers are <em>not</em> about the real world.
            </p>
          </li>
        </ol>
      </Panel>

      {/* Simulation deep-dive */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Dices className="h-4 w-4 text-accent-violet" /> Using the “Simulated 2026” dataset
          </span>
        }
        subtitle="When and why to reach for it"
      >
        <div className="grid gap-4 text-sm text-terminal-text md:grid-cols-3">
          <div>
            <p className="font-semibold text-terminal-bright">What it is</p>
            <p className="mt-1 text-terminal-muted">
              A deterministic, offline fantasy World Cup. Seeded so it’s identical on every reload — the same scores and
              the same forecast numbers each time you visit.
            </p>
          </div>
          <div>
            <p className="font-semibold text-terminal-bright">Use it to…</p>
            <p className="mt-1 text-terminal-muted">
              See every page fully populated, learn what each metric means before the real games matter, or browse with
              no internet connection. A safe place to click around.
            </p>
          </div>
          <div>
            <p className="font-semibold text-terminal-bright">Don’t use it for…</p>
            <p className="mt-1 text-terminal-muted">
              Real predictions or betting. The numbers describe a tournament that doesn’t exist. For a genuine forecast,
              switch to <span className="text-terminal-bright">World Cup 2026 (live)</span>.
            </p>
          </div>
        </div>
      </Panel>

      {/* The tour */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">A tour of the sections</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TOUR.map(({ icon: Icon, title, href, body }) => (
            <Link
              key={href}
              href={href}
              className="glass group rounded-lg border border-terminal-border p-4 transition-colors hover:border-accent/60"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-accent" />
                <span className="font-semibold text-terminal-bright group-hover:text-accent">{title}</span>
              </div>
              <p className="mt-2 text-sm text-terminal-muted">{body}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Glossary */}
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-accent">
          Glossary — every data point, in plain English
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-terminal-muted">
          Never seen “xG” before? Start here. Each term is defined the way you’d explain it to a friend, with a concrete
          example where it helps.
        </p>
        <div className="space-y-6">
          {GLOSSARY.map(({ category, icon: Icon, terms }) => (
            <Panel
              key={category}
              title={
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent" /> {category}
                </span>
              }
            >
              <dl className="space-y-5">
                {terms.map(({ id, term, short, body }) => (
                  <div key={id} id={id} className="scroll-mt-24">
                    <dt className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-terminal-bright">{term}</span>
                      {short && <Badge tone="violet">{short}</Badge>}
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-terminal-text [&_p]:text-terminal-text">
                      {body}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-terminal-muted">
        Still stuck on a number? Try the{' '}
        <Link href="/ask" className="text-accent hover:underline">
          Ask
        </Link>{' '}
        page — type a plain-English question and the app will answer from the data.
      </p>
    </div>
  );
}
