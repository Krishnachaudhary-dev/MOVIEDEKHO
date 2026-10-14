"use client";

/**
 * `/my-list` — the watchlist page.
 *
 * Items live in localStorage (`lib/my-list`), so this page is client-side:
 * it reads ids + media types, then hydrates each one with a thumbnail fetched
 * through the internal TMDB proxy (`/api/tmdb/{type}/{id}`), which works with
 * either the server key or the public key config.
 */

import { BookmarkCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  removeFromMyList,
  useMyList,
  type MyListItem,
} from "@/lib/my-list";
import { getTitlePathFor } from "@/lib/tmdb";
interface HydratedTitle {
  id: number;
  mediaType: "movie" | "tv";
  name: string | null;
  posterUrl: string | null;
  year: string | null;
  state: "loading" | "ok" | "error";
}

type DetailsLike = {
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number | null;
};

export default function MyListPage() {
  const items = useMyList();
  const [titles, setTitles] = useState<Map<string, HydratedTitle>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const next = new Map<string, HydratedTitle>();
      for (const item of items) {
        const key = `${item.mediaType}-${item.id}`;
        next.set(key, hydrateEntry(item, next.get(key)));
      }
      if (cancelled) return;

      // Fetch anything not yet loaded; sequential keeps it simple and the
      // requests are cached by route so repeat visits are cheap.
      await Promise.all(
        [...next.entries()].map(async ([key, entry]) => {
          if (entry.state !== "loading") return;
          try {
            const response = await fetch(`/api/tmdb/${entry.mediaType}/${entry.id}`);
            if (!response.ok) throw new Error(String(response.status));
            const details = (await response.json()) as DetailsLike;
            if (cancelled) return;
            setTitles((prev) => {
              const updated = new Map(prev);
              updated.set(key, {
                ...entry,
                name: details.title ?? details.name ?? null,
                posterUrl: details.poster_path
                  ? `https://image.tmdb.org/t/p/w342${details.poster_path.startsWith("/") ? "" : "/"}${details.poster_path}`
                  : null,
                year: (details.release_date ?? details.first_air_date ?? "").slice(0, 4) || null,
                state: "ok",
              });
              return updated;
            });
          } catch {
            if (cancelled) return;
            setTitles((prev) => {
              const updated = new Map(prev);
              updated.set(key, { ...entry, state: "error" });
              return updated;
            });
          }
        }),
      );
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
    // Re-hydrate when the list itself changes (add/remove).
  }, [items]);

  // Seed skeleton entries for anything not yet in the map.
  const hydratedWithSkeleton = items.map((item) => ({
    item,
    key: `${item.mediaType}-${item.id}`,
    entry: titles.get(`${item.mediaType}-${item.id}`) ?? {
      id: item.id,
      mediaType: item.mediaType,
      name: null,
      posterUrl: null,
      year: null,
      state: "loading" as const,
    },
  }));

  return (
    <main className="min-h-screen pb-16 pt-24 sm:pt-20">
      <header className="border-b border-white/10 bg-black px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/20">
            <BookmarkCheck className="size-5 text-brand" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-white">My List</h1>
            <p className="text-xs text-faint">Saved on this device · {items.length} title{items.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-surface-hover bg-surface-raised p-10 text-center">
            <BookmarkCheck className="size-10 text-faint" />
            <p className="mt-4 text-lg font-semibold">Your list is empty</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Use the bookmark button on any poster or title page to keep it here.
            </p>
            <Link
              href="/"
              className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
            >
              Browse titles
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {hydratedWithSkeleton.map(({ item, key, entry }, index) => (
              <li key={key} className="relative">
                <Link
                  href={getTitlePathFor(entry.mediaType, entry.id)}
                  className="group block"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface shadow-lg shadow-black/40">
                    {entry.posterUrl ? (
                      <Image
                        src={entry.posterUrl}
                        alt={entry.name ?? ""}
                        fill
                        priority={entry.state === "ok" && index === 0}
                        sizes="(max-width: 640px) 45vw, 176px"
                        className="object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-110"
                      />
                    ) : entry.state === "error" ? (
                      <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-faint">
                        <span>Unavailable</span>
                        <span className="text-[10px]">id {entry.id}</span>
                      </div>
                    ) : (
                      <div className="bg-skeleton h-full w-full" />
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-xs font-medium text-foreground/85">
                    {entry.name ?? (entry.state === "ok" ? "Untitled" : "…")}
                  </p>
                  <p className="text-[11px] text-faint">
                    {entry.year ? `${entry.year} · ` : ""}
                    {entry.mediaType === "tv" ? "TV" : "Movie"}
                  </p>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${entry.name ?? "title"} from My List`}
                  onClick={() => removeFromMyList(item.id, item.mediaType)}
                  className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/70 p-1 text-white/80 opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-black/90"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function hydrateEntry(item: MyListItem, existing: HydratedTitle | undefined): HydratedTitle {
  if (existing && existing.state !== "error") return existing;
  return {
    id: item.id,
    mediaType: item.mediaType,
    name: null,
    posterUrl: null,
    year: null,
    state: "loading",
  };
}
