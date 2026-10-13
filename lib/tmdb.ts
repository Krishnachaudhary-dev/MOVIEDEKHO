/**
 * MovieDekho — TMDB API v3 client.
 *
 * Docs: https://developer.themoviedb.org/reference/introduction/getting-started
 *
 * Works in both server and client components. On the server we prefer the
 * secret `TMDB_API_KEY`; in the browser only the `NEXT_PUBLIC_`-prefixed key is
 * inlined by Next.js, so that is the fallback. See `.env.example`.
 */

import type {
  TmdbBackdropSize,
  TmdbCommonQueryOptions,
  TmdbCredits,
  TmdbDetails,
  TmdbDiscoverMovieOptions,
  TmdbDiscoverTvOptions,
  TmdbGenreListResponse,
  TmdbListItem,
  TmdbListResponse,
  TmdbMovieDetails,
  TmdbMovieResult,
  TmdbPosterSize,
  TmdbProfileSize,
  TmdbSearchOptions,
  TmdbStillSize,
  TmdbTimeWindow,
  TmdbTvDetails,
  TmdbTvResult,
  TmdbVideoList,
  TmdbWatchProviderResults,
} from "@/lib/types/tmdb";

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

export const TMDB_BASE_URL =
  process.env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_URL =
  process.env.TMDB_IMAGE_BASE_URL ?? "https://image.tmdb.org/t/p";
export const TMDB_DEFAULT_LANGUAGE = process.env.TMDB_LANGUAGE ?? "en-US";

/** HTTP timeout applied to every TMDB request. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** TMDB hard-caps pagination at page 500 (error code 22). */
const MAX_PAGE = 500;

/**
 * Prefer the server-only key so it never reaches the browser bundle. The
 * `NEXT_PUBLIC_` key is what makes client-side debounced search possible.
 *
 * Exported so the proxy route (`/api/tmdb/[...path]`) can attach the same
 * credentials to its hand-rolled fetch — that route builds URLs itself and
 * must not silently drop auth.
 */
export function resolveAuth():
  | { kind: "token"; value: string }
  | { kind: "key"; value: string }
  | null {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (token) return { kind: "token", value: token };

  const key = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (key) return { kind: "key", value: key };

  return null;
}

/** Thrown when neither a v3 API key nor a v4 read token is configured. */
export class TmdbConfigError extends Error {
  override name = "TmdbConfigError";
  constructor() {
    super(
      "TMDB credentials are missing. Set TMDB_API_KEY (server) or NEXT_PUBLIC_TMDB_API_KEY in .env.local — get a free key at https://www.themoviedb.org/settings/api",
    );
  }
}

/** Thrown for any non-2xx response from TMDB. */
export class TmdbError extends Error {
  override name = "TmdbError";
  constructor(
    /** HTTP status from TMDB (401, 404, 429, …). */
    readonly status: number,
    /** TMDB's own numeric `status_code` (7 = invalid key, 34 = not found, …). */
    readonly tmdbStatusCode: number | null,
    /** Human-readable message straight from TMDB. */
    readonly tmdbMessage: string,
    /** Which endpoint produced the error, e.g. `/movie/popular`. */
    readonly endpoint: string,
  ) {
    super(`TMDB ${endpoint} failed (${status}): ${tmdbMessage}`);
  }
}

/* ------------------------------------------------------------------ *
 * Core request
 * ------------------------------------------------------------------ */

/** Query params we drop before hitting the API. */
type QueryValue = string | number | boolean | undefined | null;

export interface TmdbRequestOptions {
  /** Extra query params. `undefined`/`null`/`""` entries are stripped. */
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

/**
 * Build a fully-qualified TMDB URL. Useful for `<link rel="preload">`,
 * debugging, or hand-rolling a request the wrapper doesn't expose yet.
 */
export function buildTmdbUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(
    path.startsWith("http") ? path : `${TMDB_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`,
  );

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url;
}

/** Normalise paging input: TMDB rejects page 0 and page > 500. */
function clampPage(page: QueryValue): number | undefined {
  if (page === undefined || page === null || page === "") return undefined;
  const parsed = typeof page === "number" ? page : Number(page);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_PAGE);
}

