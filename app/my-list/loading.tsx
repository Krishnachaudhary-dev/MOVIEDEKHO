/**
 * `/my-list` route loading shell — header line plus the poster-grid skeleton
 * the hydrated list renders into.
 */
export default function MyListLoading() {
  return (
    <main className="min-h-screen pb-16 pt-24 sm:pt-20" aria-busy>
      <header className="border-b border-white/10 bg-black px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="bg-skeleton size-10 rounded-lg" />
          <div className="space-y-2">
            <div className="bg-skeleton h-5 w-32 rounded" />
            <div className="bg-skeleton h-3 w-40 rounded" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-skeleton aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading your list…</span>
    </main>
  );
}
