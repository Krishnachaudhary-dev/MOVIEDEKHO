import type { MovieStreamRecord, StreamSource, StreamSourceType, StreamsResponse } from '@/lib/types/sources';
import { getSupabaseClient } from './supabase';

const ALLOWED_SOURCE_TYPES: StreamSourceType[] = ['embed', 'm3u8', 'mp4'];

function parseSourceType(value: string): StreamSourceType {
  if (ALLOWED_SOURCE_TYPES.includes(value as StreamSourceType)) {
    return value as StreamSourceType;
  }
  throw new Error(
    `stream_sources.type must be one of ${ALLOWED_SOURCE_TYPES.join(', ')}, got "${value}"`,
  );
}

/** Fetch stream sources for a TMDB title from Supabase. */
export async function getStreamsFromSupabase(
  tmdbId: number,
): Promise<StreamsResponse> {
  const supabase = getSupabaseClient();

  const { data: movie, error: movieError } = await supabase
    .from('movie_streams')
    .select('id, title')
    .eq('tmdb_id', tmdbId)
    .single();

  if (movieError?.code === 'PGRST116') {
    // No row for this TMDB id yet — return the demo fallback.
    return buildDemoResponse(tmdbId, 'no stream record in Supabase yet');
  }

  if (movieError) {
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
    type: parseSourceType(row.type),
    priority: row.priority,
  };
}

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
