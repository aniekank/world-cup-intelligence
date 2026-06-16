import { json } from '@/lib/api';
import { players } from '@/server/queries';

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = players({
    position: searchParams.get('position') ?? undefined,
    teamId: searchParams.get('team') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
  });
  return json(result, 'standard');
}

export const dynamic = 'force-dynamic';
