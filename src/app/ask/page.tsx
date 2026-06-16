import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui';
import { AskClient } from '@/components/ask/AskClient';

export const metadata: Metadata = { title: 'Ask — Natural Language Analytics' };

export default function AskPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        kicker="Natural Language Analytics"
        title="Ask the Data"
        description="Query the entire tournament in plain English. The engine parses your intent, runs the analytics, and returns an evidence-backed answer — leaderboards, comparisons, forecasts, breakout discovery and knockout paths."
      />
      <Suspense fallback={<div className="text-sm text-terminal-muted">Loading…</div>}>
        <AskClient />
      </Suspense>
    </div>
  );
}

export const dynamic = 'force-dynamic';
