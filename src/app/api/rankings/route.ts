import { json } from '@/lib/api';
import { rankingsView } from '@/server/queries';

export function GET() {
  return json(rankingsView(), 'standard');
}

export const dynamic = 'force-dynamic';
