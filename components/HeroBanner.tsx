"use client";

/**
 * HeroBanner — the cinematic top-of-page billboard.
 *
 * Shows the #1 trending title with an `original`-size backdrop, truncated
 * overview, rating badge, and Play / More Info actions. Receives its
 * (already-fetched) details as props so the homepage controls all data
 * loading; keeping this component dumb keeps it render-cheap.
 */

import { Info, Play, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  getBackdropUrl,
  getMediaType,
  getPosterUrl,
  getTitle,
  getWatchPath,
  getYear,
} from "@/lib/tmdb";
import type { TmdbDetails, TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";
import DetailsModal from "@/components/DetailsModal";

const OVERVIEW_LIMIT = 150;

interface HeroBannerProps {
  item: TmdbMovieResult | TmdbTvResult;
  /** Optional full details (genres, runtime) when already fetched. */
  details?: TmdbDetails | null;
}

export default function HeroBanner({ item, details }: HeroBannerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const backdrop = getBackdropUrl(item.backdrop_path, "original");
  const poster = getPosterUrl(item.poster_path, "w780");
  const title = getTitle(item);
  const kind = getMediaType(item);
  const year = getYear(item);
  const rating = Math.round(item.vote_average * 10) / 10;
  const overview =
    item.overview.length > OVERVIEW_LIMIT
      ? `${item.overview.slice(0, OVERVIEW_LIMIT).trimEnd()}…`
      : item.overview;

  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden">
      {/* Backdrop — eases in over ~1s on first paint */}
      <div className="absolute inset-0">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={85}
            sizes="100vw"
            className="animate-hero-backdrop object-cover object-top"
          />
        ) : (
          <div className="h-full w-full bg-surface" />
        )}
        {/* Legibility scrims: left column for text, bottom fade into page.
            Layered over the animated backdrop with its own fade-in so the
            gradient floats in above the image. */}
        <div className="animate-hero-backdrop scrim-right absolute inset-0" />
        <div className="animate-hero-backdrop fade-to-b absolute inset-x-0 bottom-0 h-64" />
      </div>

      {/* Content column */}
      <div className="animate-hero-content relative mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col justify-end px-4 pb-20 pt-36 sm:px-6">
        <div className="max-w-xl">
          {year || kind ? (
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted">
              {kind === "tv" ? "Series" : "Movie"}
              {year ? ` · ${year}` : ""}
            </p>
          ) : null}

          <h1 className="text-4xl font-black leading-tight drop-shadow-lg sm:text-5xl">
            {title}
          </h1>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 font-bold">
              <Star className="size-3.5 fill-current" />
              {rating.toFixed(1)}
            </span>
            {details && "runtime" in details && details.runtime ? (
              <span className="text-muted">{details.runtime} min</span>
            ) : null}
            {details && "number_of_seasons" in details ? (
              <span className="text-muted">
                {details.number_of_seasons} season
                {details.number_of_seasons === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {overview && (
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-foreground/90 sm:text-base">
              {overview}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={getWatchPath(item)}
              className="inline-flex items-center gap-2 rounded bg-white px-6 py-2.5 font-bold text-black transition hover:bg-white/80"
            >
              <Play className="size-5 fill-current" />
              Play
            </Link>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-white/20 px-6 py-2.5 font-bold text-white backdrop-blur transition hover:bg-white/30"
            >
              <Info className="size-5" />
              More Info
            </button>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <DetailsModal
          item={item}
          poster={poster}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </section>
  );
}
