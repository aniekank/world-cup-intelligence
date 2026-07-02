/**
 * LLM understanding layer for "Ask the data" (WC-061).
 *
 * The deterministic parser in nlq.ts maps a fixed vocabulary (metric names,
 * demonyms, stages, positions) to a typed query. It's fast, free, and exact —
 * but it can't understand phrasings outside that vocabulary ("who saw red for
 * the Yanks in the last 32", "top marksmen among the Three Lions").
 *
 * This layer bolts onto the FRONT of that engine as a *translator, never an
 * answerer*: Claude reads the question and emits a structured intent, which we
 * render into a canonical query string using only words the deterministic
 * parser already recognizes. The engine then computes the answer from real
 * data — the model never sees a stat, so it can't fabricate one (its knowledge
 * cutoff predates this tournament anyway).
 *
 * Safety by construction:
 *  - Fires ONLY when the deterministic parser returns `unknown`. Anything it
 *    already answers is returned untouched — no latency, no cost, no regression.
 *  - Key-gated: with no ANTHROPIC_API_KEY (e.g. an un-provisioned deploy) or on
 *    any timeout/error, we return the original deterministic result. The LLM is
 *    a strict upgrade to the fallback, never a dependency of it.
 *  - Raw fetch (no SDK), mirroring narrate() — nothing new to install.
 */
import { answerQuery } from './nlq';
import { getTeams } from '@/data/store';
import type { NLQueryResult } from '@/domain/types';

// Cheap classification/extraction — Haiku is the right tier, not Opus. Overridable.
const MODEL = process.env.NLQ_MODEL ?? 'claude-haiku-4-5';
const TIMEOUT_MS = Number(process.env.NLQ_LLM_TIMEOUT_MS ?? 2500);

// Canonical metric words — each MUST be a substring the deterministic findMetric()
// keys on (see METRICS in nlq.ts), so the rendered query re-parses correctly.
const METRIC_WORDS = [
  'goals', 'assists', 'xg', 'xa', 'shots', 'shots on target', 'key passes',
  'progressive passes', 'tackles', 'interceptions', 'minutes', 'saves',
  'clean sheets', 'yellow cards', 'red cards', 'fouls',
] as const;

const POS_WORDS: Record<string, string> = { GK: 'goalkeepers', DF: 'defenders', MF: 'midfielders', FW: 'forwards', any: '' };
const STAGE_WORDS: Record<string, string> = { group: 'group stage', r32: 'round of 32', r16: 'round of 16', qf: 'quarter-finals', sf: 'semi-finals', final: 'final', knockouts: 'knockouts', none: '' };

interface Intent {
  understood: boolean;
  direction: 'most' | 'fewest';
  metric: string;
  position: string;
  scope: string;
  stage: string;
}

// Structured-output schema — forces a valid, enum-constrained intent object.
const INTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['understood', 'direction', 'metric', 'position', 'scope', 'stage'],
  properties: {
    understood: { type: 'boolean', description: 'true ONLY if the question asks to rank players (or find the leader) by a countable stat. false for comparisons, forecasts, "who will win", tactics, standings, fixtures, or a single named player.' },
    direction: { type: 'string', enum: ['most', 'fewest'] },
    metric: { type: 'string', enum: [...METRIC_WORDS, 'none'] },
    position: { type: 'string', enum: ['GK', 'DF', 'MF', 'FW', 'any'] },
    scope: { type: 'string', description: 'Exact nation from the allowed list, or a confederation ("European", "South American", "African", "Asian", "North American", "Oceanian"), or a club name. Empty string if the question is not scoped.' },
    stage: { type: 'string', enum: ['group', 'r32', 'r16', 'qf', 'sf', 'final', 'knockouts', 'none'] },
  },
} as const;

/** Ask Claude to translate a question into a canonical query string, or null. */
async function llmNormalize(rawQuery: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const roster = getTeams().map((t) => t.name).join(', ');
  const system =
    'You translate a natural-language question about the FIFA World Cup 2026 into a structured intent for a football-stats engine. ' +
    'You do NOT answer the question and you never state a statistic — you only classify what is being asked.\n\n' +
    'Set understood=true whenever the question asks to rank players, or find the leading player, by a countable stat ' +
    '(goals, assists, yellow/red cards, saves, clean sheets, tackles, shots, minutes, etc.) — including idiomatic phrasings. ' +
    'Map idioms to the stat: "marksman"/"finisher"/"sharpshooter"/"hitman"/"deadliest" = goals; "playmaker"/"creator" = assists; ' +
    '"shot-stopper"/"keeper who saves most" = saves; "clean sheets"/"shutouts" = clean sheets; "sent off"/"saw red"/"red" = red cards; ' +
    '"booked"/"cautioned"/"dirtiest" = yellow cards; "enforcer"/"ball-winner" = tackles. ' +
    'Set understood=false only for team comparisons, title/forecast questions, tactics or playing style, group standings, ' +
    'fixtures/schedule, injuries/transfers, or a question about one specific named player.\n\n' +
    `For "scope", use the EXACT nation name from this list when the question names or implies a country: ${roster}. ` +
    'Resolve nicknames (e.g. "the Three Lions" = England, "the Yanks" = United States, "Les Bleus" = France, "La Roja" = Spain, "the Azzurri" = Italy). ' +
    'Use a confederation word for continental questions ("African players" -> "African"). Use empty string if unscoped.';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0, // classification, not generation — want the same answer every time
        system,
        messages: [{ role: 'user', content: rawQuery }],
        output_config: { format: { type: 'json_schema', schema: INTENT_SCHEMA } },
      }),
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;

    const jr = (await res.json()) as { content?: { text?: string }[] };
    const text = jr.content?.[0]?.text;
    if (!text) return null;
    const intent = JSON.parse(text) as Intent;
    if (!intent.understood || intent.metric === 'none') return null;

    const parts = [intent.direction, intent.metric];
    if (intent.position && intent.position !== 'any') parts.push(POS_WORDS[intent.position] ?? '');
    if (intent.scope) parts.push(intent.scope);
    if (intent.stage && intent.stage !== 'none') parts.push(STAGE_WORDS[intent.stage] ?? '');
    const normalized = parts.filter(Boolean).join(' ').trim();
    return normalized || null;
  } catch {
    return null; // timeout, network, bad JSON — fall back to deterministic
  }
}

/**
 * Answer a question, using the LLM translator only to rescue queries the
 * deterministic parser couldn't map. Preserves the user's original wording for
 * display. This is what the API route calls.
 */
export async function smartAnswer(rawQuery: string): Promise<NLQueryResult> {
  const deterministic = answerQuery(rawQuery);
  if (deterministic.intent !== 'unknown') return deterministic; // already handled — untouched

  const normalized = await llmNormalize(rawQuery);
  if (!normalized) return deterministic;

  const upgraded = answerQuery(normalized);
  if (upgraded.intent === 'unknown' || upgraded.intent === 'unsupported') return deterministic;
  return { ...upgraded, query: rawQuery }; // show what the user actually typed
}
