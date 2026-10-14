import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import CastCarousel from "@/components/CastCarousel";
import ReviewsSection from "@/components/title/ReviewsSection";
import TitleActions from "@/components/title/TitleActions";
import TitleGrid from "@/components/TitleGrid";
import {
  getBackdropUrl,
  getPosterUrl,
  getWatchPathFor,
  getYouTubeEmbedUrl,
  pickBestTrailer,
} from "@/lib/tmdb";
import { getDetailsByType, getMoreLikeThis, getTitleReviews } from "@/lib/tmdb-server";
import type { TmdbDetails, TmdbMovieDetails, TmdbTvDetails } from "@/lib/types/tmdb";

/**
 * `/title/[type]/[id]` — the detail page (spec section 2).
 *
 * Server-rendered from cached TMDB loaders: one details request appends
 * credits + videos, then reviews and recommendations load alongside it.
 * Unknown media types and unresolvable ids 404; a TMDB outage renders the
 * error card instead of aborting the route.
 */

type RouteParams = Promise<{ type: string; id: string }>;

/** Movies only — built from `production_companies` + crew jobs. */
function money(value: number): string {
  if (!value) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  return `$${value.toLocaleString("en-US")}`;
}

function crewByJob(details: TmdbMovieDetails): {
  directors: string[];
  writers: string[];
} {
  const crew = details.credits?.crew ?? [];
  const directorSet = new Set<string>();
  const writerSet = new Set<string>();
  for (const member of crew) {
    if (member.job === "Director") directorSet.add(member.name);
    if (["Screenplay", "Writer", "Story"].includes(member.job)) writerSet.add(member.name);
  }
  return {
    directors: [...directorSet].slice(0, 3),
    writers: [...writerSet].slice(0, 3),
  };
}

function tvCreatedByList(details: TmdbTvDetails): string {
  return details.created_by.map((creator) => creator.name).join(", ");
}

function statusAndRuntime(details: TmdbDetails): { status: string; runtimeLine: string } {
  if ("runtime" in details) {
    const runtime = details.runtime;
    const runtimeLine = runtime
      ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
      : details.status;
    return { status: details.status, runtimeLine };
  }
  const seasons = [...details.seasons].filter((season) => season.season_number >= 1);
  const episodeCount = seasons.reduce((sum, season) => sum + season.episode_count, 0);
  const episodes = details.episode_run_time[0];
  const runtimeLine = episodes
    ? `${details.number_of_seasons} season${details.number_of_seasons === 1 ? "" : "s"} · ${episodeCount} ep · ${episodes}m`
    : `${details.number_of_seasons} season${details.number_of_seasons === 1 ? "" : "s"}`;
  return { status: details.status, runtimeLine };
}

/** Metadata table rows for either media type. */
function metadataRows(details: TmdbDetails): { label: string; value: string }[] {
  const { status, runtimeLine } = statusAndRuntime(details);

  if ("budget" in details) {
    const { directors, writers } = crewByJob(details);
    const rows = [
      { label: "Director", value: directors.join(", ") || "—" },
      { label: "Writer", value: writers.join(", ") || "—" },
    ];
    if (details.budget) {
      rows.push({ label: "Budget", value: `$${money(details.budget)}` });
    }
    if (details.revenue) {
      rows.push({ label: "Revenue", value: `$${money(details.revenue)}` });
    }
    rows.push(
      { label: "Status", value: status },
      {
        label: "Production",
        value:
          details.production_companies
            .map((company) => company.name)
            .slice(0, 4)
            .join(", ") || "—",
      },
    );
    return rows;
  }

  // TV branch.
  const tvDetails = details as TmdbTvDetails;
  const networks =
    tvDetails.networks.map((network) => network.name).slice(0, 3).join(", ") || "—";
  const created = tvCreatedByList(tvDetails) || "—";
  return [
    { label: "Created by", value: created },
    { label: "Network", value: networks },
    { label: "Runtime", value: runtimeLine },
    { label: "Status", value: status },
    {
      label: "Production",
      value:
        tvDetails.production_companies
          .map((company) => company.name)
          .slice(0, 4)
          .join(", ") || "—",
    },
  ];
}

/**
 * Cache Components requires URL data (`params`) reads to sit behind Suspense
 * so the instant shell never blocks on them. The shell is the fallback; the
 * body streams in once the params resolve.
 */
