import { NextResponse } from 'next/server';
import { getCompetition, getTeams, getMatches, getActiveSource } from '@/data/store';

export const dynamic = 'force-dynamic';

/** Liveness/readiness probe for load balancers and uptime monitors. */
export function GET() {
  const ok = getTeams().length >= 16 && getMatches().length > 0;
  return NextResponse.json(
    {
      status: ok ? 'healthy' : 'degraded',
      competition: getCompetition().name,
      teams: getTeams().length,
      matches: getMatches().length,
      dataSource: getActiveSource(),
      uptime: process.uptime(),
    },
    { status: ok ? 200 : 503 },
  );
}
