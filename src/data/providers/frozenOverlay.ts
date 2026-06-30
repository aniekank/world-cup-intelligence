/**
 * Frozen SportMonks overlay.
 *
 * When the SportMonks trial lapsed we switched the live feed to API-Football,
 * which carries scores, squads, core stats, events and (via enrichment) team xG
 * — but NOT a handful of SportMonks-only fields: player preferred foot, the
 * deeper scouting metrics (big chances, progressive passes, ball recoveries,
 * touches), coach career timelines, and per-match tactical stats (possession,
 * PPDA, field tilt, formations, referee). Most of those don't change once a
 * match is played, so we froze them ONCE from SportMonks (see
 * cache/sportmonks-frozen.json) and overlay them onto the live snapshot here.
 *
 * The join is cross-provider, so it is keyed on canonical NAME, not provider id:
 *  - players: canonical team name + shirt number (fallback: + surname)
 *  - teams:   canonical team name (coach career)
 *  - matches: canonical team-pair + kickoff date
 *
 * Every field is filled ONLY where the live value is missing/default, so live
 * API-Football data (which updates as the tournament rolls on) always wins; the
 * frozen value just backfills the gap. Future matches (played after the freeze)
 * have no frozen row and fall through to the API-Football match-stats enrichment.
 */
import type { DatasetSnapshot, PlayerStats, MatchTeamStats, Coach, Foot, Position } from '@/domain/types';

interface FrozenPlayer {
  team: string; // team CODE in the frozen snapshot
  shirt: number;
  name: string;
  foot: Foot;
  birthDate: string | null;
  stats: PlayerStats | null;
}
interface FrozenTeam { id: string; name: string; code: string; coach: Coach | null }
interface FrozenMatch {
  home: string; away: string; date: string;
  teamStats: Record<string, MatchTeamStats> | null;
  formations: { home: string; away: string } | null;
  referee: string | null;
  weather: { tempC: number; description: string } | null;
  lineups: Record<string, { id: string; name: string; pos: Position; shirt?: number }[]> | null;
}
interface Frozen { capturedAt: string; teams: FrozenTeam[]; players: FrozenPlayer[]; matches: FrozenMatch[] }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
// API-Football spellings that differ from the (canonical) SportMonks names.
const NAME_ALIASES: Record<string, string> = {
  southkorea: 'korearepublic',
  czechia: 'czechrepublic',
  bosniaherzegovina: 'bosniaandherzegovina',
  usa: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  ivorycoast: 'cotedivoire',
  turkey: 'turkiye',
};
const canon = (s: string) => { const n = norm(s); return NAME_ALIASES[n] ?? n; };
const surnameKey = (name: string) => { const parts = name.trim().split(/\s+/); return norm(parts[parts.length - 1] ?? name); };
const pair = (a: string, b: string) => [a, b].sort().join('|');

let cache: Frozen | null = null;
async function loadFrozen(): Promise<Frozen | null> {
  if (cache) return cache;
  try {
    const mod = await import('../cache/sportmonks-frozen.json');
    cache = ((mod as { default?: unknown }).default ?? mod) as Frozen;
    return cache;
  } catch {
    return null; // no frozen file (e.g. fresh checkout before capture) — degrade silently
  }
}

/**
 * Overlay frozen SportMonks gap data onto a live (API-Football) snapshot, in
 * place. No network calls. Safe to call on the load path. Returns a small tally
 * for logging. A missing/garbled frozen file is a no-op.
 */
