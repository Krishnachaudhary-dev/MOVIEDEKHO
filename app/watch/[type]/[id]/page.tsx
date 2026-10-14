import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import VideoPlayer from "@/components/VideoPlayerFixed";
import TvEpisodeBrowser from "@/components/TvEpisodeBrowser";
import { getDetailsByType, getTvSeason } from "@/lib/tmdb-server";
import { getMovieSources } from "@/lib/sources";
import { getPosterUrl } from "@/lib/tmdb";
import type { TmdbMovieDetails, TmdbTvDetails } from "@/lib/types/tmdb";
import type { MovieStreamRecord, StreamsResponse } from "@/lib/types/sources";

/**
 * `/watch/[type]/[id]` — the player route.
 *
 * Movies stream straight from their title-level mirrors. TV titles resolve an
 * episode first: `?season=` and `?episode=` select it, and the episode-scoped
 * mirror wins over the series-level one when a source is registered for it.
 * Everything here is server-rendered, so a half-watched episode is a shareable
 * URL rather than client state.
 */

type RouteParams = Promise<{ type: string; id: string }>;
type RouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A query param can repeat; the first value is the one we act on. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A non-negative integer from a query param, or `undefined` when unusable. */
function toIndex(
  value: string | string[] | undefined,
  min = 0,
): number | undefined {
  const raw = firstValue(value);
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : undefined;
}

function normalizeTitle(
  details: TmdbMovieDetails | TmdbTvDetails | null,
  record: MovieStreamRecord,
) {
  if (details && "title" in details) return details.title;
  if (details && "name" in details) return details.name;
  return record.title;
}

