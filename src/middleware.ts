import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight access log. Writes one line per page/route request to stdout,
 * which Render surfaces in the service Logs tab. Purpose is operational, not
 * analytics: confirm requests are actually reaching the app and see at a glance
 * if anything is erroring. Static assets are excluded by the matcher below to
 * keep the log signal-heavy.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ref = req.headers.get('referer') ?? '-';
  console.log(`[req] ${req.method} ${pathname} ref=${ref}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and common static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|xml)$).*)',
  ],
};
