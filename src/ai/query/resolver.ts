/**
 * Shared entity resolver — the single matching brain behind BOTH the search box
 * (`queries.search`) and the natural-language engine (`ai/nlq`). Resolving an
 * entity once, robustly, means a query like "lionel messi" finds `L. Messi`
 * everywhere: typed into the search bar OR named inside a question.
 *
 * Two modes:
 *   • rank*  — the WHOLE query is an entity name (search box). Score every
 *              candidate, return the best-ranked.
 *   • extract* — the query is a SENTENCE (NLQ). Detect entity *mentions* inside
 *              it without tripping over ordinary words.
 *
 * Pure + deterministic, no network. Handles: surname / full name / flipped order
 * / abbreviated "F. Last" / first-name / accents folded / prefixes / typos
 * (bounded edit distance) / team codes + common country aliases.
 */

import { getPlayerViews, getTeams } from '@/data/store';
import type { PlayerView, Team } from '@/domain/types';

/** lowercase, fold diacritics, turn separators into spaces, collapse. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[._\-'']/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const toks = (s: string): string[] => normalize(s).split(' ').filter(Boolean);

/**
 * Bounded Damerau (optimal string alignment) distance — like Levenshtein but an
 * adjacent transposition ("halaand"↔"haaland") costs 1, since that's one of the
 * most common typos. Returns `max+1` as soon as it's provably over budget.
 */
function editDistance(a: string, b: string, max: number): number {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  let prevPrev: number[] = [];
  let prev: number[] = Array.from({ length: bl + 1 }, (_, j) => j);
  for (let i = 1; i <= al; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2]! + 1); // adjacent transposition
      }
      row.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return prev[bl]!;
}

/** Score one query token against one name token, 0..1. */
function tokenScore(qt: string, nt: string): number {
  if (qt === nt) return 1;
  if (nt.length === 1) return qt[0] === nt ? 0.5 : 0; // name initial, e.g. "l" of "L. Messi" ← "lionel" (alone < threshold)
  if (qt.length === 1) return nt[0] === qt ? 0.4 : 0; // query gave an initial
  if (nt.startsWith(qt)) return 0.7 + 0.25 * (qt.length / nt.length); // prefix
  if (nt.length >= 4 && qt.startsWith(nt)) return 0.6 + 0.2 * (nt.length / qt.length); // query extends a real name token (not a 2-char fragment like "ho")
  if (qt.length >= 4 && nt.includes(qt)) return 0.6; // internal substring
  const max = qt.length >= 6 ? 2 : qt.length >= 5 ? 1 : 0; // typo tolerance — only for ≥5-char tokens, so short names ("kane") don't fuzz into "sané"
  if (max > 0) {
    const d = editDistance(qt, nt, max);
    if (d === 1) return 0.62; // one typo → still a confident match
    if (d === 2) return 0.45; // two typos → weak, needs corroboration
  }
  return 0;
}

/**
 * Score the whole query as a name against a candidate name. 0 = no match.
 * Order-independent greedy token assignment + substring/prefix bonuses. A real
 * (≥3-char) query token that matches nothing vetoes the candidate (so
 * "lionel ronaldo" doesn't resolve "L. Messi").
 */
export function scoreName(query: string, name: string): number {
  const nq = normalize(query);
  const nn = normalize(name);
  if (!nq || !nn) return 0;
  if (nq === nn) return 100;

  let bonus = 0;
  if (nq.length >= 4 && nn.includes(nq)) bonus += 0.8; // contiguous substring (not short tokens)
  if (nn.startsWith(nq)) bonus += 0.4;

  const qts = nq.split(' ');
  const nts = nn.split(' ');
  const used = new Array(nts.length).fill(false);
  let total = 0;
  let sig = 0;
  let sigMatched = 0;
  for (const qt of qts) {
    const isSig = qt.length >= 3;
    if (isSig) sig++;
    let best = 0;
    let idx = -1;
    for (let i = 0; i < nts.length; i++) {
      if (used[i]) continue;
      const s = tokenScore(qt, nts[i]!);
      if (s > best) {
        best = s;
        idx = i;
      }
    }
    if (idx >= 0 && best > 0) {
      used[idx] = true;
      total += best;
      if (isSig && best >= 0.5) sigMatched++;
    } else if (isSig) {
      return bonus; // a meaningful word matched nothing → wrong entity (keep only a pure-substring hit)
    }
  }
  if (sig > 0 && sigMatched === 0) return bonus;
  return total + bonus;
}

