'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Covers the brief boot window after a fresh server start. The app boots on the
 * deterministic simulation and loads live data in the background (~25s); rather
 * than flash that placeholder during a live tournament, we hold a loading screen
 * until the live snapshot lands, then `router.refresh()` swaps the server-rendered
 * content to live and we reveal.
 *
 * Only engages when the server says it's still loading (`initialBlocking`), so a
 * normal load (live data already in memory — the common case between deploys)
 * renders nothing here and pays no cost. A generous safety cap guarantees it can
 * never hang forever: only a prolonged, genuine failure falls through to the app.
 */
// Hold until the live snapshot is genuinely live. The real load (fixtures + 48
// squads + events + enrichments) routinely runs ~25–40s, so a short cap would
// reveal the simulation right before live lands — exactly what we don't want
// during a live tournament. Only a genuine, prolonged failure trips this cap.
const MAX_HOLD_MS = 90_000;
const SLOW_AFTER_MS = 14_000;

export function BootGate({ initialBlocking }: { initialBlocking: boolean }) {
  const router = useRouter();
  const [blocking, setBlocking] = useState(initialBlocking);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Decide once, at mount. `router.refresh()` re-renders the layout server-side
  // with loading=false, flipping the `initialBlocking` prop — so this MUST NOT be
  // an effect dependency, or that prop change would cancel the pending hide-timer
  // and strand the overlay. The effect runs once and owns the whole lifecycle.
  const shouldGate = useRef(initialBlocking);

  useEffect(() => {
    if (!shouldGate.current) return; // live data was already ready at load — no gate
    let cancelled = false;
    const start = Date.now();
    const tick = async () => {
      // Reveal ONLY once the live tournament is actually active. `loading:false`
      // alone is not enough — a *failed* load also clears the flag while leaving
      // the simulation active, and revealing that sim is the bug we're fixing. We
      // keep holding through the self-heal retries until live-2026 lands.
      let ready = false;
      try {
        const s = await (await fetch('/api/live-status', { cache: 'no-store' })).json();
        ready = s.tournamentId === 'live-2026' && !s.loading;
      } catch {
        ready = false;
      }
      if (cancelled) return;
      const elapsed = Date.now() - start;
      if (!ready && elapsed < MAX_HOLD_MS) {
        if (elapsed > SLOW_AFTER_MS) setSlow(true);
        timer.current = setTimeout(tick, 1200);
        return;
      }
      // Live data has landed (or, after MAX_HOLD, we give up and fall back rather
      // than block forever) — pull the live content in, then reveal a beat later
      // so the now-live render replaces the placeholder first.
      router.refresh();
      timer.current = setTimeout(() => {
        if (!cancelled) setBlocking(false);
      }, 600);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  if (!blocking) return null;

  return (
    <div className="wci-bootgate" role="status" aria-live="polite">
      <style>{`
        .wci-bootgate{position:fixed;inset:0;z-index:110;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:18px;background:#0b0613;color:#f6f1ff;}
        .wci-bootgate .mark{font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:#1fe5c4;font-weight:700;}
        .wci-bootgate .ring{width:46px;height:46px;border-radius:50%;border:3px solid rgba(31,229,196,.18);
          border-top-color:#1fe5c4;animation:wciBootSpin .8s linear infinite;}
        .wci-bootgate .sub{font-size:13px;color:#9683b5;}
        .wci-bootgate .hint{font-size:12px;color:#6f5d8c;max-width:300px;text-align:center;}
        @keyframes wciBootSpin{to{transform:rotate(360deg)}}
      `}</style>
      <div className="mark">World Cup Intelligence</div>
      <div className="ring" />
      <div className="sub">Loading live tournament data…</div>
      {slow && <div className="hint">Pulling the latest fixtures, squads, and results. This can take a moment.</div>}
    </div>
  );
}
