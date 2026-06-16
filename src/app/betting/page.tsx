import type { Metadata } from 'next';
import { bettingEdge } from '@/server/betting';
import { PageHeader, EmptyState } from '@/components/ui';
import { ResponsibleGamblingBanner } from '@/components/betting/ResponsibleGamblingBanner';
import { SimulationBanner } from '@/components/SimulationBanner';
import { BettingClient } from '@/components/betting/BettingClient';

export const metadata: Metadata = { title: 'Betting Edge' };
export const dynamic = 'force-dynamic';

export default async function BettingPage() {
  const data = await bettingEdge();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Model vs Market"
        title="Betting Edge"
        description="Our Monte Carlo & Poisson probabilities lined up against de-vigged bookmaker consensus and best available prices — with expected-value flags, a customizable bet slip, and disciplined Kelly stake sizing. A comparison tool, not a tipster."
      />

      <ResponsibleGamblingBanner />
      <SimulationBanner context="betting" />

      {!data.available ? (
        <EmptyState>
          {data.isLive
            ? 'Live odds are loading from the market — refresh in a moment.'
            : 'Betting markets are only available for the live World Cup 2026. Switch to it in the top-right selector.'}
        </EmptyState>
      ) : (
        <BettingClient rows={data.rows} />
      )}
    </div>
  );
}
