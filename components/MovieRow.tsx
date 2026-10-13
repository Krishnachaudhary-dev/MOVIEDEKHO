"use client";

/**
 * MovieRow — horizontal scrolling carousel of MovieCards.
 *
 * Chevron buttons scroll by ~80% of the visible width with smooth behavior;
 * they auto-hide at either end of the list.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import MovieCard from "@/components/MovieCard";
import type { TmdbMovieResult, TmdbTvResult } from "@/lib/types/tmdb";

export interface MovieRowProps {
  title: string;
  items: (TmdbMovieResult | TmdbTvResult)[];
}

export default function MovieRow({ title, items }: MovieRowProps) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", onResize);
    };
    // Re-check once fonts/layout settle.
  }, [items.length]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <section className="group/row relative">
      <h2 className="mb-3 px-4 text-lg font-bold sm:px-6 sm:text-xl">{title}</h2>

      <div className="relative">
        {/* Left chevron */}
        {canLeft && (
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollBy(-1)}
            className="absolute left-0 top-0 z-20 flex h-full w-10 items-center justify-center bg-gradient-to-r from-black/60 to-transparent opacity-0 transition-opacity group-hover/row:opacity-100"
          >
            <ChevronLeft className="size-7 drop-shadow" />
          </button>
        )}

        <ul
          ref={scrollerRef}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-4 py-2 sm:px-6"
        >
          {items.map((item) => (
            <MovieCard
              key={`${"title" in item ? "movie" : "tv"}-${item.id}`}
              item={item}
            />
          ))}
        </ul>

        {/* Right chevron */}
        {canRight && (
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollBy(1)}
            className="absolute right-0 top-0 z-20 flex h-full w-10 items-center justify-center bg-gradient-to-l from-black/60 to-transparent opacity-0 transition-opacity group-hover/row:opacity-100"
          >
            <ChevronRight className="size-7 drop-shadow" />
          </button>
        )}
      </div>
    </section>
  );
}
