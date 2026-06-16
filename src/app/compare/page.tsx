import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui';
import { CardBuilder } from '@/components/cards/CardBuilder';

export const metadata: Metadata = { title: 'Card Builder' };

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Build Your Own"
        title="Comparison Cards"
        description="Stack any players or teams side by side, pick exactly the metrics you care about, and build a shareable comparison card. Percentile radar included for players."
      />
      <Suspense fallback={<div className="text-sm text-terminal-muted">Loading…</div>}>
        <CardBuilder />
      </Suspense>
    </div>
  );
}
