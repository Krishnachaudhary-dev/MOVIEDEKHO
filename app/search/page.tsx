import { Suspense } from 'react';
import { SearchX, Search, Film, Tv } from 'lucide-react';

import MovieRow from '@/components/MovieRow';
import { searchMovies, searchTv } from '@/lib/tmdb-server';
import type { TmdbMovieResult, TmdbTvResult } from '@/lib/types/tmdb';

type TitleItem = TmdbMovieResult | TmdbTvResult;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const trimmed = (q ?? '').trim();

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-white/10 bg-black px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/20">
            <Search className="size-5 text-brand" />
          </div>
          <h1 className="truncate text-xl font-bold text-white">
            {trimmed.length >= 2
              ? `Search results for \u201C${trimmed}\u201D`
              : 'Search'}
          </h1>
        </div>
      </header>

      {trimmed.length < 2 ? (
        <EmptyQueryPrompt />
      ) : (
        <Suspense fallback={<SearchSkeleton query={trimmed} />}>
          <SearchResults query={trimmed} />
        </Suspense>
      )}
    </main>
  );
}

async function SearchResults({ query }: { query: string }) {
  const [moviesOutcome, tvOutcome] = await Promise.all([
    searchMovies(query),
    searchTv(query),
  ]);

  const movies: TmdbMovieResult[] = moviesOutcome.ok
    ? moviesOutcome.data.results
    : [];
  const tv: TmdbTvResult[] = tvOutcome.ok ? tvOutcome.data.results : [];

  const combined: TitleItem[] = [...movies, ...tv];

  if (combined.length === 0) {
    return <NoResults query={query} />;
  }

  return (
    <div className="relative z-10 space-y-8">
      {movies.length > 0 && (
        <MovieRow
          title={`Movies (${movies.length})`}
          items={movies.slice(0, 18)}
        />
      )}
      {tv.length > 0 && (
        <MovieRow
          title={`TV Shows (${tv.length})`}
          items={tv.slice(0, 18)}
        />
      )}
    </div>
  );
}

/** Shown while the TMDB rows stream in — shimmering poster skeletons. */
function SearchSkeleton({ query }: { query: string }) {
  return (
    <div aria-busy>
      <SkeletonRow />
      <SkeletonRow />
      <p className="sr-only">Searching for &ldquo;{query}&rdquo;&hellip;</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <section className="mt-8">
      <div className="bg-skeleton mb-4 h-6 w-40 rounded" />
      <ul className="no-scrollbar flex gap-3 overflow-hidden px-4 py-2 sm:px-6">
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

function NoResults({ query }: { query: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center rounded-2xl border border-surface-hover bg-surface-raised p-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-rating-low/10">
          <SearchX className="size-8 text-rating-low" />
        </div>
        <p className="mt-5 text-lg font-semibold text-foreground">
          No movies or shows found for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Double-check the spelling, or try a shorter keyword &mdash; partial
          titles like &ldquo;dark&rdquo; or &ldquo;batman&rdquo; work best.
        </p>
      </div>
    </div>
  );
}

function EmptyQueryPrompt() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center rounded-2xl border border-surface-hover bg-surface-raised p-10 text-center">
        <div className="flex items-center gap-3">
          <Film className="size-6 text-muted" />
          <Tv className="size-6 text-muted" />
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">
          Search for movies or TV shows
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Use the search bar in the navbar to look up any title by name.
        </p>
      </div>
    </div>
  );
}
