/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
    // Runs src/instrumentation.ts at server start (live-data bootstrap)
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Framing: this site, and Motion's in-car browser (the Tesla screen on /tapes opens links in place). Everyone
          // else is still refused. frame-ancestors replaces the old X-Frame-Options: SAMEORIGIN.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://motion-page-alpha.taskenterprises.workers.dev https://motionpage.link https://*.motionpage.link" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
