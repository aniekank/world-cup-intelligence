'use client';

import { useMemo, useState } from 'react';
import { winProbFromState } from '@/lib/labMath';
import type { LabMatch } from '@/server/lab';

const LEAGUE_AVG = 1.35;
function lambdaFor(attack: number, oppDefense: number, isHome: boolean): number {
  return Math.max(0.18, LEAGUE_AVG * (attack / 75) * (2 - oppDefense / 75) * (isHome ? 1.12 : 0.94));
}
const W = 640, Hgt = 240, PADL = 30, PADR = 14, PADT = 12, PADB = 28;
const pctTxt = (v: number) => `${Math.round(v * 100)}%`;

interface Pt { minute: number; home: number; draw: number; away: number; sh: number; sa: number }

function buildPath(m: LabMatch): Pt[] {
  const lh = lambdaFor(m.home.attack, m.away.defense, true);
  const la = lambdaFor(m.away.attack, m.home.defense, false);
  const maxMin = Math.max(90, ...m.events.map((e) => e.minute));
  const pts: Pt[] = [];
  for (let t = 0; t <= maxMin; t++) {
    let sh = 0, sa = 0, rh = 0, ra = 0;
    for (const e of m.events) {
      if (e.minute > t) continue;
      if (e.kind === 'goal') { if (e.side === 'home') sh++; else sa++; }
      else if (e.side === 'home') rh++; else ra++;
    }
    const f = (maxMin - t) / maxMin;
    const remH = lh * f * Math.pow(0.75, rh);
    const remA = la * f * Math.pow(0.75, ra);
    const wp = winProbFromState(sh, sa, remH, remA);
    pts.push({ minute: t, home: wp.home, draw: wp.draw, away: wp.away, sh, sa });
  }
  return pts;
}

export function WinProbabilityTimeline({ matches }: { matches: LabMatch[] }) {
  // Prefer matches that actually have events (a story to tell).
  const ordered = useMemo(
    () => [...matches].sort((a, b) => b.events.length - a.events.length),
    [matches],
  );
  const withEvents = ordered.filter((m) => m.events.length > 0);
  const pool = (withEvents.length ? withEvents : ordered).slice(0, 8);
  const [mid, setMid] = useState(pool[0]?.id ?? '');
  const match = pool.find((m) => m.id === mid) ?? pool[0];

  const path = useMemo(() => (match ? buildPath(match) : []), [match]);
  const maxMin = path.length ? path[path.length - 1]!.minute : 90;
  const [scrub, setScrub] = useState<number | null>(null);
  if (!match || !path.length) return null;

  const sx = (t: number) => PADL + (t / maxMin) * (W - PADL - PADR);
  const sy = (p: number) => PADT + (1 - p) / 1 * (Hgt - PADT - PADB);
  // Stacked bands: home (0..home), draw (home..home+draw), away (home+draw..1)
  const band = (top: (pt: Pt) => number, bottom: (pt: Pt) => number) => {
    const fwd = path.map((pt) => `${sx(pt.minute)},${sy(top(pt))}`);
    const back = [...path].reverse().map((pt) => `${sx(pt.minute)},${sy(bottom(pt))}`);
    return `${fwd.join(' ')} ${back.join(' ')}`;
  };
  const homeColor = match.home.color, awayColor = match.away.color;

  const at = scrub ?? maxMin;
  const cur = path[Math.min(path.length - 1, Math.max(0, at))]!;
  const goalMarks = match.events.filter((e) => e.kind === 'goal');
  const redMarks = match.events.filter((e) => e.kind === 'red');

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {pool.map((m) => (
            <button key={m.id} onClick={() => { setMid(m.id); setScrub(null); }}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${mid === m.id ? 'border-accent/60 bg-accent/10 text-accent' : 'border-terminal-border text-terminal-muted hover:border-accent/40'}`}>
              {m.home.code} {m.homeScore}-{m.awayScore} {m.away.code}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/30 p-2">
          <svg viewBox={`0 0 ${W} ${Hgt}`} className="w-full" onMouseLeave={() => setScrub(null)}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * W;
              setScrub(Math.round(((x - PADL) / (W - PADL - PADR)) * maxMin));
            }}>
            <polygon points={band((p) => p.home, () => 0)} fill={homeColor} fillOpacity={0.85} />
            <polygon points={band((p) => p.home + p.draw, (p) => p.home)} fill="#4b4b5e" fillOpacity={0.85} />
            <polygon points={band(() => 1, (p) => p.home + p.draw)} fill={awayColor} fillOpacity={0.85} />
            {/* half-time + full-time guides */}
            {[45, 90].filter((g) => g < maxMin).map((g) => <line key={g} x1={sx(g)} y1={PADT} x2={sx(g)} y2={Hgt - PADB} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />)}
            {/* goal & red markers */}
            {goalMarks.map((e, i) => (
              <g key={`g${i}`}>
                <line x1={sx(e.minute)} y1={PADT} x2={sx(e.minute)} y2={Hgt - PADB} stroke="#fff" strokeOpacity={0.5} strokeWidth={0.8} />
                <circle cx={sx(e.minute)} cy={PADT + 4} r={3.5} fill="#fff" />
                <text x={sx(e.minute)} y={PADT + 6.5} textAnchor="middle" style={{ fontSize: 6 }}>⚽</text>
              </g>
            ))}
            {redMarks.map((e, i) => <rect key={`r${i}`} x={sx(e.minute) - 1.5} y={PADT} width={3} height={Hgt - PADT - PADB} fill="#ff2e9a" opacity={0.6} />)}
            {/* scrubber line */}
            <line x1={sx(cur.minute)} y1={PADT} x2={sx(cur.minute)} y2={Hgt - PADB} stroke="#fff" strokeWidth={1} />
            {[0, 45, 90].filter((g) => g <= maxMin).map((g) => <text key={g} x={sx(g)} y={Hgt - 10} textAnchor="middle" className="fill-terminal-muted" style={{ fontSize: 9 }}>{g}&apos;</text>)}
          </svg>
        </div>
        <p className="mt-2 text-[11px] text-terminal-muted">
          Win probability rebuilt minute-by-minute from the event feed: the model re-reads the match at each minute from the live score and the goal expectation left in the remaining time (red cards cut a side&rsquo;s rate). Hover to scrub. ⚽ = goal, pink bar = red card.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-terminal-border bg-terminal-panel/50 p-4 text-center">
          <div className="text-[11px] uppercase tracking-widest text-terminal-muted">minute {cur.minute}&apos;</div>
          <div className="tnum mt-1 text-2xl font-extrabold text-terminal-bright">{match.home.code} {cur.sh}–{cur.sa} {match.away.code}</div>
        </div>
        <div className="space-y-1.5 rounded-xl border border-terminal-border bg-terminal-panel/50 p-3 text-sm">
          <Row label={`${match.home.flag} ${match.home.code} win`} v={cur.home} color={homeColor} />
          <Row label="Draw" v={cur.draw} color="#8b8b9e" />
          <Row label={`${match.away.flag} ${match.away.code} win`} v={cur.away} color={awayColor} />
        </div>
        <p className="rounded-lg border border-terminal-border bg-terminal-panel/30 p-3 text-[11px] leading-relaxed text-terminal-muted">
          At kickoff this is the pre-match prediction; by full time it resolves to the result. The jumps are goals — each one swings the model.
        </p>
      </div>
    </div>
  );
}

function Row({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-terminal-text"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
      <span className="tnum font-semibold text-terminal-bright">{pctTxt(v)}</span>
    </div>
  );
}
