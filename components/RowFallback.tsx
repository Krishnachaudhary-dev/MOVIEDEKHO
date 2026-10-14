/**
 * RowFallback — shimmer band shown while a TMDB row streams in.
 *
 * Shared by the homepage and the /movies and /tv browse pages so the three
 * render the same loading state; it lives in `components/` rather than in each
 * page because the markup is identical everywhere.
 */
export default function RowFallback() {
  return (
    <section className="mt-8" aria-busy>
      <div className="bg-skeleton mb-3 h-6 w-40 rounded" />
      <ul className="no-scrollbar flex gap-3 overflow-hidden px-4 py-1 sm:px-6">
        {Array.from({ length: 8 }, (_, i) => (
          <li
            key={i}
            className="bg-skeleton aspect-[2/3] w-36 shrink-0 rounded-lg sm:w-44"
          />
        ))}
      </ul>
    </section>
  );
}
