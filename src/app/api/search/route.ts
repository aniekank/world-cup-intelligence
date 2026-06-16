import { json } from '@/lib/api';
import { search } from '@/server/queries';

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return json(search(q), 'standard');
}

export const dynamic = 'force-dynamic';
