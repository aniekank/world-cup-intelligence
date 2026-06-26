import { NextResponse } from 'next/server';
import { getTeams, getGroups, getMatches } from '@/data/store';
import { engine } from '@/analytics';
import { runSimulation, RUNS } from '@/analytics/simulate';
import type { Team, TeamForecast } from '@/domain/types';

/**
 * Monte Carlo "what-if": override one team's attack / defense / ELO and re-run
 * the real tournament simulator against the current results, at the same fidelity
 * as the headline forecast (so the before/after comparison is apples-to-apples —
 * the "before" comes from the live engine). At ~0.2s the full re-sim is plenty
 * snappy for the slider. Returns that team's before/after stage probabilities plus
 * the reshuffled title-odds leaderboard, so the user can see the whole field react
 * to one team's strength.
 */
export const dynamic = 'force-dynamic';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function slim(f: TeamForecast | undefined) {
  if (!f) return null;
  return {
    reachR32: f.reachR32, reachR16: f.reachR16, reachQF: f.reachQF,
    reachSF: f.reachSF, reachFinal: f.reachFinal, winTitle: f.winTitle, expectedFinish: f.expectedFinish,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const teamId: string = body.teamId;
    const teams = getTeams();
    const target = teams.find((t) => t.id === teamId);
    if (!target) return NextResponse.json({ error: 'unknown team' }, { status: 400 });

    const attack = clamp(Number(body.attack ?? target.attackRating), 40, 99);
    const defense = clamp(Number(body.defense ?? target.defenseRating), 40, 99);
    const elo = clamp(Number(body.elo ?? target.elo), 1300, 2200);

    // Clone the field, overriding only the target team's strength.
    const modified: Team[] = teams.map((t) =>
      t.id === teamId ? { ...t, attackRating: attack, defenseRating: defense, elo } : t,
    );

    const { forecasts } = runSimulation(modified, getGroups(), getMatches());
    const baseline = engine().forecasts;

    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const leaderboard = [...forecasts.entries()]
      .map(([id, f]) => {
        const t = teamMap.get(id);
        return t ? { id, name: t.name, code: t.code, flag: t.flag, color: t.primaryColor, winTitle: f.winTitle, baseWinTitle: baseline.get(id)?.winTitle ?? 0 } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b!.winTitle - a!.winTitle))
      .slice(0, 8);

    return NextResponse.json({
      teamId,
      applied: { attack, defense, elo },
      before: slim(baseline.get(teamId)),
      after: slim(forecasts.get(teamId)),
      leaderboard,
      runs: RUNS,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
