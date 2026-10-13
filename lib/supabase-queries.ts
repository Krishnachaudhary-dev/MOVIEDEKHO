import type { MovieStreamRecord, StreamSource, StreamsResponse } from '@/lib/types/sources';
import { getSupabaseClient } from './supabase';

/**
 * Fetch stream sources for a TMDB title from Supabase.
 *
 * Returns a `StreamsResponse` so the caller (the streams API route) keeps the
 * same shape it had with the in-memory mock store, including the `fallback`
 * flag. When Supabase has no row for the tmdbId we still build a `MovieStreamRecord`
 * from the demo embed so the player never crashes before real links are added.
 */
export async function getStreamsFromSupabase(
  tmdbId: number,
): Promise<StreamsResponse> {
  const supabase = getSupabaseClient();

  const { data: movie, error: movieError } = await supabase
    .from('movie_streams')
    .select('id, title')
    .eq('tmdb_id', tmdbId)
    .single();

  if (movieError && movieError.code !== 'PGRST116') {
    // PGRST116 = no rows; treat that as "not configured yet" and fall back.
    console.error('Supabase movie_streams lookup failed:', movieError);
    return buildDemoResponse(tmdbId, 'supabase lookup error');
  }

  const movieId = movie?.id;
  if (!movieId) {
    return buildDemoResponse(tmdbId, 'no stream record in Supabase yet');
  }

  const { data: sources, error: sourcesError } = await supabase
    .from('stream_sources')
    .select('id, server_name, url, type, priority')
    .eq('movie_id', movieId)
    .order('priority', { ascending: false });

  if (sourcesError) {
    console.error('Supabase stream_sources lookup failed:', sourcesError);
    return buildDemoResponse(tmdbId, 'supabase sources lookup error');
  }

  const record: MovieStreamRecord = {
    tmdb_id: tmdbId,
    media_type: 'movie',
    title: movie.title ?? `TMDB #${tmdbId}`,
    default_server: sources?.[0]?.id ?? '',
    sources: (sources ?? []).map(mapSource),
  };

  return { record, fallback: false };
}

function mapSource(row: {
  id: string;
  server_name: string;
  url: string;
  type: string;
  priority: number;
}): StreamSource {
  return {
    id: row.id,
    name: row.server_name,
    url: row.url,
    type: row.type as 'embed' | 'm3u8' | 'mp4',
    priority: row.priority,
  };
}

/**
 * Demo fallback when Supabase has no record for the title yet.
 * Kept deliberately small: one embed mirror so the player can render
 * and the server selector still has something to show during setup.
 */
function buildDemoResponse(tmdbId: number, reason: string): StreamsResponse {
  const sources: StreamSource[] = [
    {
      id: 'demo-server-1',
      name: 'Demo Server 1',
      url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
      type: 'embed',
      priority: 30,
    },
  ];

  return {
    record: {
      tmdb_id: tmdbId,
      media_type: 'movie',
      title: `Demo streams for TMDB #${tmdbId}`,
      default_server: sources[0].id,
      sources,
    },
    fallback: true,
  };
}
