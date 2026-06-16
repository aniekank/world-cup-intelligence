import { json } from '@/lib/api';
import { matchesView } from '@/server/queries';

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = matchesView({
    status: searchParams.get('status') ?? undefined,
    stage: searchParams.get('stage') ?? undefined,
    groupId: searchParams.get('group') ?? undefined,
  });
  const hasLive = result.some((m) => m.status === 'LIVE');
  return json(result, hasLive ? 'live' : 'standard');
}

export const dynamic = 'force-dynamic';