/**
 * A fetch timeout that does **not** trip Next 16's prerender guard.
 *
 * `AbortSignal.timeout()` reads `Date.now()` when it is created, and during
 * prerendering Next treats any `Date.now()` read as an unstable value and
 * fails the route ("Next.js encountered the unstable value `Date.now()`").
 * An `AbortController` scheduled through `setTimeout` has the same effect
 * without reading the clock synchronously.
 *
 * Without any timeout a hung TMDB request would block the whole route render.
 */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), ms);
  // Never hold the Node.js process open just for a request timeout.
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    timer.unref();
  }
  return controller.signal;
}

/**
 * One retry for network-level failures only.
 *
 * Windows machines with cold DNS caches intermittently fail the *first*
 * concurrent TLS connections to a new host ("fetch failed", status 0). This
 * is transient — a short backoff and one retry resolves it. HTTP errors
 * (401/404/429…) are NOT retried: those are real answers from TMDB.
 */
const NETWORK_RETRIES = 1;
const NETWORK_RETRY_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The single choke point for every TMDB call: attaches auth, applies the
 * language/page defaults, and normalises errors.
 *
 * Caching is deliberately NOT done here. With `cacheComponents` enabled, a
 * `next: { revalidate }` option on fetch makes Next read the clock during
 * prerendering, which trips the "unstable value `Date.now()`" guard on any
 * route with a static shell. All caching lives in `@/lib/tmdb-server`, which
 * wraps these functions with `use cache` + `cacheLife` — the framework's
 * supported way to cache under Cache Components.
 */
