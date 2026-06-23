import { NextResponse } from 'next/server';
import { liveStatus } from '@/server/queries';

// Freshness probe polled by the client auto-refresher. Must never be cached —
// the whole point is to report the true current snapshot age + live state.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(liveStatus(), {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
