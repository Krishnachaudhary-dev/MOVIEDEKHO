import { Suspense } from "react";

import HeroBanner from "@/components/HeroBanner";
import MovieRow from "@/components/MovieRow";
import {
  discoverMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingTitles,
} from "@/lib/tmdb-server";
import type { TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";

/**
 * MovieDekho homepage (Phase 3).
 *
 * Static shell + streamed rows: everything below the hero lives behind
 * `<Suspense>` so the page paints instantly and rows fill from TMDB via the
 * `use cache` layer. Loaders return outcome objects (no throwing at render).
 */

type TitleItem = TmdbMovieResult | TmdbTvResult;

/** Row skeleton shown while a section streams in. */
function RowFallback() {
  return (
    <section className="mt-8" aria-busy>
      <div className="mb-3 h-6 w-40 animate-pulse rounded bg-surface-raised" />
      <ul className="no-scrollbar flex gap-3 overflow-hidden px-4 sm:px-6">
        {Array.from({ length: 8 }, (_, i) => (
          <li
            key={i}
            className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-lg bg-surface-raised sm:w-44"
          />
        ))}
      </ul>
    </section>
  );
}

async function TrendingSection() {
  const outcome = await getTrendingTitles("day");
  if (!outcome.ok) {
    return <RowError context="Trending Now" error={outcome.error} />;
  }
  const items = outcome.data.results
    .filter((item) => item.media_type !== "person")
    .slice(0, 18);

  return (
    <>
      {items[0] ? (
        <div className="-mt-16 sm:-mt-24">
          <HeroBanner item={items[0]} />
        </div>
      ) : null}
      <div className="mt-6 space-y-8">
        <MovieRow title="Trending Now" items={items.slice(1, 18)} />
      </div>
    </>
  );
}

async function PopularSection() {
  const outcome = await getPopularMovies();
  if (!outcome.ok) {
    return <RowError context="Popular Movies" error={outcome.error} />;
  }
  const items: TitleItem[] = outcome.data.results;
  return <MovieRow title="Popular Movies" items={items.slice(0, 18)} />;
}

async function TopRatedSection() {
  const outcome = await getTopRatedMovies();
  if (!outcome.ok) {
    return <RowError context="Top Rated Movies" error={outcome.error} />;
  }
  const items: TitleItem[] = outcome.data.results;
  return <MovieRow title="Top Rated Movies" items={items.slice(0, 18)} />;
}

/** Action & Drama blended: discover with_genres 28 (Action) + 18 (Drama), OR-ed. */
async function ActionDramaSection() {
  const [action, drama] = await Promise.all([
    discoverMovies({ withGenres: "28" }),
    discoverMovies({ withGenres: "18" }),
  ]);

  if (!action.ok) {
    return <RowError context="Action & Drama" error={action.error} />;
  }
  if (!drama.ok) {
    return <RowError context="Action & Drama" error={drama.error} />;
  }

  // Interleave the two lists so the row feels curated, dedupe by id.
  const seen = new Set<number>();
  const merged: TitleItem[] = [];
  const maxLen = Math.max(action.data.results.length, drama.data.results.length);
  for (let i = 0; i < maxLen; i++) {
    for (const item of [action.data.results[i], drama.data.results[i]]) {
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
      if (merged.length >= 18) break;
    }
    if (merged.length >= 18) break;
  }

  return <MovieRow title="Action & Drama" items={merged} />;
}

function RowError({
  context,
  error,
}: {
  context: string;
  error: { message: string; configError: boolean };
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

export default function Page() {
  return (
    <main className="min-h-screen pb-16">
      <Suspense fallback={<HeroFallback />}>
        <TrendingSection />
      </Suspense>

      <div className="relative z-10 space-y-8">
        <Suspense fallback={<RowFallback />}>
          <PopularSection />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <TopRatedSection />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <ActionDramaSection />
        </Suspense>
      </div>
    </main>
  );
}

function HeroFallback() {
  return (
    <section className="relative min-h-[70vh] w-full" aria-busy>
      <div className="absolute inset-0 bg-surface" />
      <div className="fade-to-b absolute inset-x-0 bottom-0 h-64" />
      <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-end px-4 pb-20 sm:px-6">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
        <div className="mt-3 h-12 w-80 max-w-full animate-pulse rounded bg-surface-raised" />
        <div className="mt-4 h-10 w-64 max-w-full animate-pulse rounded bg-surface-raised" />
        <div className="mt-6 flex gap-3">
          <div className="h-10 w-32 animate-pulse rounded bg-surface-raised" />
          <div className="h-10 w-32 animate-pulse rounded bg-surface-raised" />
        </div>
      </div>
    </section>
  );
}