export async function tmdbFetch<T>(
  path: string,
  options: TmdbRequestOptions = {},
): Promise<T> {
  const auth = resolveAuth();
  if (!auth) throw new TmdbConfigError();

  const url = buildTmdbUrl(path, {
    language: TMDB_DEFAULT_LANGUAGE,
    ...options.query,
    page: clampPage(options.query?.page),
    ...(auth.kind === "key" ? { api_key: auth.value } : undefined),
  });

  let response: Response;
  try {
    // Network-level retries: status 0 means fetch itself failed (DNS, TLS,
    // timeout) — transient on cold machines. HTTP >= 400 is a real TMDB
    // answer and must NOT be retried.
    let lastNetworkError: unknown;
    response = null as unknown as Response;
    for (let attemptNo = 0; attemptNo <= NETWORK_RETRIES; attemptNo++) {
      if (attemptNo > 0) await sleep(NETWORK_RETRY_DELAY_MS);
      try {
        response = await fetch(url, {
          headers: {
            Accept: "application/json",
            ...(auth.kind === "token"
              ? { Authorization: `Bearer ${auth.value}` }
              : undefined),
          },
          signal: options.signal ?? timeoutSignal(DEFAULT_TIMEOUT_MS),
        });
        lastNetworkError = undefined;
        break;
      } catch (cause) {
        lastNetworkError = cause;
      }
    }
    if (lastNetworkError !== undefined) {
      const reason =
        lastNetworkError instanceof Error
          ? lastNetworkError.message
          : String(lastNetworkError);
      throw new TmdbError(0, null, `Network error: ${reason}`, url.pathname);
    }
  } catch (cause) {
    if (cause instanceof TmdbError) throw cause;
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new TmdbError(0, null, `Network error: ${reason}`, url.pathname);
  }

  if (!response.ok) {
    let message = response.statusText || "Unknown error";
    let tmdbCode: number | null = null;
    try {
      const body = (await response.json()) as {
        status_message?: string;
        status_code?: number;
      };
      if (body.status_message) message = body.status_message;
      if (typeof body.status_code === "number") tmdbCode = body.status_code;
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new TmdbError(response.status, tmdbCode, message, url.pathname);
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Trending
 * ------------------------------------------------------------------ */

/** `/trending/{media_type}/{time_window}` — results include `media_type`. */
export async function getTrending(
  mediaType: "all" | "movie" | "tv" = "all",
  timeWindow: TmdbTimeWindow = "day",
  page = 1,
  options: Omit<TmdbRequestOptions, "query"> = {},
): Promise<TmdbListResponse<TmdbListItem>> {
  return tmdbFetch(`/trending/${mediaType}/${timeWindow}`, {
    ...options,
    query: { page },
  });
}

/**
 * Trending, filtered to movies and TV only.
 *
 * `/trending/all` also returns `person` hits, which have no poster/backdrop
 * and would break the grid — this drops them and narrows the union type.
 */
export async function getTrendingTitles(
  timeWindow: TmdbTimeWindow = "day",
  page = 1,
  options: Omit<TmdbRequestOptions, "query"> = {},
): Promise<TmdbListResponse<TmdbMovieResult | TmdbTvResult>> {
  const data = await getTrending("all", timeWindow, page, options);
  return {
    ...data,
    results: data.results.filter(
      (item): item is TmdbMovieResult | TmdbTvResult =>
        item.media_type !== "person",
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Movie lists
 * ------------------------------------------------------------------ */

/** Common params for the movie list endpoints. */
function movieListQuery(options: TmdbCommonQueryOptions) {
  return {
    page: options.page,
    language: options.language,
    region: options.region,
    include_adult: options.includeAdult,
  };
}

export async function getPopularMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch("/movie/popular", { query: movieListQuery(options) });
}

export async function getTopRatedMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch("/movie/top_rated", { query: movieListQuery(options) });
}

export async function getNowPlayingMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch("/movie/now_playing", { query: movieListQuery(options) });
}

export async function getUpcomingMovies(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch("/movie/upcoming", { query: movieListQuery(options) });
}

export async function getMovieDetails(
  movieId: number,
  options: {
    language?: string;
    /** e.g. `"credits,videos,watch_providers"`. */
    appendToResponse?: string;
  } = {},
): Promise<TmdbMovieDetails> {
  return tmdbFetch(`/movie/${movieId}`, {
    query: {
      language: options.language,
      append_to_response: options.appendToResponse ?? "credits,videos",
    },
  });
}

export async function getMovieCredits(
  movieId: number,
  options: { language?: string } = {},
): Promise<TmdbCredits> {
  return tmdbFetch(`/movie/${movieId}/credits`, {
    query: { language: options.language },
  });
}

export async function getMovieVideos(
  movieId: number,
  options: { language?: string } = {},
): Promise<TmdbVideoList> {
  return tmdbFetch(`/movie/${movieId}/videos`, {
    query: { language: options.language },
  });
}

export async function getMovieWatchProviders(
  movieId: number,
): Promise<{ id: number; results: TmdbWatchProviderResults }> {
  return tmdbFetch(`/movie/${movieId}/watch/providers`);
}

export async function getMovieRecommendations(
  movieId: number,
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch(`/movie/${movieId}/recommendations`, {
    query: movieListQuery(options),
  });
}

export async function getSimilarMovies(
  movieId: number,
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch(`/movie/${movieId}/similar`, {
    query: movieListQuery(options),
  });
}

/* ------------------------------------------------------------------ *
 * TV lists
 * ------------------------------------------------------------------ */

export async function getPopularTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch("/tv/popular", { query: movieListQuery(options) });
}

export async function getTopRatedTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch("/tv/top_rated", { query: movieListQuery(options) });
}

export async function getAiringTodayTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch("/tv/airing_today", { query: movieListQuery(options) });
}

export async function getOnTheAirTv(
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch("/tv/on_the_air", { query: movieListQuery(options) });
}

export async function getTvDetails(
  tvId: number,
  options: {
    language?: string;
    appendToResponse?: string;
  } = {},
): Promise<TmdbTvDetails> {
  return tmdbFetch(`/tv/${tvId}`, {
    query: {
      language: options.language,
      append_to_response: options.appendToResponse ?? "credits,videos",
    },
  });
}

export async function getTvCredits(
  tvId: number,
  options: { language?: string } = {},
): Promise<TmdbCredits> {
  return tmdbFetch(`/tv/${tvId}/credits`, {
    query: { language: options.language },
  });
}

export async function getTvVideos(
  tvId: number,
  options: { language?: string } = {},
): Promise<TmdbVideoList> {
  return tmdbFetch(`/tv/${tvId}/videos`, {
    query: { language: options.language },
  });
}

export async function getTvWatchProviders(
  tvId: number,
): Promise<{ id: number; results: TmdbWatchProviderResults }> {
  return tmdbFetch(`/tv/${tvId}/watch/providers`);
}

export async function getTvRecommendations(
  tvId: number,
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch(`/tv/${tvId}/recommendations`, {
    query: movieListQuery(options),
  });
}

