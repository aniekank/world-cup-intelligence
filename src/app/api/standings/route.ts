import { json } from '@/lib/api';
import { standingsView } from '@/server/queries';

export function GET() {
  return json(standingsView(), 'standard');
}

export const dynamic = 'force-dynamic';
