import { json, error } from '@/lib/api';
import { playerDetail } from '@/server/queries';
import { generateScoutingReport } from '@/ai/narratives';

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const player = playerDetail(params.id);
  if (!player) return error('Player not found', 404);
  return json({ ...player, scouting: generateScoutingReport(params.id) }, 'standard');
}

export const dynamic = 'force-dynamic';
