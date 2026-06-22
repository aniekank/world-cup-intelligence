import type { Metadata } from 'next';
import { defenseView } from '@/server/defense';
import { PageHeader, Panel } from '@/components/ui';
import { RegionalDefense } from '@/components/defense/RegionalDefense';

export const metadata: Metadata = { title: 'Defense' };

export default function DefensePage() {
  const data = defenseView();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Defense"
        title="The Wall"
        description="Attack gets the Golden Boot and the headlines. This is the other half of the game: the meanest defenses, the goalkeepers behind them, and the players who win the ball back — sliceable by region."
      />

      {!data.hasResults ? (
        <Panel>
          <p className="py-8 text-center text-sm text-terminal-muted">
            Defensive boards populate once matches have been played.
          </p>
        </Panel>
      ) : (
        <RegionalDefense data={data} />
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
