import { json } from '@/lib/api';
import { insights, dailyBriefing } from '@/server/queries';

export function GET() {
  return json({ briefing: dailyBriefing(), insights: insights() }, 'standard');
}

export const dynamic = 'force-dynamic';
