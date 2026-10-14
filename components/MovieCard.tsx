"use client";

/**
 * MovieCard — poster tile used in rows and grids.
 *
 * Click-through goes to the title page (`/title/[type]/[id]`) — the browse
 * surface — while two quick actions sit in the hover overlay *beside* the
 * poster link: Play (straight to the player) and My List (bookmark toggle,
 * stored locally). The quick actions must be siblings of the poster link, not
 * children: `<a>` cannot contain `<a>` and React hydrates that nesting as an
 * invalid-HTML error.
 */

import { Bookmark, BookmarkCheck, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getMediaType, getPosterUrl, getTitle, getWatchPath, getTitlePath, getYear } from "@/lib/tmdb";
import { useInMyList } from "@/lib/my-list";
import type { TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";

export interface MovieCardProps {
  item: TmdbMovieResult | TmdbTvResult;
  /** Fixed poster width class from the parent row (responsive sizing lives there). */
  sizeClass?: string;
}

export default function MovieCard({ item, sizeClass = "w-36 sm:w-44" }: MovieCardProps) {
  const poster = getPosterUrl(item.poster_path, "w342");
  const title = getTitle(item);
  const year = getYear(item);
  const kind = getMediaType(item);
  const rating = Math.round(item.vote_average * 10) / 10;
  const [inList, toggleList] = useInMyList(item.id, kind);

  const quickButton =
    "inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-white/60";

  return (
    <div className={`group relative shrink-0 text-left ${sizeClass}`}>
      {/* Poster link — the whole tile except the quick actions. */}
      <Link
        href={getTitlePath(item)}
        aria-label={`${title} details`}
        className="relative z-0 block"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface shadow-lg shadow-black/40 transition-[transform,box-shadow] duration-300 ease-out will-change-transform group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-black/70 group-focus-visible:ring-2 group-focus-visible:ring-brand">
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

          {/* Hover overlay — metadata slides up as the card lifts. Pointer
              transparent so missed clicks reach the poster link. */}
          <div className="pointer-events-none absolute inset-0 flex translate-y-2 flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            <p className="truncate text-xs font-semibold">{title}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              {year ? <span>{year}</span> : null}
              <span className="inline-flex items-center gap-0.5 text-rating-mid">
                <Star />
                {rating.toFixed(1)}
              </span>
              <span className="ml-auto rounded bg-white/15 px-1.5 py-px uppercase">
                {kind === "tv" ? "TV" : "Movie"}
              </span>
            </div>
          </div>
        </div>

        {/* Below-poster caption keeps rows scannable without hover */}
        <p className="mt-1.5 truncate text-xs font-medium text-foreground/85">{title}</p>
      </Link>

      {/* Quick actions — layered above the poster link as its sibling, so no
          <a> nests inside another <a>. */}
      <div className="absolute right-2 top-2 z-20 flex flex-col gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <Link
          href={getWatchPath(item)}
          aria-label={`Play ${title}`}
          title="Play"
          className={quickButton}
        >
          <Play className="size-3.5 fill-current" />
        </Link>
        <button
          type="button"
          aria-label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
          title={inList ? "In My List" : "Add to My List"}
          onClick={() => toggleList()}
          className={quickButton}
        >
          {inList ? (
            <BookmarkCheck className="size-3.5 fill-brand text-brand" />
          ) : (
            <Bookmark className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 fill-current" aria-hidden>
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
    </svg>
  );
}
