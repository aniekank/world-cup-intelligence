import type { Metadata } from 'next';
import Link from 'next/link';
import { trackRecord, marketComparison, type TrackRow, type TrackCell } from '@/server/trackRecord';
import { getMatches } from '@/data/store';
import { tournamentComplete } from '@/analytics/knockoutResults';
import { PageHeader, Panel, Stat, Table, Th, Td, Badge } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Track Record' };

function highlight(r: TrackRow, kind: 'best' | 'miss') {
  const outcome = r.mode === 'advance' ? `${r.actualLabel} to advance` : r.actualLabel === 'Draw' ? 'a draw' : `${r.actualLabel} to win`;
  const p = pct(r.cells.find((c) => c.actual)?.prob ?? 0);
  const line = `${r.home.code} ${r.score} ${r.away.code}`;
  return kind === 'best'
    ? `Model gave ${p} to ${outcome} — ${line}. Called it.`
    : `Model gave ${outcome} just ${p} — it happened (${line}).`;
}

function probCell(cell: TrackCell, hit: boolean, key: number) {
  return (
    <Td key={key} align="right" className={`tnum ${cell.pick ? 'font-bold text-terminal-bright' : 'text-terminal-muted'} ${cell.pick && hit ? 'text-accent' : ''}`}>
      {pct(cell.prob, 0)}
    </Td>
  );
}

function matchCell(r: TrackRow) {
  return (
    <Td>
      <Link href={`/matches/${r.match.id}`} className="flex items-center gap-1.5 hover:text-accent">
        <TeamCrest code={r.home.code} color={r.home.primaryColor} size={18} />
        <span className="text-sm font-semibold text-terminal-bright">{r.home.code}</span>
        <span className="text-xs text-terminal-muted">v</span>
        <span className="text-sm font-semibold text-terminal-bright">{r.away.code}</span>
        <TeamCrest code={r.away.code} color={r.away.primaryColor} size={18} />
      </Link>
    </Td>
  );
}

