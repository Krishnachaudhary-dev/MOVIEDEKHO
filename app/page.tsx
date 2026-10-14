import { Suspense } from "react";

import HeroBanner from "@/components/HeroBanner";
import MovieRow from "@/components/MovieRow";
import RowError from "@/components/RowError";
import RowFallback from "@/components/RowFallback";
import {
  discoverMovies,
  getDetailsByType,
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
 *
 * The row skeleton and error card come from `components/` — `/movies` and
 * `/tv` render the same two states.
 */

type TitleItem = TmdbMovieResult | TmdbTvResult;

async function TrendingSection() {
  const outcome = await getTrendingTitles("day");
  if (!outcome.ok) {
    return <RowError context="Trending Now" error={outcome.error} />;
  }
  const items = outcome.data.results
    .filter((item) => item.media_type !== "person")
    .slice(0, 18);

  const heroItem = items[0];
  // Hero details (genres, runtime/seasons) ride along in a second cached call —
  // an hours-cached entry, not a per-request cost.
  const heroDetails = heroItem
    ? await getDetailsByType("title" in heroItem ? "movie" : "tv", heroItem.id)
    : null;

  return (
    <>
      {heroItem ? (
        <div className="-mt-16 sm:-mt-24">
          <HeroBanner
            item={heroItem}
            details={heroDetails?.ok ? heroDetails.data : null}
          />
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
        <div className="bg-skeleton h-4 w-24 rounded" />
        <div className="bg-skeleton mt-3 h-12 w-80 max-w-full rounded" />
        <div className="bg-skeleton mt-4 h-10 w-64 max-w-full rounded" />
        <div className="mt-6 flex gap-3">
          <div className="bg-skeleton h-10 w-32 rounded" />
          <div className="bg-skeleton h-10 w-32 rounded" />
        </div>
      </div>
    </section>
  );
}
