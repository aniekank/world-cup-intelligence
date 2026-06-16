export default function GlobeLoading() {
  return (
    <div className="space-y-4">
      <div>
        <div className="skeleton h-3 w-28 rounded" />
        <div className="skeleton mt-2 h-7 w-72 rounded" />
        <div className="skeleton mt-2 h-4 w-full max-w-xl rounded" />
      </div>
      <div className="relative flex h-[78vh] min-h-[520px] items-center justify-center overflow-hidden rounded-2xl border border-terminal-border">
        {/* Pulsing globe placeholder so the route never looks blank while the
            3D bundle compiles/loads. */}
        <div className="relative">
          <div
            className="h-64 w-64 animate-pulse rounded-full"
            style={{
              background: 'radial-gradient(circle at 38% 32%, #1f1433, #120c20 70%)',
              boxShadow: '0 0 60px rgba(31,229,196,0.15), inset -20px -20px 60px rgba(0,0,0,0.5)',
            }}
          />
          <div className="absolute inset-0 rounded-full ring-1 ring-accent/20" />
        </div>
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-terminal-muted">
          Rendering the world…
        </p>
      </div>
    </div>
  );
}
