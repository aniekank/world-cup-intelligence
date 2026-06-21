import type { Metadata } from 'next';
import Link from 'next/link';
import { trackRecord, type TrackRow } from '@/server/trackRecord';
import { PageHeader, Panel, Stat, Table, Th, Td } from '@/components/ui';
import { TeamCrest } from '@/components/brand/TeamCrest';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Track Record' };

const OUTCOME: Record<'H' | 'D' | 'A', string> = { H: 'home win', D: 'a draw', A: 'away win' };

function highlight(r: TrackRow, kind: 'best' | 'miss') {
  const o = r.actual;
  const side = o === 'H' ? r.home : o === 'A' ? r.away : null;
  const what = side ? `${side.name} to win` : 'a draw';
  return kind === 'best'
    ? `Model gave ${pct(r.probs[o])} to ${what} — ${r.home.code} ${r.score} ${r.away.code}. Called it.`
    : `Model gave ${what} just ${pct(r.probs[o])} — it happened (${r.home.code} ${r.score} ${r.away.code}).`;
}

export default function TrackRecordPage() {
  const tr = trackRecord();

  if (tr.n === 0) {
    return (
      <div className="space-y-6">
        <PageHeader kicker="Track Record" title="Did the model call it?" description="How the model's pre-match predictions hold up against actual results." />
        <Panel><p className="py-8 text-center text-sm text-terminal-muted">No finished matches to grade yet — the scorecard fills in as games are played.</p></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Track Record"
        title="Did the model call it?"
        description="Every finished match graded against the model's pre-match probabilities — the honest scorecard. Predictions run off static team ratings, so this is a real pre-match read, not hindsight."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Results called" value={`${tr.correct}/${tr.n}`} sub={pct(tr.hitRate, 0)} accent="#1fe5c4" />
        <Stat label="Brier score" value={tr.brier.toFixed(3)} sub={`coin-flip ${tr.baselineBrier.toFixed(3)}`} />
        <Stat label="Skill vs coin-flip" value={pct(tr.skill, 0)} sub={tr.skill > 0 ? 'better' : 'worse'} accent={tr.skill > 0 ? '#1fe5c4' : '#ff8a1e'} />
        <Stat label="Log loss" value={tr.logloss.toFixed(3)} sub="lower is better" />
      </section>

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

      <Panel title="Every result, graded" subtitle="Model probabilities vs what happened · bold = model's pick" bodyClassName="p-0">
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
            {tr.rows.map((r) => {
              const cell = (o: 'H' | 'D' | 'A', v: number) => (
                <Td align="right" className={`tnum ${r.pick === o ? 'font-bold text-terminal-bright' : 'text-terminal-muted'} ${r.pick === o && r.hit ? 'text-accent' : ''}`}>
                  {pct(v, 0)}
                </Td>
              );
              return (
                <tr key={r.match.id} className="hover:bg-terminal-elevated">
                  <Td>
                    <Link href={`/matches/${r.match.id}`} className="flex items-center gap-1.5 hover:text-accent">
                      <TeamCrest code={r.home.code} color={r.home.primaryColor} size={18} />
                      <span className="text-sm font-semibold text-terminal-bright">{r.home.code}</span>
                      <span className="text-xs text-terminal-muted">v</span>
                      <span className="text-sm font-semibold text-terminal-bright">{r.away.code}</span>
                      <TeamCrest code={r.away.code} color={r.away.primaryColor} size={18} />
                    </Link>
                  </Td>
                  {cell('H', r.probs.H)}
                  {cell('D', r.probs.D)}
                  {cell('A', r.probs.A)}
                  <Td align="right" className="tnum font-semibold text-terminal-bright">{r.score}</Td>
                  <Td align="center">{r.hit ? <span className="text-accent">✓</span> : <span className="text-accent-red">✗</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>

      <p className="text-xs leading-relaxed text-terminal-muted">
        This grades the model against results only. The head-to-head versus bookmaker closing lines — &ldquo;did it beat the market?&rdquo; — needs each fixture&rsquo;s pre-match price stored before kickoff (the live odds feed only carries upcoming games), which is the next phase.
      </p>
    </div>
  );
}

export const dynamic = 'force-dynamic';
