import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { PlayersExplorer } from '@/components/players/PlayersExplorer';

export const metadata: Metadata = { title: 'Players' };

export default function PlayersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Player Database"
        title="Players"
        description="Every player across all 48 squads with full tournament statistics. Filter by position, sort by any metric, and click through to a complete scouting profile with percentile rankings."
      />
      <PlayersExplorer />
    </div>
  );
}

export const dynamic = 'force-dynamic';
