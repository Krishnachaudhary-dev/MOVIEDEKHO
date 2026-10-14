"use client";

/**
 * TrailerModal — full-window YouTube trailer overlay, opened from TitleActions.
 *
 * The URL arrives pre-built (`getYouTubeEmbedUrl`) so the component stays dumb;
 * it only handles Escape-to-close, scroll lock, and the iframe itself.
 */

import { X } from "lucide-react";
import { useEffect } from "react";

interface TrailerModalProps {
  /** `https://www.youtube-nocookie.com/embed/{key}?...` */
  url: string;
  title: string;
  onClose: () => void;
}

export default function TrailerModal({ url, title, onClose }: TrailerModalProps) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} trailer`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute right-4 top-4">
        <button
          type="button"
          aria-label="Close trailer"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="w-full max-w-4xl">
        <iframe
          src={url}
          title={`${title} — trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="aspect-video w-full rounded-xl border-0 shadow-2xl"
        />
      </div>
    </div>
  );
}