export async function applyFrozenOverlay(snap: DatasetSnapshot): Promise<{ feet: number; stats: number; coaches: number; matches: number }> {
  const frozen = await loadFrozen();
  if (!frozen) return { feet: 0, stats: 0, coaches: 0, matches: 0 };

  // code → canonical team name, for BOTH snapshots (codes aren't guaranteed equal
  // across providers, so we always resolve through the canonical name).
  const frozenCodeToCanon = new Map(frozen.teams.map((t) => [t.id, canon(t.name)]));
  const liveCodeToCanon = new Map(snap.teams.map((t) => [t.id, canon(t.name)]));
  // `${canonTeam}|${shirt}` → live player id, for re-keying frozen lineups (which
  // carry shirts) onto live API-Football player ids.
  const liveByTeamShirt = new Map<string, string>();
  for (const p of snap.players) {
    if (p.shirtNumber > 0) {
      const k = `${liveCodeToCanon.get(p.teamId) ?? canon(p.teamId)}|${p.shirtNumber}`;
      if (!liveByTeamShirt.has(k)) liveByTeamShirt.set(k, p.id);
    }
  }

  // ── Players: foot + the AF-absent advanced metrics ─────────────────────────
  const byShirt = new Map<string, FrozenPlayer>();
  const bySurname = new Map<string, FrozenPlayer>();
  for (const fp of frozen.players) {
    const ct = frozenCodeToCanon.get(fp.team) ?? canon(fp.team);
    if (fp.shirt > 0) byShirt.set(`${ct}|${fp.shirt}`, fp);
    bySurname.set(`${ct}|${surnameKey(fp.name)}`, fp); // last writer wins; shirt is the primary key anyway
  }

  let feet = 0;
  let stats = 0;
  // Gap fields API-Football never provides → take the frozen value whenever live is 0.
  const FILL_IF_ZERO: (keyof PlayerStats)[] = [
    'bigChancesCreated', 'bigChancesMissed', 'progressivePasses', 'progressiveCarries',
    'ballRecoveries', 'touches', 'touchesInBox', 'pressuresApplied', 'pressRegains', 'xG', 'xA',
  ];
  for (const p of snap.players) {
    const ct = liveCodeToCanon.get(p.teamId) ?? canon(p.teamId);
    const fp = (p.shirtNumber > 0 && byShirt.get(`${ct}|${p.shirtNumber}`)) || bySurname.get(`${ct}|${surnameKey(p.name)}`);
    if (!fp) continue;
    // Foot: API-Football defaults everyone to 'right'; the frozen value is real.
    if (fp.foot && p.foot !== fp.foot) { p.foot = fp.foot; feet++; }
    // Birthdate backfill for the ~1% of players API-Football's stats feed omits
    // (the club crosswalk needs it; the adapter covers the rest). (WC-053)
    if (fp.birthDate && !p.birthDate) p.birthDate = fp.birthDate;
    const ls = snap.playerStats[p.id];
    if (ls && fp.stats) {
      for (const k of FILL_IF_ZERO) if (!ls[k] && fp.stats[k]) (ls[k] as number) = fp.stats[k] as number;
      // Real SportMonks form rating (×10) beats API-Football's flat default.
      if (ls.formIndex === 50 && fp.stats.formIndex !== 50) { ls.formIndex = fp.stats.formIndex; p.rating.overall = fp.stats.formIndex; }
      stats++;
    }
  }

  // ── Teams: coach career timelines (static) ─────────────────────────────────
  const frozenTeamByCanon = new Map(frozen.teams.map((t) => [canon(t.name), t]));
  let coaches = 0;
  for (const t of snap.teams) {
    const ft = frozenTeamByCanon.get(canon(t.name));
    if (ft?.coach) {
      t.coach = ft.coach; // full SM coach object incl. career, photo, age (AF gives a name only)
      if (ft.coach.name) t.manager = ft.coach.name;
      coaches++;
    }
  }

  // ── Matches: tactical stats / formations / referee / weather (played games) ─
  const frozenMatchByKey = new Map<string, FrozenMatch>();
  for (const fm of frozen.matches) {
    const hc = frozenCodeToCanon.get(fm.home) ?? canon(fm.home);
    const ac = frozenCodeToCanon.get(fm.away) ?? canon(fm.away);
    frozenMatchByKey.set(`${pair(hc, ac)}|${fm.date}`, fm);
  }
  let matches = 0;
  for (const m of snap.matches) {
    const hc = liveCodeToCanon.get(m.homeTeamId) ?? canon(m.homeTeamId);
    const ac = liveCodeToCanon.get(m.awayTeamId) ?? canon(m.awayTeamId);
    const fm = frozenMatchByKey.get(`${pair(hc, ac)}|${m.kickoff.slice(0, 10)}`);
    if (!fm) continue;
    // Only backfill when live lacks tactical stats (frozen rows are finished games;
    // a future replay of the same pairing won't collide — dates differ).
    const live = m.teamStats?.[m.homeTeamId];
    if (fm.teamStats && (!live || !live.possession)) {
      // Re-key frozen teamStats (stored under frozen codes) onto live team ids.
      const remapped: Record<string, MatchTeamStats> = {};
      for (const [code, ts] of Object.entries(fm.teamStats)) {
        const tc = frozenCodeToCanon.get(code) ?? canon(code);
        const liveId = hc === tc ? m.homeTeamId : ac === tc ? m.awayTeamId : null;
        if (liveId) remapped[liveId] = { ...ts, teamId: liveId };
      }
      if (Object.keys(remapped).length) {
        // Preserve any real xG the API-Football enrichment already attached.
        for (const id of Object.keys(remapped)) {
          const existingXg = m.teamStats?.[id]?.xG;
          if (existingXg && existingXg > 0) remapped[id]!.xG = existingXg;
        }
        m.teamStats = remapped;
        matches++;
      }
    }
    if (fm.formations && !m.formations) m.formations = fm.formations;
    if (fm.referee && !m.referee) m.referee = fm.referee;
    if (fm.weather && !m.weather) m.weather = fm.weather;
    if (fm.lineups && !m.lineups) {
      // Re-key lineups onto live team ids AND re-key each player's id to the live
      // API-Football id by team+shirt — frozen lineup ids are SportMonks ids that
      // would 404 on the team page. Shirt is an exact within-team key. (WC-052)
      const remapped: Record<string, { id: string; name: string; pos: Position }[]> = {};
      for (const [code, xi] of Object.entries(fm.lineups)) {
        const tc = frozenCodeToCanon.get(code) ?? canon(code);
        const liveId = hc === tc ? m.homeTeamId : ac === tc ? m.awayTeamId : null;
        if (!liveId) continue;
        const teamCanon = liveId === m.homeTeamId ? hc : ac;
        remapped[liveId] = xi.map((pl) => {
          const live = pl.shirt ? liveByTeamShirt.get(`${teamCanon}|${pl.shirt}`) : undefined;
          return live ? { id: live, name: pl.name, pos: pl.pos } : { id: pl.id, name: pl.name, pos: pl.pos };
        });
      }
      if (Object.keys(remapped).length) m.lineups = remapped;
    }
  }

  if (snap.meta) snap.meta.hasAdvancedMetrics = true;
  return { feet, stats, coaches, matches };
}