export default async function TrackRecordPage() {
  const tr = trackRecord();
  const mc = await marketComparison();
  // Tournament decided → this page is the permanent record. (freeze, task #39)
  const settled = tournamentComplete(getMatches());

  if (tr.n === 0) {
    return (
      <div className="space-y-6">
        <PageHeader kicker="Track Record" title="Did the model call it?" description="How the model's pre-match predictions hold up against actual results." />
        <Panel><p className="py-8 text-center text-sm text-terminal-muted">No finished matches to grade yet — the scorecard fills in as games are played.</p></Panel>
      </div>
    );
  }

  const ko = tr.knockoutRows;
  const gp = tr.groupRows;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Track Record"
        title={settled ? 'The final reckoning' : 'Did the model call it?'}
        description={
          settled
            ? `The tournament is complete — all ${tr.n} matches graded against the model's pre-match probabilities, frozen as the permanent record. Group games graded three ways (home / draw / away); knockout ties on which side the model backed to advance, shootouts included. One honest footnote the numbers below don't hide: the model's title favourite was Argentina, start to finish; Spain — third on its pre-tournament board at 10.5% — won it all. Calibration, not clairvoyance, is the product.`
            : "Every finished match graded against the model's pre-match probabilities. Group games are graded three ways (home / draw / away); knockout ties have no draw, so they're graded on which side the model backed to advance — penalty shootouts included."
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Results called" value={`${tr.correct}/${tr.n}`} sub={pct(tr.hitRate, 0)} accent="#1fe5c4" />
        <Stat label="Brier score" value={tr.brier.toFixed(3)} sub={`baseline ${tr.baselineBrier.toFixed(3)}`} />
        <Stat label="Skill vs baseline" value={pct(tr.skill, 0)} sub={tr.skill > 0 ? 'better' : 'worse'} accent={tr.skill > 0 ? '#1fe5c4' : '#ff8a1e'} />
        <Stat label="Log loss" value={tr.logloss.toFixed(3)} sub="lower is better" />
      </section>

      {tr.byPhase.group.n > 0 && tr.byPhase.knockout.n > 0 && (
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Group stage (3-way)" value={`${tr.byPhase.group.correct}/${tr.byPhase.group.n}`} sub={`${pct(tr.byPhase.group.hitRate, 0)} called`} />
          <Stat label="Knockouts (advance)" value={`${tr.byPhase.knockout.correct}/${tr.byPhase.knockout.n}`} sub={`${pct(tr.byPhase.knockout.hitRate, 0)} called`} accent="#1fe5c4" />
        </section>
      )}

      {tr.calibration.length > 0 && (
        <Panel title="Calibration" subtitle="When the model says N%, does it happen N% of the time?">
          <Table>
            <thead>
              <tr>
                <Th>Confidence band</Th>
                <Th align="right">Predictions</Th>
                <Th align="right">Model said</Th>
                <Th align="right">Actually happened</Th>
              </tr>
            </thead>
            <tbody>
              {tr.calibration.map((c) => {
                const gap = Math.abs(c.predicted - c.observed);
                return (
                  <tr key={c.range} className="hover:bg-terminal-elevated">
                    <Td className="text-terminal-text">{c.range}</Td>
                    <Td align="right" className="tnum text-terminal-muted">{c.n}</Td>
                    <Td align="right" className="tnum text-terminal-bright">{pct(c.predicted, 0)}</Td>
                    <Td align="right" className={`tnum font-semibold ${gap <= 0.1 ? 'text-accent' : 'text-accent-amber'}`}>{pct(c.observed, 0)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-xs leading-relaxed text-terminal-muted">
            A well-calibrated model tracks the diagonal — its &ldquo;said&rdquo; and &ldquo;happened&rdquo; columns move together. Green means the two are within 10 points on this sample; a persistent gap in one direction means the model is over- or under-confident.
          </p>
        </Panel>
      )}

      {(tr.bestCall || tr.worstMiss) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {tr.bestCall && (
            <Panel title="Best call" subtitle="Most confident, and right">
              <p className="text-sm leading-relaxed text-terminal-text">{highlight(tr.bestCall, 'best')}</p>
            </Panel>
          )}
          {tr.worstMiss && (
            <Panel title="Biggest miss" subtitle="Most confident, and wrong">
              <p className="text-sm leading-relaxed text-terminal-text">{highlight(tr.worstMiss, 'miss')}</p>
            </Panel>
          )}
        </div>
      )}

      {mc.configured && mc.n > 0 && (
        <Panel title="Model vs the bookies" subtitle={`Closing-line value · ${mc.n} graded fixture${mc.n === 1 ? '' : 's'}`}>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <Stat label="Model Brier" value={mc.modelBrier.toFixed(3)} accent={mc.modelBrier < mc.marketBrier ? '#1fe5c4' : undefined} />
            <Stat label="Market Brier" value={mc.marketBrier.toFixed(3)} />
            <Stat label="Beat the market" value={`${mc.modelBeats}/${mc.n}`} sub={`${Math.round((mc.modelBeats / mc.n) * 100)}%`} />
          </div>
          <p className="text-sm leading-relaxed text-terminal-text">
            {mc.modelBrier < mc.marketBrier
              ? `The model is sharper than the closing line so far — a lower Brier across ${mc.n} graded ${mc.n === 1 ? 'fixture' : 'fixtures'}. Beating the closing line is the real test, so treat a small sample with caution.`
              : `The closing line is sharper than the model so far — which is the usual outcome; the market is hard to beat. A positive model edge most often means the model is wrong.`}
          </p>
        </Panel>
      )}
      {mc.configured && mc.n === 0 && (
        <Panel title="Model vs the bookies" subtitle="Closing-line value">
          <p className="py-3 text-sm text-terminal-muted">
            <Badge tone="accent">Live</Badge> Capturing pre-kickoff snapshots — the market scorecard fills in once snapshotted fixtures finish.
          </p>
        </Panel>
      )}

      {ko.length > 0 && (
        <Panel title="Knockout calls, graded" subtitle="Which side the model backed to advance vs who went through · bold = model's pick" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Tie</Th>
                <Th align="right">Home adv.</Th>
                <Th align="right">Away adv.</Th>
                <Th align="right">Result</Th>
                <Th align="center">Called</Th>
              </tr>
            </thead>
            <tbody>
              {ko.map((r) => (
                <tr key={r.match.id} className="hover:bg-terminal-elevated">
                  {matchCell(r)}
                  {r.cells.map((c, i) => probCell(c, r.hit, i))}
                  <Td align="right" className="tnum font-semibold text-terminal-bright">{r.score}</Td>
                  <Td align="center">{r.hit ? <span className="text-accent">✓</span> : <span className="text-accent-red">✗</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {gp.length > 0 && (
        <Panel title="Group-stage calls, graded" subtitle="Model H/D/A probabilities vs what happened · bold = model's pick" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Match</Th>
                <Th align="right">Home</Th>
                <Th align="right">Draw</Th>
                <Th align="right">Away</Th>
                <Th align="right">Result</Th>
                <Th align="center">Called</Th>
              </tr>
            </thead>
            <tbody>
              {gp.map((r) => (
                <tr key={r.match.id} className="hover:bg-terminal-elevated">
                  {matchCell(r)}
                  {r.cells.map((c, i) => probCell(c, r.hit, i))}
                  <Td align="right" className="tnum font-semibold text-terminal-bright">{r.score}</Td>
                  <Td align="center">{r.hit ? <span className="text-accent">✓</span> : <span className="text-accent-red">✗</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {!mc.configured && (
        <p className="text-xs leading-relaxed text-terminal-muted">
          The head-to-head versus bookmaker closing lines (&ldquo;did it beat the market?&rdquo;) captures each fixture&rsquo;s pre-kickoff price to durable storage. Set <code className="rounded bg-terminal-panel px-1">UPSTASH_REDIS_REST_URL</code> and <code className="rounded bg-terminal-panel px-1">UPSTASH_REDIS_REST_TOKEN</code> to enable it; snapshots then accumulate before each kickoff (closing-line value can&rsquo;t be backfilled).
        </p>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
