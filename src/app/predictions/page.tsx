import type { Metadata } from 'next';
import Link from 'next/link';
import { predictionsView } from '@/server/queries';
import { PageHeader, Panel, Table, Th, Td, Badge } from '@/components/ui';
import { InfoTip } from '@/components/ui/InfoTip';
import { SimulationBanner } from '@/components/SimulationBanner';
import { HBar } from '@/components/charts/Recharts';
import { pct } from '@/lib/format';
import { TrackActivation } from '@/components/TrackActivation';
import { RegionalGoldenBoot } from '@/components/predictions/RegionalGoldenBoot';
import { RUNS } from '@/analytics/simulate';

export const metadata: Metadata = { title: 'Predictions' };

export default function PredictionsPage() {
  const { forecasts, goldenBoot } = predictionsView();
  const titleData = forecasts.slice(0, 12).map((f) => ({
    label: f.team.code,
    value: Math.round(f.forecast.winTitle * 1000) / 10,
    color: f.team.primaryColor,
  }));

  return (
    <div className="space-y-6">
      <TrackActivation action="prediction_viewed" />
      <PageHeader
        kicker="Forecasting"
        title="Tournament Predictions"
        description={`Every probability is derived from ${RUNS.toLocaleString()} Monte Carlo simulations of the remaining tournament: each run completes the group stage, resolves the best third-placed teams, seeds the knockout bracket, and plays out every tie via ELO win expectancy.`}
        action={
          <Link
            href="/guide#monte-carlo"
            className="rounded-lg border border-terminal-border px-3 py-1.5 text-xs text-terminal-muted transition-colors hover:border-accent hover:text-accent"
          >
            What do these numbers mean?
          </Link>
        }
      />

      <SimulationBanner context="predictions" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Championship Probability" subtitle="Top 12 · % of simulations won">
          <HBar data={titleData} unit="%" height={360} />
        </Panel>

        <Panel title="Stage-Reach Probabilities" subtitle="How far each contender advances" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Team</Th>
                <Th align="right">R16</Th>
                <Th align="right">QF</Th>
                <Th align="right">SF</Th>
                <Th align="right">Final</Th>
                <Th align="right">Win</Th>
              </tr>
            </thead>
            <tbody>
              {forecasts.slice(0, 14).map(({ team, forecast: f }) => (
                <tr key={team.id}>
                  <Td>
                    <Link href={`/teams/${team.id}`} className="flex items-center gap-2 hover:text-accent">
                      <span>{team.flag}</span>
                      <span className="font-medium text-terminal-bright">{team.code}</span>
                    </Link>
                  </Td>
                  <Td align="right">{pct(f.reachR16, 0)}</Td>
                  <Td align="right">{pct(f.reachQF, 0)}</Td>
                  <Td align="right">{pct(f.reachSF, 0)}</Td>
                  <Td align="right">{pct(f.reachFinal, 0)}</Td>
                  <Td align="right" className="font-bold text-accent">{pct(f.winTitle, 1)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Over- & Under-Performers" subtitle="Title probability vs pre-tournament market" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Team</Th>
                <Th align="right">Pre-WC</Th>
                <Th align="right">Now</Th>
                <Th align="right">Δ</Th>
              </tr>
            </thead>
            <tbody>
              {[...forecasts]
                .sort((a, b) => b.forecast.titleProbabilityDelta - a.forecast.titleProbabilityDelta)
                .filter((f, i, arr) => i < 5 || i >= arr.length - 5)
                .map(({ team, forecast: f }) => {
                  const up = f.titleProbabilityDelta >= 0;
                  return (
                    <tr key={team.id}>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span>{team.flag}</span>
                          <span className="text-terminal-bright">{team.name}</span>
                        </span>
                      </Td>
                      <Td align="right" className="text-terminal-muted">{pct(team.preTournamentTitleOdds)}</Td>
                      <Td align="right">{pct(f.winTitle)}</Td>
                      <Td align="right">
                        <Badge tone={up ? 'accent' : 'red'}>
                          {up ? '+' : ''}
                          {pct(f.titleProbabilityDelta)}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        </Panel>

        <Panel
          title={
            <span className="inline-flex items-center">
              Golden Boot Projection
              <InfoTip wide label="What is xG?">
                <strong className="text-terminal-bright">xG (expected goals)</strong> measures chance quality — how
                likely each shot was to score. We blend it with goals so far to project a final tally, so lucky/unlucky
                finishing regresses. <Link href="/guide#xg" className="text-accent hover:underline">Full explainer →</Link>
              </InfoTip>
            </span>
          }
          subtitle="Live standings + finishing-adjusted projection · by region"
          bodyClassName="p-0"
        >
          <RegionalGoldenBoot rows={goldenBoot} />
        </Panel>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
