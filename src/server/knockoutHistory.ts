import 'server-only';
import { TOURNAMENTS } from '@/data/tournaments';
import { loadTournamentSnapshot } from '@/data/loadTournament';
import { getMatches, getTeam, getActiveTournamentId } from '@/data/store';
import type { Match, Insight } from '@/domain/types';

/**
 * Historical knockout context for a live tie — built ONCE from every finished
 * edition we hold (datahub 1930–2015 + StatsBomb 2018/2022/Women's) and memoized.
 *
 * Teams are matched across editions by a CANONICAL nation name, not id: the
 * archive uses ISO codes (deu, hrv) while the live feed uses SportMonks codes
 * (ger, cro), so an id join silently drops giants like Germany. Names match far
 * better (Spain=Spain whatever the code); an alias map folds predecessor states
 * (West Germany→Germany) and provider spellings (Ivory Coast→Côte d'Ivoire).
 */

export interface PastMeeting {
  year: number;
  gender: 'men' | 'women';
  edition: string;
  stage: string;
  homeName: string;
  awayName: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number;
  awayScore: number;
  penalties: { home: number; away: number } | null;
  winnerName: string | null;
}

export interface TeamHistory {
  titles: number;
  finals: number;
  bestFinish: string | null;
  bestFinishYear: number | null;
  appearances: number;
  reachedSF: number;
  reachedQF: number;
  reachedR16: number;
  shootouts: { won: number; lost: number };
  legends: { name: string; goals: number }[];
}