async function TitleBody({ type, id }: { type: string; id: string }) {
  const tmdbId = Number(id);
  const mediaType = type === "movie" ? ("movie" as const) : type === "tv" ? ("tv" as const) : null;

  if (!mediaType || !Number.isFinite(tmdbId) || tmdbId <= 0) {
    notFound();
  }

  const detailsOutcome = await getDetailsByType(mediaType, tmdbId);
  if (!detailsOutcome.ok) {
    if (/\(404\)/.test(detailsOutcome.error.message)) {
      notFound();
    }
    return <TitleError message={detailsOutcome.error.message} />;
  }

  const details = detailsOutcome.data;
  const [reviewsOutcome, recommendationsOutcome] = await Promise.all([
    getTitleReviews(mediaType, tmdbId),
    getMoreLikeThis(mediaType, tmdbId),
  ]);

  const isMovie = "title" in details;
  const name = isMovie ? (details as TmdbMovieDetails).title : (details as TmdbTvDetails).name;
  const tagline = details.tagline || null;
  const backdrop = getBackdropUrl(details.backdrop_path, "w1280");
  const poster = getPosterUrl(details.poster_path, "w500");
  const releaseDate = isMovie
    ? (details as TmdbMovieDetails).release_date
    : (details as TmdbTvDetails).first_air_date;
  const year = releaseDate ? releaseDate.slice(0, 4) : null;
  // "98% Match" — TMDB's 0–10 vote average on the Netflix percentage scale.
  const matchScore = Math.round(details.vote_average * 10);
  const runtimeLine = statusAndRuntime(details).runtimeLine;
  const trailer = pickBestTrailer(details.videos);
  const cast = (details.credits?.cast ?? []).slice(0, 12);
  const rows = metadataRows(details);
  const recommendations = recommendationsOutcome.ok ? recommendationsOutcome.data : [];

  const leanReviews = (reviewsOutcome.ok ? reviewsOutcome.data : []).map((review) => ({
    id: review.id,
    author: review.author || review.author_details.username,
    username: review.author_details.username,
    avatarPath: review.author_details.avatar_path
      ? review.author_details.avatar_path.startsWith("http")
        ? review.author_details.avatar_path.replace(/^http:/, "https:")
        : `https://image.tmdb.org/t/p/w185${review.author_details.avatar_path}`
      : null,
    rating: review.author_details.rating,
    content: review.content,
    createdAt: review.created_at,
    url: review.url,
  }));

  return (
    <main className="min-h-screen pb-16">
      {/* ── Cinematic header: full-bleed backdrop with vignette ─────────── */}
      <section className="relative">
        <div className="absolute inset-0">
          {backdrop ? (
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="h-full w-full bg-surface" />
          )}
          {/* Legibility vignette, Netflix-style */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
          <div className="scrim-right absolute inset-0" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-10 pt-32 sm:px-6 md:pt-40">
          <div className="flex flex-col gap-6 md:flex-row md:items-end">
            {/* Poster card */}
            {poster ? (
              <div className="relative hidden w-44 shrink-0 overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-white/15 lg:block">
                <Image src={poster} alt={name} width={342} height={513} className="w-full" />
              </div>
            ) : null}

            <div className="min-w-0 max-w-2xl">
              {year || (isMovie ? "Movie" : "Series") ? (
                <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted">
                  {isMovie ? "Movie" : "Series"}
                  {year ? ` · ${year}` : ""}
                </p>
              ) : null}

              <h1 className="text-4xl font-black leading-tight drop-shadow-lg sm:text-5xl">
                {name}
              </h1>

              {tagline ? (
                <p className="mt-2 text-base italic text-muted sm:text-lg">
                  &ldquo;{tagline}&rdquo;
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-rating-high">{matchScore}% Match</span>
                <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-bold">
                  ★ {(details.vote_average).toFixed(1)}
                </span>
                <span className="text-muted">{runtimeLine}</span>
                <span className="text-muted">{formatDateLong(releaseDate)}</span>
              </div>

              {details.genres.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {details.genres.map((genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/90"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              ) : null}

              {details.overview ? (
                <p className="mt-4 text-sm leading-relaxed text-foreground/90 sm:text-base">
                  {details.overview}
                </p>
              ) : null}

              <div className="mt-6">
                <TitleActions
                  mediaType={mediaType}
                  id={tmdbId}
                  title={name}
                  watchPath={getWatchPathFor(mediaType, tmdbId)}
                  trailerEmbedUrl={trailer ? getYouTubeEmbedUrl(trailer.key) : null}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body sections ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6">
        <CastCarousel cast={cast} />

        <section aria-label="Details">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-muted sm:text-xl">
            Details
          </h2>
          <dl className="grid gap-x-8 gap-y-3 rounded-xl bg-surface p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-faint">
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground/90">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <ReviewsSection
          tmdbReviews={leanReviews}
          titleKey={`${mediaType}-${tmdbId}`}
          titleKeyLabel={`${name} · stored on this device`}
        />

        <section aria-label="More like this">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-muted sm:text-xl">
            More Like This
          </h2>
          <TitleGrid
            items={recommendations}
            emptyMessage="No recommendations for this title yet."
          />
        </section>

        <p className="text-center text-xs text-muted">
          <Link href="/" className="hover:text-foreground">
            ← Back to browse
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function TitlePage({ params }: { params: RouteParams }) {
  return (
    <Suspense fallback={<TitlePageSkeleton />}>
      <TitleBodyLoader params={params} />
    </Suspense>
  );
}

async function TitleBodyLoader({ params }: { params: RouteParams }) {
  const { type, id } = await params;
  return <TitleBody type={type} id={id} />;
}

/** Instant shell shown while params resolve and TMDB data streams in. */
function TitlePageSkeleton() {
  return (
    <main className="min-h-screen" aria-busy>
      <div className="relative min-h-[60vh] w-full bg-surface">
        <div className="fade-to-b absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-36 sm:px-6">
          <div className="bg-skeleton h-4 w-24 rounded" />
          <div className="bg-skeleton h-12 w-80 max-w-full rounded" />
          <div className="bg-skeleton h-6 w-64 max-w-full rounded" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
        <div className="bg-skeleton h-28 w-full rounded-xl" />
        <div className="bg-skeleton h-40 w-full rounded-xl" />
      </div>
    </main>
  );
}

function formatDateLong(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** TMDB outage (key missing, 5xx, rate limit) — non-fatal, with a way back. */
function TitleError({ message }: { message: string }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-black">Couldn&apos;t load this title</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{message}</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
      >
        Back to Browse
      </Link>
    </main>
  );
}
