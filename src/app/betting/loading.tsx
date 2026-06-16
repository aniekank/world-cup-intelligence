export default function BettingLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-3 w-32 rounded" />
        <div className="skeleton mt-2 h-7 w-56 rounded" />
        <div className="skeleton mt-2 h-4 w-full max-w-xl rounded" />
      </div>
      <div className="skeleton h-20 rounded-xl" />
      <p className="text-sm text-terminal-muted">Pulling live bookmaker odds and comparing to the model…</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="skeleton h-96 rounded-xl lg:col-span-2" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    </div>
  );
}
