export default function ClubsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-3 w-44 rounded" />
        <div className="skeleton mt-2 h-7 w-64 rounded" />
        <div className="skeleton mt-2 h-4 w-full max-w-xl rounded" />
      </div>
      <p className="text-sm text-terminal-muted">Matching World Cup squads to their clubs across the Premier League, Ligue 1 and Serie A…</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
