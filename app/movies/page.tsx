import { Suspense } from "react";
import { Film } from "lucide-react";

import MovieRow from "@/components/MovieRow";
import RowError from "@/components/RowError";
import RowFallback from "@/components/RowFallback";
import {
  discoverMovies,
  getNowPlayingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getUpcomingMovies,
} from "@/lib/tmdb-server";
import type { TmdbOutcome } from "@/lib/tmdb-server";
import type { TmdbListResponse, TmdbMovieResult } from "@/lib/types/tmdb";

/**
 * `/movies` — the movies hub the navbar has always linked to.
 *
 * Same shape as the homepage: a static shell, one `<Suspense>` per row, and
 * loaders that report failures as data (see `lib/tmdb-server`). Without this
 * route the navbar's "Movies" link 404'd on every page load, including the
 * router's prefetch of it.
 */

type MovieList = TmdbListResponse<TmdbMovieResult>;

/** One row, driven by whichever loader it is handed. */
async function MovieRowSection({
  title,
  load,
}: {
  title: string;
  load: () => Promise<TmdbOutcome<MovieList>>;
}) {
  const outcome = await load();
  if (!outcome.ok) {
    return <RowError context={title} error={outcome.error} />;
  }
  return <MovieRow title={title} items={outcome.data.results.slice(0, 18)} />;
}

export default function MoviesPage() {
  return (
    <main className="min-h-screen pb-16 pt-24 md:pt-20">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/20">
            <Film className="size-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Movies</h1>
            <p className="text-xs text-muted">
              Popular, top rated and upcoming titles.
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 mt-6 space-y-8">
        <Suspense fallback={<RowFallback />}>
          <MovieRowSection title="In Theatres" load={getNowPlayingMovies} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <MovieRowSection title="Popular Movies" load={getPopularMovies} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <MovieRowSection title="Top Rated Movies" load={getTopRatedMovies} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <MovieRowSection title="Coming Soon" load={getUpcomingMovies} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <MovieRowSection
            title="Action"
            load={() => discoverMovies({ withGenres: "28" })}
          />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <MovieRowSection
            title="Comedy"
            load={() => discoverMovies({ withGenres: "35" })}
          />
        </Suspense>
      </div>
    </main>
  );
}
