import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ManifestoBackdrop } from '@/components/effects/ManifestoBackdrop';
import { IntroSplash } from '@/components/effects/IntroSplash';
import { BootGate } from '@/components/effects/BootGate';
import { liveStatus } from '@/server/queries';
import { RUNS } from '@/analytics/simulate';

// Default to the production origin (not localhost) so social share cards —
// og:image, twitter:image — resolve to a reachable URL even when
// NEXT_PUBLIC_SITE_URL isn't set. Override the env var for a custom domain.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://world-cup-intelligence.onrender.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'World Cup Intelligence — TASK Enterprises',
    template: '%s · World Cup Intelligence',
  },
  description:
    'World Cup Intelligence: a live FIFA World Cup 2026 analytics platform — a Monte Carlo forecasting engine, an interactive data-science Model Lab, advanced metrics, and AI insights.',
  applicationName: 'World Cup Intelligence',
  keywords: ['World Cup 2026', 'football analytics', 'xG', 'predictions', 'Monte Carlo', 'soccer', 'data science'],
  openGraph: {
    type: 'website',
    siteName: 'World Cup Intelligence',
    title: 'World Cup Intelligence — live World Cup 2026 analytics',
    description: 'A Monte Carlo forecasting engine, an interactive data-science Model Lab, advanced metrics, and AI insights — for the FIFA World Cup 2026.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup Intelligence — live World Cup 2026 analytics',
    description: 'Monte Carlo forecasts, an interactive Model Lab, advanced metrics, and AI insights for the 2026 World Cup.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0613',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // True only during the boot window (live snapshot still loading). Drives a
  // loading screen so the placeholder simulation is never shown during a live
  // tournament. Defensive: a read failure just means "not booting". (WC-042)
  let booting = false;
  try {
    booting = liveStatus().loading;
  } catch {
    /* ignore */
  }
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <BootGate initialBlocking={booting} />
        <IntroSplash />
        <ManifestoBackdrop />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
            <Topbar />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <footer className="border-t border-terminal-border px-6 py-4 text-xs text-terminal-muted">
              TASK Enterprises presents <span className="text-terminal-text">World Cup Intelligence</span> ·
              Analytics engine v1.0 · Monte Carlo n={RUNS.toLocaleString()}
            </footer>
          </div>
        </div>
        {/* Privacy-friendly, cookieless analytics (Umami). Renders only when the
            website id env var is set, so it is a no-op locally / if unconfigured. */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_SRC ?? 'https://cloud.umami.is/script.js'}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
