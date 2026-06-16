import { json, error } from '@/lib/api';
import { matchDetail } from '@/server/queries';

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const detail = matchDetail(params.id);
  if (!detail) return error('Match not found', 404);
  return json(detail, detail.match.status === 'LIVE' ? 'live' : 'standard');
}

export const dynamic = 'force-dynamic';
