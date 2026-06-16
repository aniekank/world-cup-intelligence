import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/ui';
import { SettingsClient } from '@/components/settings/SettingsClient';
import { getCompetition } from '@/data/store';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  const comp = getCompetition();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="Preferences" title="Settings" description="Customize display, odds format and notifications. Preferences are stored locally on this device." />
      <SettingsClient />
      <Panel title="About">
        <dl className="space-y-2 text-sm">
          <Row k="Platform" v="WC26 Intelligence v1.0" />
          <Row k="Competition" v={`${comp.name} (${comp.season})`} />
          <Row k="Hosts" v={comp.hostCountries.join(', ')} />
          <Row k="Data source" v="Deterministic simulation engine" />
          <Row k="Simulations" v="8,000 Monte Carlo runs" />
          <Row k="Analytics" v="ELO · bivariate-Poisson · xG · power ratings" />
        </dl>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-terminal-muted">{k}</dt>
      <dd className="text-terminal-text">{v}</dd>
    </div>
  );
}

export const dynamic = 'force-dynamic';
