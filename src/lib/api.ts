import { NextResponse } from 'next/server';

const TTL = {
  live: Number(process.env.CACHE_TTL_LIVE ?? 15),
  standard: Number(process.env.CACHE_TTL_STANDARD ?? 300),
  static: Number(process.env.CACHE_TTL_STATIC ?? 86400),
};

type Tier = keyof typeof TTL;

/**
 * Standard JSON envelope with tiered edge-cache headers (stale-while-revalidate).
 * "live" for in-play data, "standard" for analytics, "static" for reference data.
 */
export function json<T>(data: T, tier: Tier = 'standard', init?: ResponseInit): NextResponse {
  const ttl = TTL[tier];
  return NextResponse.json(
    { data, meta: { generatedAt: new Date().toISOString(), tier } },
    {
      ...init,
      headers: {
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
        ...(init?.headers ?? {}),
      },
    },
  );
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
