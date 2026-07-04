import { NextResponse } from 'next/server';
import { liveStatus, liveDebug } from '@/server/queries';

// Freshness probe polled by the client auto-refresher. Must never be cached —
// the whole point is to report the true current snapshot age + live state.
// `?debug=1` returns a richer, still quota-free diagnostic (no provider calls)
// for chasing "a live match vanished" reports.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get('debug');
  return NextResponse.json(debug ? liveDebug() : liveStatus(), {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
