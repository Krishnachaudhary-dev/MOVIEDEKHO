/**
 * `/watch` route loading shell — mirrors the watch page's `WatchSkeleton`
 * fallback: title line, 16:9 player block, then the episode-grid band.
 */
export default function WatchLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pb-6 pt-24 sm:px-6 sm:pb-10 md:pt-20"
      aria-busy
    >
      <div className="bg-skeleton h-9 w-72 max-w-full rounded" />
      <div className="bg-skeleton mt-4 aspect-video w-full rounded-xl" />
      <div className="bg-skeleton mt-8 h-6 w-32 rounded" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-skeleton h-20 rounded-lg" />
        ))}
      </div>
      <span className="sr-only">Loading player…</span>
    </div>
  );
}
