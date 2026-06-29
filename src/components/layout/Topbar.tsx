'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { TournamentSwitcher } from './TournamentSwitcher';
import { LiveRefresh } from './LiveRefresh';
import { ModelToggle } from './ModelToggle';

interface SearchResult {
  teams: { id: string; name: string; flag: string; code: string }[];
  players: { id: string; name: string; team: { code: string; flag: string } }[];
  matches: { id: string; home: { code: string }; away: { code: string } }[];
}

export function Topbar() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => {
          setResults(j.data);
          setOpen(true);
        })
        .catch(() => {});
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/ask?q=${encodeURIComponent(q)}`);
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-terminal-border bg-terminal-bg/80 px-4 pl-14 backdrop-blur lg:pl-6">
      <div ref={boxRef} className="relative w-full max-w-xl">
        <form onSubmit={submit} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-terminal-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="Search teams, players… or ask “highest xG among midfielders?”"
            className="w-full rounded-md border border-terminal-border bg-terminal-panel py-2 pl-9 pr-16 text-sm text-terminal-bright placeholder:text-terminal-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-terminal-border px-1.5 py-0.5 text-[10px] text-terminal-muted sm:flex">
            <CornerDownLeft className="h-3 w-3" /> Ask
          </kbd>
        </form>

        {open && results && (
          <div className="absolute mt-1.5 w-full overflow-hidden rounded-md border border-terminal-border bg-terminal-elevated shadow-glow">
            {results.teams.length === 0 && results.players.length === 0 && results.matches.length === 0 && (
              <p className="px-4 py-3 text-sm text-terminal-muted">No matches. Press Enter to ask the AI.</p>
            )}
            {results.teams.length > 0 && (
              <Group title="Teams">
                {results.teams.map((t) => (
                  <Row key={t.id} href={`/teams/${t.id}`} onNavigate={() => setOpen(false)}>
                    <span className="text-base">{t.flag}</span> {t.name}
                    <span className="ml-auto text-xs text-terminal-muted">{t.code}</span>
                  </Row>
                ))}
              </Group>
            )}
            {results.players.length > 0 && (
              <Group title="Players">
                {results.players.map((p) => (
                  <Row key={p.id} href={`/players/${p.id}`} onNavigate={() => setOpen(false)}>
                    <span className="text-base">{p.team.flag}</span> {p.name}
                    <span className="ml-auto text-xs text-terminal-muted">{p.team.code}</span>
                  </Row>
                ))}
              </Group>
            )}
            {results.matches.length > 0 && (
              <Group title="Matches">
                {results.matches.map((m) => (
                  <Row key={m.id} href={`/matches/${m.id}`} onNavigate={() => setOpen(false)}>
                    {m.home.code} v {m.away.code}
                  </Row>
                ))}
              </Group>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs text-terminal-muted">
        <ModelToggle />
        <LiveRefresh />
        <TournamentSwitcher />
        <Link href="/settings" className="hidden hover:text-terminal-bright sm:inline">
          Settings
        </Link>
      </div>
    </header>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-terminal-border last:border-0">
      <p className="px-4 pt-2 text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">{title}</p>
      <div className="py-1">{children}</div>
    </div>
  );
}

function Row({ href, children, onNavigate }: { href: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2 px-4 py-1.5 text-sm text-terminal-text hover:bg-terminal-panel hover:text-terminal-bright"
    >
      {children}
    </Link>
  );
}