/** Common country aliases the feed/code won't give us. Keyed by normalized name. */
const TEAM_ALIASES: Record<string, string[]> = {
  'united states': ['usa', 'us', 'usmnt', 'america', 'united states of america'],
  netherlands: ['holland', 'the netherlands', 'dutch'],
  'south korea': ['korea', 'korea republic', 'republic of korea'],
  'north korea': ['dpr korea', 'korea dpr'],
  'ivory coast': ['cote divoire', "cote d'ivoire"],
  iran: ['ir iran', 'islamic republic of iran'],
  'czech republic': ['czechia'],
  'bosnia and herzegovina': ['bosnia'],
  'republic of ireland': ['ireland', 'eire'],
  'cape verde': ['cabo verde'],
  curacao: ['curacao'],
};
const aliasesFor = (t: Team): string[] => TEAM_ALIASES[normalize(t.name)] ?? [];

const THRESHOLD = 0.55;

// ── Search-box mode: the whole query is the entity name ──────────────────────

export function rankPlayers(query: string, limit = 8): PlayerView[] {
  if (!normalize(query)) return [];
  const scored: { p: PlayerView; s: number }[] = [];
  for (const p of getPlayerViews()) {
    const s = scoreName(query, p.name);
    if (s >= THRESHOLD) scored.push({ p, s });
  }
  scored.sort(
    (a, b) =>
      b.s - a.s ||
      b.p.stats.goals - a.p.stats.goals ||
      b.p.stats.minutes - a.p.stats.minutes ||
      a.p.name.localeCompare(b.p.name),
  );
  return scored.slice(0, limit).map((x) => x.p);
}

export function rankTeams(query: string, limit = 6): Team[] {
  const nq = normalize(query);
  if (!nq) return [];
  const scored: { t: Team; s: number }[] = [];
  for (const t of getTeams()) {
    let s = scoreName(query, t.name);
    if (normalize(t.code) === nq) s = Math.max(s, 50); // exact country code
    for (const a of aliasesFor(t)) s = Math.max(s, scoreName(query, a));
    if (s >= THRESHOLD) scored.push({ t, s });
  }
  scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name));
  return scored.slice(0, limit).map((x) => x.t);
}

// ── NLQ mode: detect entity mentions inside a sentence ───────────────────────

export function extractTeams(sentence: string, limit = 2): Team[] {
  const sNorm = normalize(sentence);
  const sTokens = new Set(sNorm.split(' ').filter(Boolean));
  const scored: { t: Team; s: number }[] = [];
  for (const t of getTeams()) {
    const nName = normalize(t.name);
    let s = 0;
    if (sNorm.includes(nName)) s = nName.length; // full name phrase appears
    else if (sTokens.has(normalize(t.code))) s = 3; // 3-letter code as a whole token
    else
      for (const a of aliasesFor(t)) {
        const na = normalize(a);
        if (na.length >= 5 && sNorm.includes(na)) s = Math.max(s, na.length); // long aliases only (avoid "us"/"is")
      }
    if (s > 0) scored.push({ t, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.t);
}

export const extractTeam = (sentence: string): Team | null => extractTeams(sentence, 1)[0] ?? null;

export function extractPlayers(sentence: string, limit = 4): PlayerView[] {
  const sNorm = normalize(sentence);
  const sTokens = new Set(sNorm.split(' ').filter(Boolean));
  const scored: { p: PlayerView; s: number }[] = [];
  for (const p of getPlayerViews()) {
    const nName = normalize(p.name);
    let s = 0;
    if (nName.length >= 5 && sNorm.includes(nName)) {
      s = nName.length; // full name phrase
    } else {
      for (const nt of nName.split(' ')) {
        if (nt.length >= 4 && sTokens.has(nt)) s = Math.max(s, nt.length); // surname/name token as whole word
      }
      if (s === 0) {
        for (const nt of nName.split(' ')) {
          if (nt.length < 5) continue;
          for (const st of sTokens) if (st.length >= 5 && editDistance(st, nt, 1) <= 1) s = Math.max(s, 2);
        }
      }
    }
    if (s > 0) scored.push({ p, s });
  }
  scored.sort((a, b) => b.s - a.s || b.p.stats.minutes - a.p.stats.minutes);
  return scored.slice(0, limit).map((x) => x.p);
}
