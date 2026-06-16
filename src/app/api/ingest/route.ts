import { NextResponse } from 'next/server';
import { fetchWorldCupSnapshot } from '@/data/providers/footballData';

/**
 * Live-data ingestion preview. Proves the football-data.org adapter maps real
 * 2026 World Cup data into the platform's domain types. Set FOOTBALL_DATA_API_KEY
 * and hit this route to see real teams/fixtures/scorers flowing through the same
 * shapes the simulation engine produces.
 *
 * This is intentionally a preview endpoint — wiring it as the app-wide source is
 * the documented productionization step (see README → "Housing real 2026 data").
 */
export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'FOOTBALL_DATA_API_KEY not set',
        howTo:
          'Get a free key at football-data.org, add FOOTBALL_DATA_API_KEY to .env, then GET /api/ingest to map live World Cup data.',
      },
      { status: 503 },
    );
  }

  try {
    const snap = await fetchWorldCupSnapshot(apiKey);
    return NextResponse.json({
      source: 'football-data.org',
      hasAdvancedMetrics: false,
      counts: {
        teams: snap.teams.length,
        groups: snap.groups.length,
        players: snap.players.length,
        matches: snap.matches.length,
        finished: snap.matches.filter((m) => m.status === 'FINISHED').length,
        live: snap.matches.filter((m) => m.status === 'LIVE').length,
      },
      sampleTeams: snap.teams.slice(0, 8).map((t) => ({ code: t.code, name: t.name, group: t.groupId })),
      sampleFixtures: snap.matches.slice(0, 5).map((m) => ({
        id: m.id,
        stage: m.stage,
        status: m.status,
        score: `${m.homeScore}-${m.awayScore}`,
      })),
      generatedAt: snap.generatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