const KO = ['R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

// Variant → canonical nation. Folds predecessor states and provider spellings so
// both the archive and the live feed land on the same key.
const ALIASES: Record<string, string> = {
  westgermany: 'germany',
  czechoslovakia: 'czechrepublic',
  czechia: 'czechrepublic',
  southkorea: 'korearepublic',
  ivorycoast: 'cotedivoire',
  usa: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  turkey: 'turkiye',
  bosniaherzegovina: 'bosniaandherzegovina',
  capeverde: 'capeverdeislands',
  irrepublic: 'republicofireland',
  iranislamicrepublicof: 'iran',
};
const canon = (name: string) => { const n = norm(name); return ALIASES[n] ?? n; };

const winnerId = (m: Match): string | null => {
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  if (m.penalties) return m.penalties.home >= m.penalties.away ? m.homeTeamId : m.awayTeamId;
  return null;
};

const FINISH_RANK = ['Group stage', 'Round of 16', 'Quarter-final', 'Semi-final', '3rd place', 'Runners-up', 'Champions'];

interface Index {
  meetings: Map<string, PastMeeting[]>; // key: sorted "canonA|canonB"
  byTeam: Map<string, TeamHistory>; // key: canon name
}
const caches = new Map<'men' | 'women', Index>();
const pairKey = (a: string, b: string) => [a, b].sort().join('|');

async function build(gender: 'men' | 'women'): Promise<Index> {
  const meetings = new Map<string, PastMeeting[]>();
  type Agg = {
    titles: number; finals: number; bestRank: number; bestYear: number | null; appearances: number;
    sf: number; qf: number; r16: number; pkW: number; pkL: number;
    scorers: Map<string, { name: string; goals: number }>;
  };
  const agg = new Map<string, Agg>();
  const blank = (): Agg => ({ titles: 0, finals: 0, bestRank: -1, bestYear: null, appearances: 0, sf: 0, qf: 0, r16: 0, pkW: 0, pkL: 0, scorers: new Map() });
  const get = (k: string) => { let a = agg.get(k); if (!a) { a = blank(); agg.set(k, a); } return a; };

  const editions = TOURNAMENTS.filter((t) => (t.source === 'statsbomb' || t.source === 'datahub') && t.gender === gender);
  for (const t of editions) {
    let snap;
    try { snap = await loadTournamentSnapshot(t.id); } catch { continue; }
    const team = new Map(snap.teams.map((x) => [x.id, x]));
    const ck = (id: string) => canon(team.get(id)?.name ?? id);

    const reached = new Map<string, Set<string>>(); // canon → stages
    const note = (id: string, stage: string) => { const k = ck(id); const s = reached.get(k) ?? new Set(); s.add(stage); reached.set(k, s); };

    for (const m of snap.matches) {
      if (m.status !== 'FINISHED') continue;
      note(m.homeTeamId, m.stage); note(m.awayTeamId, m.stage);
      if (!KO.includes(m.stage)) continue;
      const h = team.get(m.homeTeamId), a = team.get(m.awayTeamId);
      const wId = winnerId(m);
      meetings.set(pairKey(ck(m.homeTeamId), ck(m.awayTeamId)), [
        ...(meetings.get(pairKey(ck(m.homeTeamId), ck(m.awayTeamId))) ?? []),
        {
          year: t.year, gender: t.gender, edition: t.label, stage: m.stage,
          homeName: h?.name ?? m.homeTeamId, awayName: a?.name ?? m.awayTeamId,
          homeFlag: h?.flag ?? '🏳️', awayFlag: a?.flag ?? '🏳️',
          homeScore: m.homeScore, awayScore: m.awayScore, penalties: m.penalties,
          winnerName: wId ? team.get(wId)?.name ?? null : null,
        },
      ]);
      if (m.penalties && wId) { const l = wId === m.homeTeamId ? m.awayTeamId : m.homeTeamId; get(ck(wId)).pkW++; get(ck(l)).pkL++; }
      if (m.stage === 'FINAL' && wId) { const l = wId === m.homeTeamId ? m.awayTeamId : m.homeTeamId; get(ck(wId)).titles++; get(ck(wId)).finals++; get(ck(l)).finals++; }
    }

    for (const [k, stages] of reached) {
      const a = get(k);
      a.appearances++;
      if (stages.has('SF') || stages.has('THIRD_PLACE') || stages.has('FINAL')) a.sf++;
      if (stages.has('QF') || stages.has('SF') || stages.has('THIRD_PLACE') || stages.has('FINAL')) a.qf++;
      if (KO.some((s) => stages.has(s))) a.r16++; // reached the knockouts at all
      let rank = 0;
      if (stages.has('R16')) rank = 1;
      if (stages.has('QF')) rank = 2;
      if (stages.has('SF')) rank = 3;
      const finalM = snap.matches.find((m) => m.stage === 'FINAL' && (ck(m.homeTeamId) === k || ck(m.awayTeamId) === k));
      const thirdM = snap.matches.find((m) => m.stage === 'THIRD_PLACE' && (ck(m.homeTeamId) === k || ck(m.awayTeamId) === k));
      if (thirdM && ck(winnerId(thirdM) ?? '') === k) rank = 4;
      if (finalM) rank = ck(winnerId(finalM) ?? '') === k ? 6 : 5;
      if (rank > a.bestRank) { a.bestRank = rank; a.bestYear = t.year; }
    }

    for (const p of snap.players) {
      const g = snap.playerStats[p.id]?.goals ?? 0;
      if (g <= 0) continue;
      const a = get(ck(p.teamId));
      const nk = norm(p.name);
      const cur = a.scorers.get(nk);
      if (cur) cur.goals += g; else a.scorers.set(nk, { name: p.name, goals: g });
    }
  }

  const byTeam = new Map<string, TeamHistory>();
  for (const [k, a] of agg) {
    byTeam.set(k, {
      titles: a.titles, finals: a.finals,
      bestFinish: a.bestRank >= 0 ? FINISH_RANK[a.bestRank]! : null, bestFinishYear: a.bestYear,
      appearances: a.appearances, reachedSF: a.sf, reachedQF: a.qf, reachedR16: a.r16,
      shootouts: { won: a.pkW, lost: a.pkL },
      legends: [...a.scorers.values()].sort((x, y) => y.goals - x.goals).slice(0, 3),
    });
  }
  return { meetings, byTeam };
}

async function index(gender: 'men' | 'women'): Promise<Index> {
  let ix = caches.get(gender);
  if (!ix) { ix = await build(gender); caches.set(gender, ix); }
  return ix;
}

/** Pass the two teams' display names + the tournament gender. Their shared WC history. */
export async function knockoutHistory(nameA: string, nameB: string, gender: 'men' | 'women' = 'men'): Promise<{
  meetings: PastMeeting[];
  teamA: TeamHistory | null;
  teamB: TeamHistory | null;
}> {
  const ix = await index(gender);
  return {
    meetings: (ix.meetings.get(pairKey(canon(nameA), canon(nameB))) ?? []).sort((a, b) => b.year - a.year),
    teamA: ix.byTeam.get(canon(nameA)) ?? null,
    teamB: ix.byTeam.get(canon(nameB)) ?? null,
  };
}

/** Warm the men's index at boot (a one-time pass over the men's editions). */
export const warmKnockoutHistory = () => index('men');

const STAGE_WORD: Record<string, string> = {
  R32: 'Round of 32', R16: 'Round of 16', QF: 'quarter-final', SF: 'semi-final', THIRD_PLACE: 'third-place play-off', FINAL: 'final',
};

/**
 * Historical insight cards for the daily briefing: rematch / shootout-history
 * call-outs on the upcoming knockout ties. Async (mines the archive), so the
 * /insights page awaits it and merges with the live insights. Live edition only.
 */
export async function historicalInsights(): Promise<Insight[]> {
  if (getActiveTournamentId() !== 'live-2026') return [];
  const ties = getMatches()
    .filter((m) => m.stage !== 'GROUP' && m.status !== 'FINISHED' && getTeam(m.homeTeamId) && getTeam(m.awayTeamId))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(0, 6);
  const out: Insight[] = [];
  for (const m of ties) {
    const home = getTeam(m.homeTeamId)!;
    const away = getTeam(m.awayTeamId)!;
    const { meetings, teamA, teamB } = await knockoutHistory(home.name, away.name, 'men');
    if (meetings.length > 0) {
      const last = meetings[0]!;
      out.push({
        id: `hist-rematch-${m.id}`, kind: 'milestone', severity: 'low',
        title: `Rematch: ${home.name} v ${away.name}`,
        body: `A World Cup rematch — they've met ${meetings.length === 1 ? 'once' : `${meetings.length} times`}, last in the ${last.year} ${STAGE_WORD[last.stage] ?? last.stage}: ${last.homeName} ${last.homeScore}–${last.awayScore} ${last.awayName}${last.penalties ? ` (${last.penalties.home}–${last.penalties.away} pens)` : ''}${last.winnerName ? `, ${last.winnerName} through` : ''}.`,
        entityType: 'match', entityId: m.id,
        metrics: [{ label: 'WC meetings', value: String(meetings.length) }],
        createdAt: new Date().toISOString(),
      });
    } else if (teamA && teamB && teamA.shootouts.won + teamA.shootouts.lost + teamB.shootouts.won + teamB.shootouts.lost > 0) {
      out.push({
        id: `hist-pk-${m.id}`, kind: 'milestone', severity: 'low',
        title: `Spot-kick stakes: ${home.name} v ${away.name}`,
        body: `If it goes the distance — World Cup shootout records: ${home.name} ${teamA.shootouts.won}–${teamA.shootouts.lost}, ${away.name} ${teamB.shootouts.won}–${teamB.shootouts.lost}.`,
        entityType: 'match', entityId: m.id,
        metrics: [],
        createdAt: new Date().toISOString(),
      });
    }
    if (out.length >= 3) break;
  }
  return out;
}
