import type { Metadata } from 'next';
import { resultsFeed } from '@/server/queries';
import { PageHeader, EmptyState } from '@/components/ui';
import { ResultsByDay } from '@/components/results/ResultsByDay';

export const metadata: Metadata = { title: 'Results & Recaps' };
export const dynamic = 'force-dynamic';

export default function ResultsPage() {
  const results = resultsFeed();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Match Centre"
        title="Results & Recaps"
        description="Every finished match, newest first — final score, goalscorers, and an auto-written recap of how it played out. Tap any result for the full match data."
      />

      {results.length === 0 ? (
        <EmptyState>Finished matches and their recaps will appear here once games are played.</EmptyState>
      ) : (
        <ResultsByDay results={results} />
      )}
    </div>
  );
}
