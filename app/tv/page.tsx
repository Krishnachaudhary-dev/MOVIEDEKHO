import { Suspense } from "react";
import { Tv } from "lucide-react";

import MovieRow from "@/components/MovieRow";
import RowError from "@/components/RowError";
import RowFallback from "@/components/RowFallback";
import {
  discoverTv,
  getAiringTodayTv,
  getOnTheAirTv,
  getPopularTv,
  getTopRatedTv,
} from "@/lib/tmdb-server";
import type { TmdbOutcome } from "@/lib/tmdb-server";
import type { TmdbListResponse, TmdbTvResult } from "@/lib/types/tmdb";

/**
 * `/tv` — the TV hub the navbar has always linked to.
 *
 * Mirror of `/movies`: static shell, one `<Suspense>` per row, loaders that
 * report failures as data instead of throwing. Without this route the navbar's
 * "TV Shows" link 404'd on every page load, prefetch included.
 */

type TvList = TmdbListResponse<TmdbTvResult>;

async function TvRowSection({
  title,
  load,
}: {
  title: string;
  load: () => Promise<TmdbOutcome<TvList>>;
}) {
  const outcome = await load();
  if (!outcome.ok) {
    return <RowError context={title} error={outcome.error} />;
  }
  return <MovieRow title={title} items={outcome.data.results.slice(0, 18)} />;
}

export default function TvPage() {
  return (
    <main className="min-h-screen pb-16 pt-24 md:pt-20">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/20">
            <Tv className="size-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">TV Shows</h1>
            <p className="text-xs text-muted">
              Airing now, top rated and more.
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 mt-6 space-y-8">
        <Suspense fallback={<RowFallback />}>
          <TvRowSection title="Popular TV Shows" load={getPopularTv} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <TvRowSection title="Top Rated TV Shows" load={getTopRatedTv} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <TvRowSection title="Airing Today" load={getAiringTodayTv} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <TvRowSection title="On The Air" load={getOnTheAirTv} />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <TvRowSection
            title="Animation"
            load={() => discoverTv({ withGenres: "16" })}
          />
        </Suspense>
        <Suspense fallback={<RowFallback />}>
          <TvRowSection
            title="Sci-Fi & Fantasy"
            load={() => discoverTv({ withGenres: "10765" })}
          />
        </Suspense>
      </div>
    </main>
  );
}
