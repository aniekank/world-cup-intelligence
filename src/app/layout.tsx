import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ManifestoBackdrop } from '@/components/effects/ManifestoBackdrop';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'WC26 Intelligence — World Cup Analytics Terminal',
    template: '%s · WC26 Intelligence',
  },
  description:
    'The definitive World Cup intelligence platform. Live match center, advanced analytics, Monte Carlo predictions, AI insights, and natural-language analytics search.',
  applicationName: 'WC26 Intelligence',
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
        <ManifestoBackdrop />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
            <Topbar />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <footer className="border-t border-terminal-border px-6 py-4 text-xs text-terminal-muted">
              WC26 Intelligence · Simulated dataset for demonstration · Analytics engine v1.0 ·
              Monte Carlo n=8,000
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
