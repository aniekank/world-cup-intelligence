'use client';

import { useEffect, useState } from 'react';

type Prefs = {
  oddsFormat: 'percent' | 'decimal' | 'american';
  density: 'comfortable' | 'compact';
  timezone: 'UTC' | 'local';
  notifications: { goals: boolean; kickoff: boolean; upsets: boolean; insights: boolean };
};

const DEFAULT: Prefs = {
  oddsFormat: 'percent',
  density: 'comfortable',
  timezone: 'UTC',
  notifications: { goals: true, kickoff: true, upsets: true, insights: false },
};

const KEY = 'wc26:prefs';

export function SettingsClient() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setPrefs({ ...DEFAULT, ...JSON.parse(stored) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = (next: Prefs) => {
    setPrefs(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-4">
      <Section title="Display">
        <Choice
          label="Odds format"
          value={prefs.oddsFormat}
          options={[
            { v: 'percent', l: 'Percentage' },
            { v: 'decimal', l: 'Decimal' },
            { v: 'american', l: 'American' },
          ]}
          onChange={(v) => update({ ...prefs, oddsFormat: v as Prefs['oddsFormat'] })}
        />
        <Choice
          label="Density"
          value={prefs.density}
          options={[
            { v: 'comfortable', l: 'Comfortable' },
            { v: 'compact', l: 'Compact' },
          ]}
          onChange={(v) => update({ ...prefs, density: v as Prefs['density'] })}
        />
        <Choice
          label="Timezone"
          value={prefs.timezone}
          options={[
            { v: 'UTC', l: 'UTC' },
            { v: 'local', l: 'Local' },
          ]}
          onChange={(v) => update({ ...prefs, timezone: v as Prefs['timezone'] })}
        />
      </Section>

      <Section title="Notifications">
        {(['goals', 'kickoff', 'upsets', 'insights'] as const).map((k) => (
          <Toggle
            key={k}
            label={
              k === 'goals' ? 'Goal alerts' : k === 'kickoff' ? 'Kickoff reminders' : k === 'upsets' ? 'Upset alerts' : 'AI insight digests'
            }
            checked={prefs.notifications[k]}
            onChange={(checked) => update({ ...prefs, notifications: { ...prefs.notifications, [k]: checked } })}
          />
        ))}
      </Section>

      {saved && <p className="text-xs text-accent">Preferences saved.</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel">
      <p className="border-b border-terminal-border px-4 py-3 text-sm font-semibold text-terminal-bright">{title}</p>
      <div className="divide-y divide-terminal-border/60">{children}</div>
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-terminal-text">{label}</span>
      <div className="flex gap-1 rounded-md border border-terminal-border p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`rounded px-2.5 py-1 text-xs ${value === o.v ? 'bg-accent/15 text-accent' : 'text-terminal-muted hover:text-terminal-bright'}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-terminal-text">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-terminal-border'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
