import { json } from '@/lib/api';
import { players } from '@/server/queries';
import { getTeams } from '@/data/store';

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = players({
    position: searchParams.get('position') ?? undefined,
    teamId: searchParams.get('team') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
  });
  // Tag each player with its team's confederation so the explorer can filter by
  // region without a second round-trip.
  const conf = new Map(getTeams().map((t) => [t.id, t.confederation]));
  const enriched = result.map((p) => ({ ...p, confederation: conf.get(p.teamId) ?? null }));
  return json(enriched, 'standard');
}

export const dynamic = 'force-dynamic';
