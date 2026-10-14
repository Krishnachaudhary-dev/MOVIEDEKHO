"use client";

/**
 * DetailsModal — shared title-detail overlay.
 *
 * Opens from HeroBanner's "More Info" and MovieCard clicks. Shows the poster
 * and already-known summary instantly; fetches full TMDB details via the
 * server proxy (key stays server-side) for genres and runtime.
 */

import { BookOpen, Play, Star, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getMediaType, getWatchPath, getYear } from "@/lib/tmdb";
import type { TmdbDetails } from "@/lib/types/tmdb";
import type { TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";

interface DetailsModalProps {
  item: TmdbMovieResult | TmdbTvResult;
  poster: string | null;
  onClose: () => void;
}

interface DetailsState {
  loading: boolean;
  details: TmdbDetails | null;
  error: string | null;
}

export default function DetailsModal({
  item,
  poster,
  onClose,
}: DetailsModalProps) {
  const kind = getMediaType(item);
  const [state, setState] = useState<DetailsState>({
    loading: true,
    details: null,
    error: null,
  });

  // Fetch full details once on open.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tmdb/${kind}/${item.id}`, { signal: controller.signal })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
      )
      .then((data: TmdbDetails) =>
        setState({ loading: false, details: data, error: null }),
      )
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState({
          loading: false,
          details: null,
          error: "Could not load details.",
        });
      });
    return () => controller.abort();
  }, [kind, item.id]);

  // Close on Escape; lock scroll while open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const year = getYear(item);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={"title" in item ? `${item.title} details` : `${item.name} details`}
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative mx-auto my-8 w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-2xl">
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
          <X className="size-4" />
        </button>

        {/* Header art */}
        <div className="relative h-56 w-full">
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              sizes="512px"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-surface-raised" />
          )}
          <div className="fade-to-b absolute inset-0" />
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-black">
            {"title" in item ? item.title : item.name}
          </h2>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted">
            {year ? <span>{year}</span> : null}
            <span>{kind === "tv" ? "Series" : "Movie"}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand">
              <Star className="size-3.5 fill-current" />
              {item.vote_average.toFixed(1)}
            </span>
            {state.details && "runtime" in state.details && state.details.runtime ? (
              <span>{state.details.runtime} min</span>
            ) : null}
          </div>

          {state.loading ? (
            <div className="mt-6 space-y-2" aria-busy>
              <div className="h-3 w-full animate-pulse rounded bg-surface-raised" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-surface-raised" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-surface-raised" />
            </div>
          ) : state.error ? (
            <p className="mt-4 text-sm text-rating-low">{state.error}</p>
          ) : null}

          <p className="mt-4 text-sm leading-relaxed text-muted">
            {item.overview || "No synopsis available."}
          </p>

          {state.details?.genres?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {state.details.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-muted"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <Link
              href={getWatchPath(item)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-brand px-4 py-2.5 font-bold text-white transition hover:bg-brand-hover"
            >
              <Play className="size-5 fill-current" />
              Play
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded bg-surface-raised px-4 py-2.5 font-medium transition hover:bg-surface-hover"
              title="Coming in the watchlist milestone"
            >
              <BookOpen className="size-4" />
              My List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
