/**
 * TMDB API v3 response types.
 *
 * Docs: https://developer.themoviedb.org/reference/introduction/getting-started
 *
 * Gotchas baked into these types:
 * - List/search items use `genre_ids: number[]`, details use `genres: TmdbGenre[]`.
 * - TV uses `name` / `first_air_date`; movies use `title` / `release_date`.
 * - Trending (`/trending/all`) and multi-search return `media_type` and can
 *   include `person` results, which have no `poster_path`/`backdrop_path`.
 */

export type TmdbMediaType = "movie" | "tv" | "person";
export type TmdbTimeWindow = "day" | "week";

/** Shape of TMDB's error body: `{ status_code, status_message, success }`. */
export interface TmdbErrorBody {
  status_code: number;
  status_message: string;
  success: false;
}

/** Every paginated TMDB endpoint returns this envelope. */
export interface TmdbListResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

/* ------------------------------------------------------------------ *
 * List / search result items (the "slim" shapes)
 * ------------------------------------------------------------------ */

export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  /** 0–10, one decimal. `0` when there are not enough votes yet. */
  vote_average: number;
  vote_count: number;
  popularity: number;
  /** `"YYYY-MM-DD"`, may be `""` for unreleased titles. */
  release_date: string;
  genre_ids: number[];
  original_language: string;
  adult: boolean;
  video?: boolean;
  media_type?: TmdbMediaType;
}

export interface TmdbTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  first_air_date: string;
  genre_ids: number[];
  original_language: string;
  origin_country?: string[];
  media_type?: TmdbMediaType;
}

export interface TmdbPersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  known_for_department?: string;
  known_for: (TmdbMovieResult | TmdbTvResult)[];
  adult: boolean;
  media_type?: TmdbMediaType;
}

/** Union of everything `/trending/all` and `/search/multi` can return. */
export type TmdbListItem = TmdbMovieResult | TmdbTvResult | TmdbPersonResult;

/* ------------------------------------------------------------------ *
 * Details (the "full" shapes)
 * ------------------------------------------------------------------ */

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TmdbProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TmdbSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface TmdbCollection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title: string;
  tagline: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  status: string;
  release_date: string;
  runtime: number | null;
  budget: number;
  revenue: number;
  homepage: string | null;
  imdb_id: string | null;
  original_language: string;
  adult: boolean;
  video: boolean;
  genres: TmdbGenre[];
  genre_ids?: number[];
  production_companies: TmdbProductionCompany[];
  production_countries: TmdbProductionCountry[];
  spoken_languages: TmdbSpokenLanguage[];
  belongs_to_collection: TmdbCollection | null;
  /** Populated when using `append_to_response=credits`. */
  credits?: TmdbCredits;
  /** Populated when using `append_to_response=videos`. */
  videos?: TmdbVideoList;
  /** Populated when using `append_to_response=watch_providers`. */
  watch_providers?: TmdbWatchProviderResults;
}

export interface TmdbSeason {
  air_date: string | null;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

/**
 * One episode, from `/tv/{id}/season/{n}`.
 *
 * Note `still_path` (a 16:9 frame of the episode) rather than `poster_path`
 * (the 2:3 artwork a season or show carries).
 */
export interface TmdbEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  /** `"YYYY-MM-DD"`, may be `""` or null for an unaired episode. */
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  production_code: string;
  /** `"standard"`, `"finale"`, `"mid_season"` … when TMDB reports one. */
  episode_type?: string;
}

/** `/tv/{id}/season/{n}` — the season plus its episode list. */
export interface TmdbSeasonDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  season_number: number;
  episodes: TmdbEpisode[];
}

export interface TmdbCreator {
  id: number;
  credit_id: string;
  name: string;
  gender: number;
  profile_path: string | null;
}

export interface TmdbNetwork {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name: string;
  tagline: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  status: string;
  first_air_date: string;
  last_air_date: string | null;
  episode_run_time: number[];
  homepage: string | null;
  in_production: boolean;
  languages: string[];
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  type: string;
  genres: TmdbGenre[];
  genre_ids?: number[];
  production_companies: TmdbProductionCompany[];
  production_countries: TmdbProductionCountry[];
  spoken_languages: TmdbSpokenLanguage[];
  networks: TmdbNetwork[];
  seasons: TmdbSeason[];
  created_by: TmdbCreator[];
  /** Populated when using `append_to_response=credits`. */
  credits?: TmdbCredits;
  /** Populated when using `append_to_response=videos`. */
  videos?: TmdbVideoList;
  /** Populated when using `append_to_response=watch_providers`. */
  watch_providers?: TmdbWatchProviderResults;
}

/** Union of the two detail shapes. */
export type TmdbDetails = TmdbMovieDetails | TmdbTvDetails;