export default function WatchPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearchParams;
}) {
  // Cache Components: the instant shell must not block on URL data, so params
  // resolution and both media branches stream in behind Suspense with the
  // shared route skeleton as the fallback.
  return (
    <Suspense fallback={<WatchSkeleton />}>
      <WatchBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WatchBody({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearchParams;
}) {
  const { type, id } = await params;
  const tmdbId = Number(id);

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    notFound();
  }

  const mediaType = type === "movie" ? ("movie" as const) : ("tv" as const);

  if (mediaType === "tv") {
    // The TV branch additionally awaits search params (?season= / ?episode=);
    // nested Suspense keeps movie renders free of that wait.
    return (
      <Suspense fallback={<WatchSkeleton />}>
        <TvWatch tmdbId={tmdbId} searchParams={searchParams} />
      </Suspense>
    );
  }

  const [detailsOutcome, streams] = await Promise.all([
    getDetailsByType("movie", tmdbId),
    getMovieSources(tmdbId, "movie"),
  ]);

  const details = detailsOutcome.ok
    ? (detailsOutcome.data as TmdbMovieDetails)
    : null;

  return (
    <WatchLayout
      title={normalizeTitle(details, streams.record)}
      posterSrc={getPosterUrl(details?.poster_path, "w780")}
      overview={details?.overview ?? null}
      streams={streams}
      playerKey={`movie-${tmdbId}`}
    />
  );
}

async function TvWatch({
  tmdbId,
  searchParams,
}: {
  tmdbId: number;
  searchParams: RouteSearchParams;
}) {
  const query = await searchParams;
  const requestedSeason = toIndex(query.season, 0);
  const requestedEpisode = toIndex(query.episode, 1);

  const detailsOutcome = await getDetailsByType("tv", tmdbId);
  const details = detailsOutcome.ok
    ? (detailsOutcome.data as TmdbTvDetails)
    : null;

  // TMDB lists specials as season 0, so "first season" means the first one
  // numbered 1 or higher — falling back to season 0 only for shows that have
  // nothing else.
  const seasons = [...(details?.seasons ?? [])].sort(
    (a, b) => a.season_number - b.season_number,
  );
  const activeSeason =
    seasons.find((season) => season.season_number === requestedSeason) ??
    seasons.find((season) => season.season_number >= 1) ??
    seasons[0];

  // An explicit `?season=` is honoured unless the show's season list proves it
  // wrong — a mistyped or stale season then lands on a real season instead of
  // an empty page. When TMDB has no season list at all the request stands, so a
  // bookmarked episode URL keeps working while TMDB is unavailable.
  const requestedSeasonExists =
    requestedSeason !== undefined &&
    (seasons.length === 0 ||
      seasons.some((season) => season.season_number === requestedSeason));
  const seasonNumber = requestedSeasonExists
    ? requestedSeason
    : activeSeason?.season_number;

  const seasonOutcome =
    seasonNumber !== undefined ? await getTvSeason(tmdbId, seasonNumber) : null;
  const episodes = seasonOutcome?.ok ? seasonOutcome.data.episodes : [];

  // The requested episode when this season has it; otherwise the next one that
  // exists (a season can be missing episodes TMDB still counts), otherwise the
  // first — never a dead player.
  const activeEpisode =
    episodes.find((episode) => episode.episode_number === requestedEpisode) ??
    episodes.find(
      (episode) => episode.episode_number >= (requestedEpisode ?? 1),
    ) ??
    episodes[0];

  const selection = activeEpisode
    ? {
        season: activeEpisode.season_number,
        episode: activeEpisode.episode_number,
      }
    : undefined;

  const streams = await getMovieSources(tmdbId, "tv", selection);

  const subtitle = activeEpisode
    ? `S${activeEpisode.season_number} E${activeEpisode.episode_number} · ${
        activeEpisode.name || `Episode ${activeEpisode.episode_number}`
      }`
    : activeSeason
      ? activeSeason.name
      : undefined;

  const emptyMessage = !details
    ? "Episode data is unavailable right now."
    : seasonOutcome && !seasonOutcome.ok
      ? seasonOutcome.error.configError
        ? "Add your TMDB key to .env.local, then restart the dev server."
        : `Couldn't load this season: ${seasonOutcome.error.message}`
      : undefined;

  return (
    <WatchLayout
      title={normalizeTitle(details, streams.record)}
      subtitle={subtitle}
      posterSrc={getPosterUrl(details?.poster_path, "w780")}
      overview={details?.overview ?? null}
      streams={streams}
      playerKey={`tv-${tmdbId}-${selection?.season ?? "s"}-${selection?.episode ?? "e"}`}
      scopeNote={
        selection && streams.sourceScope === "title"
          ? `No mirror is registered for S${selection.season} E${selection.episode} yet, so this is the server configured for the whole series. Add an episode-specific source in /admin to override it for this episode.`
          : null
      }
    >
      <TvEpisodeBrowser
        basePath={`/watch/tv/${tmdbId}`}
        seasons={seasons.map((season) => ({
          season_number: season.season_number,
          name: season.name,
          episode_count: season.episode_count,
        }))}
        episodes={episodes.map((episode) => ({
          episode_number: episode.episode_number,
          season_number: episode.season_number,
          name: episode.name,
          overview: episode.overview,
          air_date: episode.air_date,
          runtime: episode.runtime,
          vote_average: episode.vote_average,
          still_path: episode.still_path,
        }))}
        activeSeason={activeEpisode?.season_number ?? seasonNumber ?? null}
        activeEpisode={activeEpisode?.episode_number ?? null}
        emptyMessage={emptyMessage}
      />
    </WatchLayout>
  );
}

/** Shared chrome for both media types: title, player, extras, synopsis. */
function WatchLayout({
  title,
  subtitle,
  posterSrc,
  overview,
  streams,
  playerKey,
  scopeNote,
  children,
}: {
  title: string;
  subtitle?: string;
  posterSrc: string | null;
  overview: string | null;
  streams: StreamsResponse;
  /** Changing this remounts the player, so a new episode tears down the old HLS instance. */
  playerKey: string;
  scopeNote?: string | null;
  children?: React.ReactNode;
}) {
  const record = streams.record;

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <main className="flex-1">
        {/* Cinematic column — capped at max-w-6xl, centered, breathable on
            mobile and comfortable on desktop. The top padding clears the fixed
            navbar (64px + the mobile links row below `md`), which otherwise
            sat on top of the title. */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-24 sm:px-6 sm:pb-10 md:pt-20">
          <h1 className="text-2xl font-black leading-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted sm:text-base">{subtitle}</p>
          ) : null}

          <div className="mt-4 sm:mt-6">
            {record.sources.length > 0 ? (
              <VideoPlayer
                key={playerKey}
                title={title}
                sources={record.sources}
                autoplay={false}
              />
            ) : (
              <NoStreamsFallback title={title} posterSrc={posterSrc} />
            )}
          </div>

          {scopeNote ? (
            <p className="mt-3 rounded-lg border border-surface-hover bg-surface px-4 py-3 text-xs text-muted sm:text-sm">
              {scopeNote}
            </p>
          ) : null}

          {children}
        </div>
      </main>

      {overview ? (
        <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-muted sm:text-xl">
            Synopsis
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/80 sm:text-base">
            {overview}
          </p>
        </section>
      ) : null}

      <div className="px-4 pb-6 text-center text-xs text-muted sm:px-6">
        Streams are provided by third-party mirrors and may be unavailable.
      </div>
    </div>
  );
}

/** Shown while the TV branch resolves its season and episode. */
function WatchSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pb-6 pt-24 sm:px-6 sm:pb-10 md:pt-20"
      aria-busy
    >
      <div className="bg-skeleton h-9 w-72 max-w-full rounded" />
      <div className="bg-skeleton mt-4 aspect-video w-full rounded-lg" />
      <div className="bg-skeleton mt-8 h-6 w-32 rounded" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-skeleton h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function NoStreamsFallback({
  title,
  posterSrc,
}: {
  title: string;
  posterSrc: string | null;
}) {
  return (
    <div className="relative flex min-h-[70vh] w-full items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black via-black/80 to-black/20" />

      <div className="relative z-10 flex max-w-lg flex-col items-center gap-4 text-center">
        <div className="relative h-56 w-full max-w-md overflow-hidden rounded-xl bg-surface">
          {posterSrc ? (
            <Image
              src={posterSrc}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              <span>No poster</span>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="text-muted">No streams available for this title yet.</p>

        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-lg bg-brand px-6 py-2.5 font-bold text-white transition hover:bg-brand-hover"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    </div>
  );
}
