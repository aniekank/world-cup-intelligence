import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl">🧤</p>
      <h1 className="mt-4 text-2xl font-bold text-terminal-bright">404 — Off target</h1>
      <p className="mt-2 max-w-sm text-sm text-terminal-muted">
        That page sailed over the bar. The entity may not exist in the current tournament dataset.
      </p>
      <Link href="/" className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-terminal-bg hover:bg-accent-dim">
        Back to dashboard
      </Link>
    </div>
  );
}