/* ------------------------------------------------------------------ *
 * Credits
 * ------------------------------------------------------------------ */

export interface TmdbCastMember {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  character: string;
  credit_id: string;
  gender: number;
  order: number;
  adult: boolean;
  popularity?: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  job: string;
  department: string;
  credit_id: string;
  gender: number;
  adult: boolean;
}

export interface TmdbCredits {
  id: number;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

/* ------------------------------------------------------------------ *
 * Videos (trailers / teasers)
 * ------------------------------------------------------------------ */

export type TmdbVideoSite = "YouTube" | "Vimeo";

export interface TmdbVideo {
  iso_639_1: string;
  iso_3166_1: string;
  key: string;
  name: string;
  site: TmdbVideoSite;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
  id: string;
}

export interface TmdbVideoList {
  id: number;
  results: TmdbVideo[];
}

/* ------------------------------------------------------------------ *
 * User reviews (/movie/{id}/reviews, /tv/{id}/reviews)
 * ------------------------------------------------------------------ */

export interface TmdbReview {
  /** TMDB review id (a slug-ish string, not numeric). */
  id: string;
  author: string;
  author_details: {
    name: string | null;
    username: string;
    avatar_path: string | null;
    /** 0–10 on TMDB's scale, or null when the reviewer gave no score. */
    rating: number | null;
  };
  content: string;
  /** ISO timestamp. */
  created_at: string;
  /** Full review page on themoviedb.org. */
  url: string;
}

export interface TmdbReviewListResponse {
  id: number;
  page: number;
  results: TmdbReview[];
  total_pages: number;
  total_results: number;
}

/* ------------------------------------------------------------------ *
 * Watch / streaming providers (useful for the "where to watch" row)
 * ------------------------------------------------------------------ */

export interface TmdbWatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TmdbWatchProviderOffer {
  link: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
}

/** Keyed by ISO-3166-1 country code, e.g. `"IN"`, `"US"`. */
export type TmdbWatchProviderResults = Record<string, TmdbWatchProviderOffer>;

/* ------------------------------------------------------------------ *
 * Genres
 * ------------------------------------------------------------------ */

export interface TmdbGenreListResponse {
  id: number;
  genres: TmdbGenre[];
}

/* ------------------------------------------------------------------ *
 * Discover / query params accepted by the wrapper
 * ------------------------------------------------------------------ */

export interface TmdbCommonQueryOptions {
  page?: number;
  /** e.g. `"en-US"`, `"hi-IN"`. Defaults to `TMDB_LANGUAGE`. */
  language?: string;
  /** ISO-3166-1, e.g. `"IN"`. Only sent when provided — not every endpoint accepts it. */
  region?: string;
  includeAdult?: boolean;
}

export interface TmdbDiscoverMovieOptions extends TmdbCommonQueryOptions {
  /** Comma = AND, pipe = OR. e.g. `"28,12"` or `"28|12"`. */
  withGenres?: string;
  /** e.g. `"popularity.desc"`, `"vote_average.desc"`, `"primary_release_date.desc"`. */
  sortBy?: string;
  /** Inclusive. e.g. `"2015-01-01"`. */
  primaryReleaseDateGte?: string;
  primaryReleaseDateLte?: string;
  primaryReleaseYear?: number;
  withKeywords?: string;
  withWatchProviders?: string;
  /** `"US"`, `"IN"`, … */
  watchRegion?: string;
  withRuntimeGte?: number;
  withRuntimeLte?: number;
  voteCountGte?: number;
  voteAverageGte?: number;
  voteAverageLte?: number;
}

export interface TmdbDiscoverTvOptions extends TmdbCommonQueryOptions {
  withGenres?: string;
  sortBy?: string;
  firstAirDateGte?: string;
  firstAirDateLte?: string;
  firstAirDateYear?: number;
  withKeywords?: string;
  withNetworks?: string;
  withWatchProviders?: string;
  watchRegion?: string;
  voteCountGte?: number;
  voteAverageGte?: number;
  voteAverageLte?: number;
}

export interface TmdbSearchOptions extends TmdbCommonQueryOptions {
  year?: number;
  /** Only on `/search/movie`. */
  primaryReleaseYear?: number;
}

/* ------------------------------------------------------------------ *
 * Image size unions (valid values from /configuration)
 * ------------------------------------------------------------------ */

export type TmdbBackdropSize = "w300" | "w780" | "w1280" | "original";
export type TmdbPosterSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "original";
export type TmdbProfileSize = "w45" | "w185" | "h632" | "original";
export type TmdbStillSize = "w92" | "w185" | "w300" | "original";
export type TmdbLogoSize = "w45" | "w92" | "w154" | "w300" | "original";
