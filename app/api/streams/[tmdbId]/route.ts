import { NextResponse } from 'next/server';

import { getMovieSources } from '@/lib/sources';
import type { StreamSelection } from '@/lib/supabase-queries';

/**
 * `/api/streams/[tmdbId]` — stream sources for one TMDB title.
 *
 * Query parameters:
 * - `type=movie|tv` (default `movie`) — which of the title's two namespaces is
 *   meant; TMDB reuses ids across them.
 * - `season` + `episode` — for TV, ask about one episode. Episode-scoped
 *   mirrors win; otherwise the title-level mirror is returned and `sourceScope`
 *   says which happened.
 *
 * Resolution goes through the very same `getMovieSources` the watch page uses,
 * so the API and the player can never disagree about a title: with Supabase
 * configured it reads `movie_streams` + `stream_sources`, otherwise it serves
 * the bundled seed and, failing that, the demo embed.
 *
 * This used to call `getStreamsFromSupabase` directly, which throws when the
 * Supabase env vars are absent — an unconfigured deployment got an opaque 500
 * from this route while the watch page happily served seed streams.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> },
) {
  const { tmdbId } = await params;
  const id = Number(tmdbId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: 'tmdbId must be a positive integer.', received: tmdbId },
      { status: 400 },
    );
  }

  const search = new URL(request.url).searchParams;

  const typeParam = search.get('type');
  if (typeParam !== null && typeParam !== '' && typeParam !== 'movie' && typeParam !== 'tv') {
    return NextResponse.json(
      { error: "type must be 'movie' or 'tv'.", received: typeParam },
      { status: 400 },
    );
  }
  const mediaType = typeParam === 'tv' ? ('tv' as const) : ('movie' as const);

  const season = parseIndex(search.get('season'), 0);
  const episode = parseIndex(search.get('episode'), 1);

  if (season.invalid || episode.invalid) {
    return NextResponse.json(
      {
        error:
          'season must be an integer >= 0 and episode an integer >= 1.',
        received: {
          season: search.get('season'),
          episode: search.get('episode'),
        },
      },
      { status: 400 },
    );
  }

  // Half a selection is a caller bug: without both numbers there is no episode
  // to prefer, and silently ignoring one would answer a question nobody asked.
  if ((season.value === undefined) !== (episode.value === undefined)) {
    return NextResponse.json(
      { error: 'Pass both season and episode, or neither.' },
      { status: 400 },
    );
  }

  const selection: StreamSelection | undefined =
    season.value !== undefined && episode.value !== undefined
      ? { season: season.value, episode: episode.value }
      : undefined;

  try {
    const response = await getMovieSources(id, mediaType, selection);

    if (!response.record.sources.length) {
      return NextResponse.json(
        {
          error: 'No streams found',
          tmdbId: id,
          mediaType,
          ...(selection ? selection : {}),
          hint: 'No stream source is configured for this title yet — add one at /admin.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    // Never answer with an empty 500 — name the failure so the caller (and the
    // Vercel logs) can tell a resolver bug from a missing mirror.
    console.error('/api/streams: resolving sources failed', error);
    return NextResponse.json(
      {
        error: 'Stream lookup failed',
        tmdbId: id,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

/**
 * A non-negative integer query param, or `undefined` when absent. `invalid`
 * distinguishes "not there" from "there and unusable" so the route can 400
 * on a typo instead of quietly answering about episode 1.
 */
function parseIndex(
  raw: string | null,
  min: number,
): { value: number | undefined; invalid: boolean } {
  if (raw === null || raw.trim() === '') return { value: undefined, invalid: false };
  const n = Number(raw);
  return Number.isInteger(n) && n >= min
    ? { value: n, invalid: false }
    : { value: undefined, invalid: true };
}
