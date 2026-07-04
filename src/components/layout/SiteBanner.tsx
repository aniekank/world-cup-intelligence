import { liveStatus } from '@/server/queries';

/**
 * Full-width status bar shown when the site isn't serving fresh live data, so a
 * visitor is never silently shown the placeholder simulation as if it were real.
 * Two triggers (WC-072):
 *  1. `SITE_NOTICE` env var — a manual maintenance/announcement message we can set
 *     in the Render dashboard during a build or bugfix window (clears on unset).
 *  2. Automatic — the live edition is intended but the app has fallen back to the
 *     simulation (source label "Simulation (live feed unavailable)", e.g. a
 *     provider quota outage) or is still loading it at boot.
 *
 * Server-rendered: the existing <LiveRefresh> poll calls router.refresh() when the
 * snapshot changes, so this re-evaluates and hides itself the moment live data
 * comes back — no reload needed. Unlike <BootGate> it doesn't block the app, so
 * visitors can still browse (history, the Model Lab, forecasts) during an outage.
 */
export function SiteBanner() {
  const notice = process.env.SITE_NOTICE?.trim();
  let text: string | null = notice || null;

  if (!text) {
    try {
      const s = liveStatus();
      if (s.loading) {
        text = 'Loading live World Cup data…';
      } else if (/cached/i.test(s.source)) {
        text =
          'Live updates are paused (feed temporarily unavailable) — showing the most recent data. Live scores resume automatically.';
      } else if (/live feed unavailable/i.test(s.source)) {
        text =
          'Live World Cup data is temporarily unavailable — showing simulated data in the meantime. Live scores resume automatically.';
      }
    } catch {
      /* status read failed → show nothing rather than a misleading bar */
    }
  }

  if (!text) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-accent-amber/30 bg-accent-amber/10 px-4 py-2 text-center text-xs font-medium text-accent-amber"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-amber" />
      <span>{text}</span>
    </div>
  );
}
