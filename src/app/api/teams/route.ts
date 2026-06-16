import { json } from '@/lib/api';
import { teamsWithForecast } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export function GET() {
  return json(teamsWithForecast(), 'standard');
}
