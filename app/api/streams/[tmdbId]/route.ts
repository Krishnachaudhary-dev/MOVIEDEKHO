import { NextResponse } from 'next/server';

import { getMovieSources } from '@/lib/sources';

/**
 * `/api/streams/[tmdbId]` — stream sources for one TMDB title.
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

  try {
    const response = await getMovieSources(id, 'movie');

    if (!response.record.sources.length) {
      return NextResponse.json(
        {
          error: 'No streams found',
          tmdbId: id,
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
