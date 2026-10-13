/**
 * Route-level loading UI. With `cacheComponents` enabled this becomes the
 * static shell while the TMDB rows stream in behind it.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12" aria-busy>
      <div className="mb-10 h-10 w-56 animate-pulse rounded bg-surface-raised" />
      {Array.from({ length: 3 }, (_, row) => (
        <section key={row} className="mb-10">
          <div className="mb-4 h-6 w-40 animate-pulse rounded bg-surface-raised" />
          <ul className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {Array.from({ length: 8 }, (_, card) => (
              <li
                key={card}
                className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-lg bg-surface-raised"
              />
            ))}
          </ul>
        </section>
      ))}
      <span className="sr-only">Loading titles…</span>
    </main>
  );
}
