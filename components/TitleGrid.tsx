import MovieCard from "@/components/MovieCard";
import type { TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";

/**
 * TitleGrid — wrapped poster grid for "More Like This" and My List.
 *
 * Reuses MovieCard (hover lift, quick actions) in a responsive grid instead of
 * a scroller: a recommendation list is browsed, not paged through.
 */

type TitleItem = TmdbMovieResult | TmdbTvResult;

interface TitleGridProps {
  items: TitleItem[];
  /** Shown when the grid is empty (e.g. a stripped-down watchlist). */
  emptyMessage?: string;
}

export default function TitleGrid({ items, emptyMessage }: TitleGridProps) {
  if (items.length === 0) {
    return emptyMessage ? (
      <p className="rounded-lg border border-surface-hover bg-surface px-4 py-3 text-sm text-muted">
        {emptyMessage}
      </p>
    ) : null;
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <MovieCard key={`${"title" in item ? "movie" : "tv"}-${item.id}`} item={item} sizeClass="w-full" />
      ))}
    </div>
  );
}
