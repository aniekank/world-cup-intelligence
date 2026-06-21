import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ManifestoBackdrop } from '@/components/effects/ManifestoBackdrop';
import { IntroSplash } from '@/components/effects/IntroSplash';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'World Cup Intelligence — TASK Enterprises',
    template: '%s · World Cup Intelligence',
  },
  description:
    'TASK Enterprises presents World Cup Intelligence: a live analytics platform with a Monte Carlo forecasting engine, advanced metrics, AI insights, and natural-language search.',
  applicationName: 'World Cup Intelligence',
  keywords: ['World Cup 2026', 'football analytics', 'xG', 'predictions', 'Opta', 'soccer'],
};

export const viewport: Viewport = {
  themeColor: '#0b0613',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <IntroSplash />
        <ManifestoBackdrop />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
            <Topbar />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <footer className="border-t border-terminal-border px-6 py-4 text-xs text-terminal-muted">
              TASK Enterprises presents <span className="text-terminal-text">World Cup Intelligence</span> ·
              Analytics engine v1.0 · Monte Carlo n=8,000
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
