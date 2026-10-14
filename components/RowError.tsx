import type { TmdbOutcomeError } from "@/lib/tmdb-server";

/**
 * RowError — the card a row renders when its loader reports a failure.
 *
 * Loaders return outcome objects instead of throwing (see `lib/tmdb-server`),
 * so a missing TMDB key degrades to this card rather than taking the page down.
 */
export default function RowError({
  context,
  error,
}: {
  context: string;
  error: TmdbOutcomeError;
}) {
  return (
    <section className="mx-4 mt-8 rounded-lg border border-rating-low/40 bg-surface px-4 py-3 text-sm sm:mx-6">
      <p className="font-semibold">Couldn&apos;t load {context}</p>
      <p className="mt-1 break-words text-muted">
        {error.configError
          ? "Add your TMDB key to .env.local, then restart the dev server."
          : error.message}
      </p>
    </section>
  );
}
