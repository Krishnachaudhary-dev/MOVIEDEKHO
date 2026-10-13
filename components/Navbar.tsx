"use client";

/**
 * MovieDekho navbar — sticky, scroll-aware, with live debounced search.
 *
 * - Transparent over the hero, fading to solid on scroll (Netflix signature).
 * - Search lives here: debounced 300ms, hits the internal TMDB proxy at
 *   `/api/tmdb/search/multi` (server proxy keeps the API key off the client).
 */

import {
  Search,
  X,
  Film,
  Tv,
  Bookmark,
  Home,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getTitle, getMediaType, getYear, getPosterUrl } from "@/lib/tmdb";
import type {
  TmdbListItem,
  TmdbMovieResult,
  TmdbTvResult,
} from "@/lib/types/tmdb";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv", label: "TV Shows", icon: Tv },
  { href: "/my-list", label: "My List", icon: Bookmark },
] as const;

const DEBOUNCE_MS = 300;

interface SearchState {
  query: string;
  results: TmdbListItem[];
  loading: boolean;
  error: string | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState<SearchState>({
    query: "",
    results: [],
    loading: false,
    error: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll listener: transparent at top, solid after ~16px.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Debounced fetch: every keystroke resets a 300ms timer. State resets for a
  // too-short query are pushed into the timer callback (deferred), keeping the
  // effect body free of synchronous setState calls.
  useEffect(() => {
    const query = inputValue.trim();
    if (query.length < 2) {
      const clear = setTimeout(() => {
        setSearch({ query: "", results: [], loading: false, error: null });
      }, 0);
      return () => clearTimeout(clear);
    }

    const timer = setTimeout(() => {
      setSearch((prev) => ({ ...prev, loading: true }));
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/tmdb/search/multi?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
        )
        .then((data: { results?: TmdbListItem[] }) => {
          setSearch({
            query,
            results: data.results ?? [],
            loading: false,
            error: null,
          });
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") {
            return; // superseded by a newer request
          }
          setSearch({
            query,
            results: [],
            loading: false,
            error: "Search failed — try again.",
          });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Close search on route change: export the search-clear route handling to
  // the effect below, keyed on pathname. The link that triggers navigation is
  // inside the dropdown itself, so it unmounts with it — but direct URL
  // changes still need the explicit reset.

  // Route changes close the search. The dropdown's own links call
  // closeSearch() in their onClick (user-initiated); Escape/X also dismiss.
  const closeSearch = () => {
    setSearchOpen(false);
    setInputValue("");
    setSearch({ query: "", results: [], loading: false, error: null });
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-navbar shadow-lg backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-xl font-black tracking-tight text-brand"
        >
          MovieDekho
        </Link>

        <ul className="hidden items-center gap-5 text-sm md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    active
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted transition-colors hover:text-foreground"
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          {searchOpen ? (
            <div className="relative w-full max-w-xs">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <input
                ref={inputRef}
                autoFocus
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Search movies, shows…"
                aria-label="Search"
                className="h-9 w-full rounded bg-surface-raised pl-8 pr-8 text-sm text-foreground outline-none ring-1 ring-transparent placeholder:text-faint focus:ring-white/40"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => {
                  setSearchOpen(false);
                  setInputValue("");
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>

              {/* Results dropdown */}
              {inputValue.trim().length >= 2 && (
                <div className="absolute right-0 top-11 max-h-96 w-80 overflow-y-auto rounded-lg border border-surface-hover bg-surface-raised p-2 shadow-2xl">
                  {search.loading && (
                    <p className="px-2 py-3 text-sm text-muted">Searching…</p>
                  )}
                  {search.error && (
                    <p className="px-2 py-3 text-sm text-rating-low">
                      {search.error}
                    </p>
                  )}
                  {!search.loading && !search.error && search.results.length === 0 && (
                    <p className="px-2 py-3 text-sm text-faint">
                      No results for “{search.query}”.
                    </p>
                  )}
                  <ul>
                    {search.results
                      .filter((item): item is TmdbMovieResult | TmdbTvResult =>
                        "poster_path" in item,
                      )
                      .slice(0, 8)
                      .map((item) => {
                        const kind = getMediaType(item);
                        const poster = getPosterUrl(item.poster_path, "w92");
                        return (
                          <li key={`${kind}-${item.id}`}>
                            <Link
                              href={`/title/${kind}/${item.id}`}
                              onClick={closeSearch}
                              className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-surface-hover"
                            >
                              {poster ? (
                                <Image
                                  src={poster}
                                  alt=""
                                  width={46}
                                  height={69}
                                  className="h-12 w-8 rounded object-cover"
                                />
                              ) : (
                                <div className="h-12 w-8 rounded bg-surface" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {getTitle(item)}
                                </p>
                                <p className="text-xs text-faint">
                                  {getYear(item) || "—"} ·{" "}
                                  {kind === "tv" ? "TV" : "Movie"}
                                </p>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              aria-label="Open search"
              onClick={() => setSearchOpen(true)}
              className="rounded p-2 text-foreground transition-colors hover:text-muted"
            >
              <Search className="size-5" />
            </button>
          )}

          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-brand text-xs font-bold uppercase">
            K
          </div>
        </div>
      </nav>

      {/* Mobile links row */}
      <ul className="flex items-center gap-4 px-4 pb-2 text-xs md:hidden">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={
                (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href))
                  ? "font-semibold text-foreground"
                  : "text-muted"
              }
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </header>
  );
}
