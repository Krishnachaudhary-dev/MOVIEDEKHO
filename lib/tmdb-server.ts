/**
 * Server-only cached data layer over the TMDB client (`@/lib/tmdb`).
 *
 * Why this exists: MovieDekho enables `cacheComponents` (Next 16). With it,
 * a `next: { revalidate }` option on raw `fetch` makes Next read the clock
 * during prerendering, which the "unstable value `Date.now()`" guard rejects
 * on routes with a static shell. The supported pattern is the `use cache`
 * directive with `cacheLife` lifetimes — which is what every function here
 * wraps around its raw counterpart in `@/lib/tmdb`.
 *
 * Error contract (important): under Cache Components these cached entries are
 * *filled during `next build`* (their lifetimes exceed the prerender-safe
 * threshold). A raw throw would abort the whole export — for example building
 * before a TMDB key exists — so every loader here catches its own errors and
 * returns a serializable `TmdbOutcome` instead. A failed fill renders as an
 * error card and re-validates after its normal lifetime.
 *
 * Each function's arguments (page, ids, query…) join its cache key, so page 1
 * and page 2 keep separate entries.
 */

import { cacheLife } from "next/cache";

import {
  discoverMovies as discoverMoviesRaw,
  discoverTv as discoverTvRaw,
  getAiringTodayTv as getAiringTodayTvRaw,
  getGenres as getGenresRaw,
  getMovieDetails as getMovieDetailsRaw,
  getNowPlayingMovies as getNowPlayingMoviesRaw,
  getOnTheAirTv as getOnTheAirTvRaw,
  getPopularMovies as getPopularMoviesRaw,
  getPopularTv as getPopularTvRaw,
  getTopRatedMovies as getTopRatedMoviesRaw,
  getTopRatedTv as getTopRatedTvRaw,
  getTvDetails as getTvDetailsRaw,
  getTrendingTitles as getTrendingTitlesRaw,
  getUpcomingMovies as getUpcomingMoviesRaw,
  searchMulti as searchMultiRaw,
  searchMovies as searchMoviesRaw,
  searchTv as searchTvRaw,
  TmdbConfigError,
} from "@/lib/tmdb";
import type {
  TmdbCommonQueryOptions,
  TmdbDetails,
  TmdbDiscoverMovieOptions,
  TmdbDiscoverTvOptions,
  TmdbGenreListResponse,
  TmdbListItem,
  TmdbListResponse,
  TmdbMovieDetails,
  TmdbMovieResult,
  TmdbSearchOptions,
  TmdbTimeWindow,
  TmdbTvDetails,
  TmdbTvResult,
} from "@/lib/types/tmdb";

/* ------------------------------------------------------------------ *
 * Outcome contract — the cached functions' error story
 * ------------------------------------------------------------------ */

/** Serializable replacement for `Error` (cache entries must be serializable). */
export interface TmdbOutcomeError {
  message: string;
  /** True when the failure is "no TMDB key configured" (not transient). */
  configError: boolean;
}

export type TmdbOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: TmdbOutcomeError };

function toOutcomeError(error: unknown): TmdbOutcomeError {
  if (error instanceof TmdbConfigError) {
    return { message: error.message, configError: true };
  }
  return {
    message: error instanceof Error ? error.message : String(error),
    configError: false,
  };
}

/** Wrap a raw loader so it reports failures as data instead of throwing. */
async function attempt<T>(load: () => Promise<T>): Promise<TmdbOutcome<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    return { ok: false, error: toOutcomeError(error) };
  }
}

type MovieList = TmdbListResponse<TmdbMovieResult>;
type TvList = TmdbListResponse<TmdbTvResult>;
type TitlesList = TmdbListResponse<TmdbMovieResult | TmdbTvResult>;

/* ------------------------------------------------------------------ *
 * Homepage rows
 * ------------------------------------------------------------------ */

/** Trending movies + TV — hero banner source and first row. */
export async function getTrendingTitles(
  timeWindow: TmdbTimeWindow = "day",
  page = 1,
): Promise<TmdbOutcome<TitlesList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getTrendingTitlesRaw(timeWindow, page));
}

export async function getPopularMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<MovieList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getPopularMoviesRaw(options));
}

