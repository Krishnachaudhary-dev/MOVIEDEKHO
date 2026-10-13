/**
 * `/api/tmdb/[...path]` — a narrow, allow-listed proxy to TMDB.
 *
 * Why this exists: the debounced search bar queries TMDB from the browser.
 * If you set `NEXT_PUBLIC_TMDB_API_KEY` the browser can hit TMDB directly and
 * this route is optional. If you'd rather keep the key server-side only
 * (recommended), leave the `NEXT_PUBLIC_` var empty and point the client at
 * `/api/tmdb/search/multi?query=…` instead — the key never leaves the server.
 *
 * It is deliberately *not* an open proxy: only GET and only the endpoints
 * MovieDekho actually uses are allowed, so this can't be used to hammer
 * arbitrary TMDB APIs on your bill.
 */

import { NextRequest } from "next/server";

import {
  buildTmdbUrl,
  resolveAuth,
  TmdbConfigError,
  TmdbError,
} from "@/lib/tmdb";

/**
 * Mirrors `lib/tmdb.ts` so the proxy and the direct client time out
 * identically. Route handlers are never prerendered, so the clock read that
 * `AbortSignal.timeout` performs is harmless here — we just keep the two
 * implementations in step.
 */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("timeout")), ms);
  return controller.signal;
}

/**
 * Endpoint prefixes we allow through. Anything else 404s before we make an
 * outbound request.
 */
const ALLOWED_PREFIXES = [
  "/trending/",
  "/movie/popular",
  "/movie/top_rated",
  "/movie/now_playing",
  "/movie/upcoming",
  "/movie/",
  "/tv/popular",
  "/tv/top_rated",
  "/tv/airing_today",
  "/tv/on_the_air",
  "/tv/",
  "/search/multi",
  "/search/movie",
  "/search/tv",
  "/discover/movie",
  "/discover/tv",
  "/genre/",
] as const;

/** Query params the proxy is allowed to forward. Everything else is dropped. */
const ALLOWED_QUERY_PARAMS = new Set([
  "language",
  "page",
  "region",
  "query",
  "year",
  "primary_release_year",
  "first_air_date_year",
  "include_adult",
  "with_genres",
  "sort_by",
  "with_keywords",
  "with_watch_providers",
  "watch_region",
  "vote_count.gte",
  "vote_average.gte",
  "vote_average.lte",
  "with_runtime.gte",
  "with_runtime.lte",
  "primary_release_date.gte",
  "primary_release_date.lte",
  "first_air_date.gte",
  "first_air_date.lte",
  "with_networks",
  "append_to_response",
  "video",
]);

/** Guard against path traversal / smuggling into a different host. */
function isSafeSegment(segment: string) {
  return /^[A-Za-z0-9_\-./]+$/.test(segment) && !segment.includes("..");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  if (!Array.isArray(path) || path.length === 0) {
    return Response.json(
      { error: "Missing TMDB path. Try /api/tmdb/movie/popular" },
      { status: 400 },
    );
  }

  if (!path.every(isSafeSegment)) {
    return Response.json({ error: "Invalid TMDB path." }, { status: 400 });
  }

  const tmdbPath = `/${path.join("/")}`;

  if (
    !ALLOWED_PREFIXES.some(
      (prefix) => tmdbPath === prefix || tmdbPath.startsWith(prefix),
    )
  ) {
    return Response.json(
      { error: `Endpoint ${tmdbPath} is not proxied by MovieDekho.` },
      { status: 404 },
    );
  }

  const forwarded = new URLSearchParams();
  for (const [key, value] of request.nextUrl.searchParams) {
    if (ALLOWED_QUERY_PARAMS.has(key) && value !== "") {
      forwarded.set(key, value);
    }
  }
  // Search requires a query string; without one TMDB returns an empty page.
  if (tmdbPath.startsWith("/search/") && !forwarded.get("query")) {
    return Response.json(
      { error: "The `query` parameter is required for search." },
      { status: 400 },
    );
  }

  // Attach credentials — buildTmdbUrl only assembles the URL; without this
  // every proxied call hits TMDB unauthenticated (401).
  const auth = resolveAuth();
  if (!auth) {
    return Response.json(
      { error: "TMDB credentials are missing. Set TMDB_API_KEY in .env.local." },
      { status: 500 },
    );
  }
  if (auth.kind === "key") {
    forwarded.set("api_key", auth.value);
  }

  const url = buildTmdbUrl(tmdbPath, Object.fromEntries(forwarded));

  // Same single network-level retry as tmdbFetch: cold-connection TLS/DNS
  // failures on Windows are transient; HTTP >= 400 is a real TMDB answer.
  let lastError: unknown;
  let upstream: Response | null = null;
  for (let attemptNo = 0; attemptNo <= 1; attemptNo++) {
    if (attemptNo > 0) await new Promise((r) => setTimeout(r, 400));
    try {
      upstream = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(auth.kind === "token"
            ? { Authorization: `Bearer ${auth.value}` }
            : undefined),
        },
        signal: timeoutSignal(10_000),
      });
      lastError = undefined;
      break;
    } catch (cause) {
      lastError = cause;
    }
  }

  try {
    if (lastError !== undefined || upstream === null) {
      const reason =
        lastError instanceof Error ? lastError.message : "upstream failed";
      return Response.json(
        { error: `Upstream request failed: ${reason}` },
        { status: 502 },
      );
    }

    const body = await upstream.text();

    // Pass TMDB's status and body straight through so the client sees the
    // same 401/404/429 shape it would from TMDB directly.
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        // The proxy answer depends only on the URL, so it is safe to cache.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (cause) {
    if (cause instanceof TmdbConfigError) {
      return Response.json({ error: cause.message }, { status: 500 });
    }
    const message =
      cause instanceof TmdbError || cause instanceof Error
        ? cause.message
        : "Upstream request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
