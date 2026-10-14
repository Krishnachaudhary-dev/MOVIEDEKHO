/**
 * `/title` route loading shell — shown while the segment streams in.
 *
 * Mirrors the page's own `TitlePageSkeleton` fallback (backdrop block, title
 * line, metadata row) so suspense swaps don't visibly change the layout.
 */
export default function TitleLoading() {
  return (
    <main className="min-h-screen" aria-busy>
      <div className="relative min-h-[60vh] w-full bg-surface">
        <div className="fade-to-b absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-36 sm:px-6">
          <div className="bg-skeleton h-4 w-24 rounded" />
          <div className="bg-skeleton h-12 w-80 max-w-full rounded" />
          <div className="bg-skeleton h-6 w-64 max-w-full rounded" />
          <div className="bg-skeleton h-10 w-72 max-w-full rounded" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        {/* Cast band */}
        <div className="bg-skeleton h-24 w-full rounded-xl" />
        {/* Metadata grid */}
        <div className="bg-skeleton h-32 w-full rounded-xl" />
        {/* Reviews + grid blocks */}
        <div className="bg-skeleton h-48 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading title details…</span>
    </main>
  );
}
