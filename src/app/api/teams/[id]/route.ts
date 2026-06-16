import { json, error } from '@/lib/api';
import { teamView, squadViews } from '@/server/queries';

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const team = teamView(params.id);
  if (!team) return error('Team not found', 404);
  return json({ ...team, squad: squadViews(params.id) }, 'standard');
}

export const dynamic = 'force-dynamic';
