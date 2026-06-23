'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import type { NLQueryResult } from '@/domain/types';

const EXAMPLES = [
  'Who has the highest xG among midfielders?',
  'Which teams are outperforming pre-tournament expectations?',
  'Show under-the-radar breakout players',
  'Which team has the easiest path to the final?',
  'Who is most likely to win the tournament?',
  'Strongest defense in the tournament',
  'Which teams press the highest?',
  "Spain's playing style",
  'Golden Boot projection',
  'Highest progressive passes per 90 among defenders',
];

export function AskClient() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback((q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setQuery(q);
    fetch(`/api/ask?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((j) => setResult(j.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) run(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numericCols = result
    ? result.columns.map((_, ci) => result.rows.every((r) => typeof r[ci] === 'number'))
    : [];
  const barCol = result && result.vizHint === 'bar' ? numericCols.lastIndexOf(true) : -1;
  const barMax =
    result && barCol >= 0 ? Math.max(...result.rows.map((r) => Number(r[barCol]) || 0)) : 0;

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="relative"
      >
        <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-accent" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about the tournament…"
          autoFocus
          className="w-full rounded-xl border border-terminal-border bg-terminal-panel py-4 pl-12 pr-28 text-base text-terminal-bright placeholder:text-terminal-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-terminal-bg hover:bg-accent-dim"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ask <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => run(ex)}
              className="rounded-full border border-terminal-border bg-terminal-panel px-3 py-1.5 text-xs text-terminal-text transition-colors hover:border-accent/40 hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Answer */}
          <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-5">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="h-3.5 w-3.5" /> {result.intent.replace(/-/g, ' ')}
            </div>
            <p className="text-lg leading-relaxed text-terminal-bright">{result.answer}</p>
          </div>

          {/* Evidence table */}
          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-terminal-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-terminal-panel text-[11px] uppercase tracking-wide text-terminal-muted">
                    {result.columns.map((c, i) => (
                      <th key={i} className={`px-3 py-2 ${numericCols[i] ? 'text-right' : 'text-left'}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-terminal-border/60 hover:bg-terminal-elevated">
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-3 py-2 ${numericCols[ci] ? 'tnum text-right' : 'text-left'} ${ci === 1 ? 'font-medium text-terminal-bright' : 'text-terminal-text'}`}>
                          {ci === barCol && barMax > 0 ? (
                            <span className="flex items-center justify-end gap-2">
                              <span className="h-1.5 rounded-full bg-accent" style={{ width: `${(Number(cell) / barMax) * 80}px` }} />
                              {cell}
                            </span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Follow-ups */}
          {result.followUps.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-terminal-muted">Follow-up questions</p>
              <div className="flex flex-wrap gap-2">
                {result.followUps.map((f) => (
                  <button
                    key={f}
                    onClick={() => run(f)}
                    className="rounded-full border border-terminal-border bg-terminal-panel px-3 py-1.5 text-xs text-terminal-text hover:border-accent/40 hover:text-accent"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
