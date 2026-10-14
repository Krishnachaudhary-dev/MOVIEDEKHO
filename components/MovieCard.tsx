"use client";

/**
 * MovieCard — poster thumbnail used inside every MovieRow.
 *
 * Hover: smooth scale-up + metadata overlay (year, rating, type) and a
 * click-through to the details modal (not direct navigation, Netflix-style).
 * The lift uses transform + shadow so it stays on the compositor and never
 * triggers layout work.
 */

import { Star } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { getMediaType, getPosterUrl, getTitle, getYear } from "@/lib/tmdb";
import type { TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";
import DetailsModal from "@/components/DetailsModal";

export interface MovieCardProps {
  item: TmdbMovieResult | TmdbTvResult;
  /** Fixed poster width class from the parent row (responsive sizing lives there). */
  sizeClass?: string;
}

export default function MovieCard({ item, sizeClass = "w-36 sm:w-44" }: MovieCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const poster = getPosterUrl(item.poster_path, "w342");
  const title = getTitle(item);
  const year = getYear(item);
  const kind = getMediaType(item);
  const rating = Math.round(item.vote_average * 10) / 10;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`group relative shrink-0 text-left ${sizeClass}`}
        aria-label={`${title} details`}
      >
        <div className="relative z-0 aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface shadow-lg shadow-black/40 transition-[transform,box-shadow] duration-300 ease-out will-change-transform group-hover:z-10 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-black/70 group-focus-visible:ring-2 group-focus-visible:ring-brand">
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width: 640px) 144px, 176px"
              className="object-cover transition-[filter] duration-300 group-hover:brightness-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-faint">
              No image
            </div>
          )}

          {/* Hover overlay — metadata slides up as the card lifts */}
          <div className="absolute inset-0 flex translate-y-2 flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            <p className="truncate text-xs font-semibold">{title}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              {year ? <span>{year}</span> : null}
              <span className="inline-flex items-center gap-0.5 text-rating-mid">
                <Star className="size-3 fill-current" />
                {rating.toFixed(1)}
              </span>
              <span className="ml-auto rounded bg-white/15 px-1.5 py-px uppercase">
                {kind === "tv" ? "TV" : "Movie"}
              </span>
            </div>
          </div>
        </div>

        {/* Below-poster caption keeps rows scannable without hover */}
        <p className="mt-1.5 truncate text-xs font-medium text-foreground/85">
          {title}
        </p>
      </button>

      {modalOpen ? (
        <DetailsModal
          item={item}
          poster={getPosterUrl(item.poster_path, "w780")}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
