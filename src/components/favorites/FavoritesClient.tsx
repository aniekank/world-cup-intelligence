'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';

const KEY = 'wc26:favorites';

interface TeamLite {
  id: string;
  name: string;
  code: string;
  flag: string;
  confederation: string;
  forecast: { winTitle: number } | null;
}

export function FavoritesClient() {
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
    } catch {
      setFavorites([]);
    }
    fetch('/api/teams')
      .then((r) => r.json())
      .then((j) => setTeams(j.data))
      .finally(() => setReady(true));
  }, []);

  const toggle = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  const favTeams = teams.filter((t) => favorites.includes(t.id));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-terminal-bright">
          <Star className="h-4 w-4 text-accent-amber" /> Your Favorites
          <span className="text-xs font-normal text-terminal-muted">· stored locally on this device</span>
        </h2>
        {!ready ? (
          <p className="text-sm text-terminal-muted">Loading…</p>
        ) : favTeams.length === 0 ? (
          <p className="text-sm text-terminal-muted">No favorites yet. Tap a star below to follow a team.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favTeams.map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.id}`}
                className="flex items-center gap-3 rounded-lg border border-terminal-border bg-terminal-elevated p-3 hover:border-accent/40"
              >
                <span className="text-2xl">{t.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-terminal-bright">{t.name}</p>
                  <p className="text-[11px] text-terminal-muted">
                    Title odds {((t.forecast?.winTitle ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-terminal-border bg-terminal-panel">
        <p className="border-b border-terminal-border px-4 py-3 text-sm font-semibold text-terminal-bright">
          Follow teams
        </p>
        <div className="grid gap-1 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const fav = favorites.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-terminal-elevated"
              >
                <Star className={`h-4 w-4 ${fav ? 'fill-accent-amber text-accent-amber' : 'text-terminal-muted'}`} />
                <span className="text-lg">{t.flag}</span>
                <span className="truncate text-terminal-text">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