export async function getTopRatedMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<MovieList>> {
  "use cache";
  cacheLife("hours");
  return attempt(() => getTopRatedMoviesRaw(options));
}

export async function getNowPlayingMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<MovieList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getNowPlayingMoviesRaw(options));
}

export async function getUpcomingMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<MovieList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getUpcomingMoviesRaw(options));
}

export async function getPopularTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<TvList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getPopularTvRaw(options));
}

export async function getTopRatedTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<TvList>> {
  "use cache";
  cacheLife("hours");
  return attempt(() => getTopRatedTvRaw(options));
}

export async function getAiringTodayTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<TvList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getAiringTodayTvRaw(options));
}

export async function getOnTheAirTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbOutcome<TvList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => getOnTheAirTvRaw(options));
}

/* ------------------------------------------------------------------ *
 * Title pages (/title/movie/[id] · /title/tv/[id] · /watch/[type]/[id])
 * ------------------------------------------------------------------ */

export async function getMovieDetails(
  movieId: number,
): Promise<TmdbOutcome<TmdbMovieDetails>> {
  "use cache";
  cacheLife("hours");
  return attempt(() => getMovieDetailsRaw(movieId));
}

export async function getTvDetails(
  tvId: number,
): Promise<TmdbOutcome<TmdbTvDetails>> {
  "use cache";
  cacheLife("hours");
  return attempt(() => getTvDetailsRaw(tvId));
}

/** Details for either media type — handy for shared components. */
export async function getDetailsByType(
  mediaType: "movie" | "tv",
  id: number,
): Promise<TmdbOutcome<TmdbDetails>> {
  return mediaType === "movie" ? getMovieDetails(id) : getTvDetails(id);
}

/* ------------------------------------------------------------------ *
 * Search (server path — used when NEXT_PUBLIC_TMDB_API_KEY is unset)
 * ------------------------------------------------------------------ */

export async function searchMulti(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<TmdbOutcome<TmdbListResponse<TmdbListItem>>> {
  "use cache";
  cacheLife("seconds");
  return attempt(() => searchMultiRaw(query, options));
}

export async function searchMovies(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<TmdbOutcome<MovieList>> {
  "use cache";
  cacheLife("seconds");
  return attempt(() => searchMoviesRaw(query, options));
}

export async function searchTv(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<TmdbOutcome<TvList>> {
  "use cache";
  cacheLife("seconds");
  return attempt(() => searchTvRaw(query, options));
}

/** Split a multi-search response into movies and TV for filter pills.
 *
 * Narrowing is by field presence: `title` is movie-only; person results are
 * dropped. (`name` alone can't discriminate TV from people.)
 */
export function splitMultiSearch(
  results: TmdbListItem[],
): { movies: TmdbMovieResult[]; tv: TmdbTvResult[] } {
  const movies: TmdbMovieResult[] = [];
  const tv: TmdbTvResult[] = [];
  for (const item of results) {
    if ("title" in item) {
      movies.push(item);
    } else if ("first_air_date" in item) {
      tv.push(item);
    }
  }
  return { movies, tv };
}

export async function searchAll(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<
  TmdbOutcome<{ movies: TmdbMovieResult[]; tv: TmdbTvResult[] }>
> {
  const outcome = await searchMulti(query, options);
  if (!outcome.ok) return outcome;
  return {
    ok: true,
    data: splitMultiSearch(outcome.data.results),
  };
}

/* ------------------------------------------------------------------ *
 * Genre rows & filters
 * ------------------------------------------------------------------ */

export async function discoverMovies(
  options: TmdbDiscoverMovieOptions = {},
): Promise<TmdbOutcome<MovieList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => discoverMoviesRaw(options));
}

export async function discoverTv(
  options: TmdbDiscoverTvOptions = {},
): Promise<TmdbOutcome<TvList>> {
  "use cache";
  cacheLife("minutes");
  return attempt(() => discoverTvRaw(options));
}

export async function getGenres(
  mediaType: "movie" | "tv" = "movie",
): Promise<TmdbOutcome<TmdbGenreListResponse>> {
  "use cache";
  cacheLife("days");
  return attempt(() => getGenresRaw(mediaType));
}
