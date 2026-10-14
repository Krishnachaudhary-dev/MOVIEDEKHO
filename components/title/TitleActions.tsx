"use client";

/**
 * TitleActions — the action toolbar on the title page (client, because Like /
 * My List / Share are browser concerns).
 *
 * Watch Now navigates; Trailer opens the YouTube modal; Like and My List
 * persist to localStorage via `lib/my-list`; Share uses Web Share when
 * available and falls back to a clipboard copy with a visible confirmation.
 */

import { Bookmark, BookmarkCheck, Check, Heart, Link2, Play, Share2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useInMyList, useIsLiked } from "@/lib/my-list";
import TrailerModal from "@/components/title/TrailerModal";

interface TitleActionsProps {
  mediaType: "movie" | "tv";
  id: number;
  title: string;
  /** `getWatchPath(...)` — the player route. */
  watchPath: string;
  /** YouTube embed URL for the best trailer, or null when TMDB has none. */
  trailerEmbedUrl: string | null;
}

export default function TitleActions({
  mediaType,
  id,
  title,
  watchPath,
  trailerEmbedUrl,
}: TitleActionsProps) {
  const [inList, toggleList] = useInMyList(id, mediaType);
  const [liked, toggleLike] = useIsLiked(id, mediaType);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  // Share feedback resets after a beat, from an effect instead of setState-then-timeout.
  useEffect(() => {
    if (shareState !== "copied") return;
    const timer = setTimeout(() => setShareState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [shareState]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed share sheet — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  };

  const baseButton =
    "inline-flex items-center gap-2 rounded px-4 py-2.5 text-sm font-bold transition sm:px-5";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Link
        href={watchPath}
        className={`${baseButton} bg-brand text-white hover:bg-brand-hover`}
      >
        <Play className="size-4 fill-current" />
        Watch Now
      </Link>

      <button
        type="button"
        disabled={!trailerEmbedUrl}
        onClick={() => setTrailerOpen(true)}
        title={trailerEmbedUrl ? "Play trailer" : "No trailer available on TMDB"}
        className={`${baseButton} bg-white/15 text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Play className="size-4" />
        Trailer
      </button>

      <button
        type="button"
        onClick={toggleLike}
        aria-pressed={liked}
        className={`${baseButton} bg-surface-raised text-foreground hover:bg-surface-hover`}
      >
        {liked ? (
          <Heart className="size-4 fill-rating-low text-rating-low" />
        ) : (
          <Heart className="size-4" />
        )}
        {liked ? "Liked" : "Like"}
      </button>

      <button
        type="button"
        onClick={toggleList}
        aria-pressed={inList}
        className={`${baseButton} bg-surface-raised text-foreground hover:bg-surface-hover`}
      >
        {inList ? (
          <BookmarkCheck className="size-4 fill-brand text-brand" />
        ) : (
          <Bookmark className="size-4" />
        )}
        {inList ? "In My List" : "My List"}
      </button>

      <button
        type="button"
        onClick={() => void share()}
        className={`${baseButton} bg-surface-raised text-foreground hover:bg-surface-hover`}
      >
        {shareState === "copied" ? (
          <Check className="size-4 text-rating-high" />
        ) : shareState === "failed" ? (
          <X className="size-4 text-rating-low" />
        ) : (
          <Share2 className="size-4" />
        )}
        {shareState === "copied" ? "Link copied" : shareState === "failed" ? "Copy failed" : "Share"}
        <Link2 className="hidden" aria-hidden />
      </button>

      {trailerOpen && trailerEmbedUrl ? (
        <TrailerModal url={trailerEmbedUrl} title={title} onClose={() => setTrailerOpen(false)} />
      ) : null}
    </div>
  );
}
