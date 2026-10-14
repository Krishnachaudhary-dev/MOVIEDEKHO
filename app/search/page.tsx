import { Suspense } from 'react';

import MovieCard from '@/components/MovieCard';
import MovieRow from '@/components/MovieRow';
import { searchMovies, searchTv } from '@/lib/tmdb-server';
import { getTitle, getMediaType, getYear, getPosterUrl } from '@/lib/tmdb';
import type { TmdbMovieResult, TmdbTvResult } from '@/lib/types/tmdb';
import { Film, Tv, Search } from 'lucide-react';

type TitleItem = TmdbMovieResult | TmdbTvResult;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  if (!q || q.trim().length < 2) {
    return (
      <main className="min-h-screen pb-16">
        <Suspense fallback={<SearchFallback query="" />}>
          <EmptyQueryPrompt />
        </Suspense>
      </main>
    );
  }

  const trimmed = q.trim();

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-white/10 bg-black px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand/20">
            <Search className="size-5 text-brand" />
          </div>
          <h1 className="text-xl font-bold text-white">
            Search results for &ldquo;{trimmed}&rdquo;
          </h1>
        </div>
      </header>

      <Suspense fallback={<SearchFallback query={trimmed} />}>
        <SearchResults query={trimmed} />
      </Suspense>
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
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-surface-hover bg-surface-raised p-6 text-center">
          <p className="text-sm text-muted">
            No results for &ldquo;{query}&rdquo;.
          </p>
          <p className="mt-2 text-xs text-faint">
            Try a different title or check the spelling.
          </p>
        </div>
      </div>
    );
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

function EmptyQueryPrompt() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-surface-hover bg-surface-raised p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-muted">
          <Search className="size-5" />
          <p className="text-sm">Search for movies or TV shows.</p>
        </div>
        <p className="mt-2 text-xs text-faint">
          Use the search bar in the navbar to start.
        </p>
      </div>
    </div>
  );
}

function SearchFallback({ query }: { query: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-surface-hover bg-surface-raised p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-surface">
            <Film className="size-5 text-muted" />
          </div>
          <div className="flex gap-3">
            <Film className="size-5 text-muted" />
            <Tv className="size-5 text-muted" />
          </div>
        </div>
        <p className="text-sm text-muted">
          Searching for &ldquo;{query}&rdquo;&hellip;
        </p>
      </div>
    </div>
  );
}
