import { ShieldAlert } from 'lucide-react';

/**
 * Prominent responsible-gambling notice. Shown at the top of every betting
 * surface — not optional, not collapsible.
 */
export function ResponsibleGamblingBanner() {
  return (
    <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/[0.07] p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber" />
        <div className="space-y-1.5 text-sm">
          <p className="font-semibold text-terminal-bright">For analysis & education only — not betting advice.</p>
          <p className="text-terminal-muted">
            These are <span className="text-terminal-text">model estimates</span>, not predictions of outcomes. The
            betting market is sharper than any simple model, and no system overcomes the bookmaker&apos;s built-in
            margin over time. A &ldquo;positive edge&rdquo; here usually means the model is wrong, not that a bet is
            profitable. You must be of legal age in your jurisdiction. Only ever stake what you can comfortably afford
            to lose, and set limits before you start.
          </p>
          <p className="text-xs text-terminal-muted">
            Need support? <span className="text-accent">BeGambleAware.org</span> ·{' '}
            <span className="text-accent">GamCare</span> · US National Problem Gambling Helpline{' '}
            <span className="text-accent">1-800-GAMBLER</span>
          </p>
        </div>
      </div>
    </div>
  );
}