export async function getSimilarTv(
  tvId: number,
  options: TmdbCommonQueryOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch(`/tv/${tvId}/similar`, { query: movieListQuery(options) });
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

/** `media_type` narrows the `TmdbListItem` union. */
export interface TmdbMultiSearchResponse
  extends Omit<TmdbListResponse<TmdbListItem>, "results"> {
  results: TmdbListItem[];
}

/**
 * `/search/multi` — movies, TV and people in one pass. Results carry
 * `media_type`, so callers must branch on it before rendering.
 */
export async function searchMulti(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<TmdbMultiSearchResponse> {
  return tmdbFetch("/search/multi", {
    query: {
      query,
      page: options.page,
      language: options.language,
      region: options.region,
      year: options.year,
      include_adult: options.includeAdult ?? false,
    },
  });
}

export async function searchMovies(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch("/search/movie", {
    query: {
      query,
      page: options.page,
      language: options.language,
      region: options.region,
      primary_release_year:
        options.primaryReleaseYear ?? options.year,
      include_adult: options.includeAdult ?? false,
    },
  });
}

export async function searchTv(
  query: string,
  options: TmdbSearchOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch("/search/tv", {
    query: {
      query,
      page: options.page,
      language: options.language,
      first_air_date_year: options.year,
      include_adult: options.includeAdult ?? false,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Discover (genre / filter rows)
 * ------------------------------------------------------------------ */

export async function discoverMovies(
  options: TmdbDiscoverMovieOptions = {},
): Promise<TmdbListResponse<TmdbMovieResult>> {
  return tmdbFetch("/discover/movie", {
    query: {
      page: options.page,
      language: options.language,
      region: options.region,
      include_adult: options.includeAdult ?? false,
      with_genres: options.withGenres,
      sort_by: options.sortBy ?? "popularity.desc",
      "primary_release_date.gte": options.primaryReleaseDateGte,
      "primary_release_date.lte": options.primaryReleaseDateLte,
      primary_release_year: options.primaryReleaseYear,
      with_keywords: options.withKeywords,
      with_watch_providers: options.withWatchProviders,
      watch_region: options.watchRegion,
      "with_runtime.gte": options.withRuntimeGte,
      "with_runtime.lte": options.withRuntimeLte,
      "vote_count.gte": options.voteCountGte,
      "vote_average.gte": options.voteAverageGte,
      "vote_average.lte": options.voteAverageLte,
    },
  });
}

export async function discoverTv(
  options: TmdbDiscoverTvOptions = {},
): Promise<TmdbListResponse<TmdbTvResult>> {
  return tmdbFetch("/discover/tv", {
    query: {
      page: options.page,
      language: options.language,
      include_adult: options.includeAdult ?? false,
      with_genres: options.withGenres,
      sort_by: options.sortBy ?? "popularity.desc",
      "first_air_date.gte": options.firstAirDateGte,
      "first_air_date.lte": options.firstAirDateLte,
      first_air_date_year: options.firstAirDateYear,
      with_keywords: options.withKeywords,
      with_networks: options.withNetworks,
      with_watch_providers: options.withWatchProviders,
      watch_region: options.watchRegion,
      "vote_count.gte": options.voteCountGte,
      "vote_average.gte": options.voteAverageGte,
      "vote_average.lte": options.voteAverageLte,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Genres
 * ------------------------------------------------------------------ */

export async function getGenres(
  mediaType: "movie" | "tv" = "movie",
  options: { language?: string } = {},
): Promise<TmdbGenreListResponse> {
  return tmdbFetch(`/genre/${mediaType}/list`, {
    query: { language: options.language },
  });
}

/* ------------------------------------------------------------------ *
 * Details by media type (handy for `/watch/[id]` and `/title/[type]/[id]`)
 * ------------------------------------------------------------------ */

/**
 * Fetch details for either media type. TMDB IDs are namespaced per media
 * type, so `movie/603` and `tv/603` are different titles — always pass the
 * type alongside the ID.
 */
export async function getDetailsByType(
  mediaType: "movie" | "tv",
  id: number,
  options: { language?: string; appendToResponse?: string } = {},
): Promise<TmdbDetails> {
  return mediaType === "movie"
    ? getMovieDetails(id, options)
    : getTvDetails(id, options);
}

/** Total matches TMDB reports for a list/search response. */
export function getTotal(response: { total_results: number }): number {
  return response.total_results;
}

/* ------------------------------------------------------------------ *
 * Image + trailer URL helpers
 * ------------------------------------------------------------------ */

/**
 * Build a TMDB image URL. Returns `null` when the path is missing so callers
 * can fall back to a placeholder instead of requesting `/t/p/w500null`.
 */
export function tmdbImage(
  path: string | null | undefined,
  size: TmdbPosterSize | TmdbBackdropSize | TmdbProfileSize | TmdbStillSize,
): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path.startsWith("/") ? "" : "/"}${path}`;
}

export const getPosterUrl = (
  path: string | null | undefined,
  size: TmdbPosterSize = "w500",
) => tmdbImage(path, size);

export const getBackdropUrl = (
  path: string | null | undefined,
  size: TmdbBackdropSize = "w1280",
) => tmdbImage(path, size);

export const getProfileUrl = (
  path: string | null | undefined,
  size: TmdbProfileSize = "w185",
) => tmdbImage(path, size);

export const getStillUrl = (
  path: string | null | undefined,
  size: TmdbStillSize = "w185",
) => tmdbImage(path, size);

/** `https://img.youtube.com/vi/{key}/hqdefault.jpg` */
export function getYouTubeThumbUrl(key: string, variant: "default" | "maxres" = "default") {
  return variant === "maxres"
    ? `https://img.youtube.com/vi/${key}/maxresdefault.jpg`
    : `https://img.youtube.com/vi/${key}/hqdefault.jpg`;
}

/** YouTube *embed* URL — safe inside an `<iframe>`. */
export function getYouTubeEmbedUrl(key: string, autoplay = false) {
  return `https://www.youtube-nocookie.com/embed/${key}?rel=0&modestbranding=1${
    autoplay ? "&autoplay=1&mute=1" : ""
  }`;
}

/** YouTube *watch* URL — for the "Watch trailer" external link. */
export function getYouTubeWatchUrl(key: string) {
  return `https://www.youtube.com/watch?v=${key}`;
}

/**
 * Pick the best trailer/teaser from a `videos` response.
 *
 * TMDB order is arbitrary, so this scores YouTube embeds above Vimeo, official
 * "Trailer" above teasers/clip/behind-the-scenes, and English above other
 * languages. Returns `null` when there is nothing embeddable.
 */
export function pickBestTrailer(
  videos: TmdbVideoList | undefined | null,
): TmdbVideoList["results"][number] | null {
  const candidates = videos?.results ?? [];
  if (candidates.length === 0) return null;

  const score = (video: (typeof candidates)[number]) => {
    let value = 0;
    if (video.site === "YouTube") value += 100;
    if (video.type === "Trailer") value += 30;
    if (video.type === "Teaser") value += 20;
    if (video.official) value += 10;
    if (video.iso_639_1 === "en") value += 5;
    return value;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/* ------------------------------------------------------------------ *
 * Normalising helpers — movies and TV have different field names
 * ------------------------------------------------------------------ */

/** `title` for movies, `name` for TV. */
export function getTitle(item: TmdbMovieResult | TmdbTvResult): string {
  return "title" in item ? item.title : item.name;
}

/** `release_date` for movies, `first_air_date` for TV. */
export function getReleaseDate(item: TmdbMovieResult | TmdbTvResult): string {
  return "release_date" in item ? item.release_date : item.first_air_date;
}

/** Four-digit release year, or `""` when TMDB has no date yet. */
export function getYear(item: TmdbMovieResult | TmdbTvResult): string {
  const date = getReleaseDate(item);
  return date ? date.slice(0, 4) : "";
}

/** `"movie"` for movies, `"tv"` for TV. */
export function getMediaType(
  item: TmdbMovieResult | TmdbTvResult,
): "movie" | "tv" {
  return "title" in item ? "movie" : "tv";
}

/** `/title/movie/603` — the canonical route for a title in MovieDekho. */
export function getTitlePath(item: TmdbMovieResult | TmdbTvResult): string {
  return `/title/${getMediaType(item)}/${item.id}`;
}

/** `/watch/movie/603` — the player route. */
export function getWatchPath(item: TmdbMovieResult | TmdbTvResult): string {
  return `/watch/${getMediaType(item)}/${item.id}`;
}
