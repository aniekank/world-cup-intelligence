import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TOURNAMENTS, getTournament } from '@/data/tournaments';
import { getActiveTournamentId } from '@/data/store';
import { activateTournament } from '@/data/loadTournament';

export const dynamic = 'force-dynamic';

const schema = z.object({ id: z.string().min(1) });

/** List available tournaments + the active one. */
export function GET() {
  return NextResponse.json({
    active: getActiveTournamentId(),
    tournaments: TOURNAMENTS,
  });
}

/** Switch the active tournament for the whole app. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'A tournament "id" is required' }, { status: 400 });
  const t = getTournament(parsed.data.id);
  if (!t) return NextResponse.json({ error: 'Unknown tournament' }, { status: 404 });

  try {
    const snap = await activateTournament(parsed.data.id);
    return NextResponse.json({
      ok: true,
      active: parsed.data.id,
      competition: snap.competition.name,
      teams: snap.teams.length,
      matches: snap.matches.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), hint: t.source === 'apifootball' ? 'API_FOOTBALL_KEY may be unset' : undefined }, { status: 502 });
  }
}
