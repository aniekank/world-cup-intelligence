export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-64 rounded-lg lg:col-span-2" />
        <div className="skeleton h-64 rounded-lg" />
      </div>
    </div>
  );
}
