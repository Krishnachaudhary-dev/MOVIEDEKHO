import type { MovieStreamRecord, StreamSource, StreamSourceType, StreamsResponse } from '@/lib/types/sources';
import { getSupabaseClient } from './supabase';

const ALLOWED_SOURCE_TYPES: StreamSourceType[] = ['embed', 'm3u8', 'mp4'];

/** The episode a caller is asking about. Omitted entirely for movies. */
export interface StreamSelection {
  season: number;
  episode: number;
}

/**
 * Which set of mirrors a resolution landed on:
 * `episode` — a mirror registered for exactly that episode,
 * `title`   — the title-level mirror (or the demo fallback).
 */
export type SourceScope = 'episode' | 'title';

/** The part of a `stream_sources` row that episode selection depends on. */
interface EpisodeScoped {
  season_number: number | null;
  episode_number: number | null;
}

/**
 * Normalise a `stream_sources.type` value.
 *
 * Returns `null` for anything unusable instead of throwing: one hand-edited row
 * used to take down the whole watch page and `/api/streams` with a 500, when
 * the right answer is to skip that mirror and serve the rest.
 */
function parseSourceType(value: string): StreamSourceType | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if ((ALLOWED_SOURCE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as StreamSourceType;
  }
  return null;
}

/**
 * Pick the rows that apply to a selection.
 *
 * Deliberately a pure function: the precedence rule below is the whole
 * behaviour of episode-scoped streams, and it is far better verified by calling
 * it than by pointing a browser at a database.
 *
 * - Season and episode both `null` → a title-level mirror. It serves movies and
 *   any episode of a series (plenty of embeds carry their own episode picker),
 *   and it is the fallback whenever a specific episode has no mirror of its own.
 * - Season and episode both set → an episode mirror. It applies to that exact
 *   episode only, and wins over the title-level mirror when it exists.
 */
export function selectSourcesForSelection<T extends EpisodeScoped>(
  rows: readonly T[],
  selection?: StreamSelection,
): { rows: T[]; scope: SourceScope } {
  const titleLevel = rows.filter(
    (row) => row.season_number === null && row.episode_number === null,
  );

  if (!selection) {
    return { rows: titleLevel, scope: 'title' };
  }

  const forEpisode = rows.filter(
    (row) =>
      row.season_number === selection.season &&
      row.episode_number === selection.episode,
  );

  return forEpisode.length > 0
    ? { rows: forEpisode, scope: 'episode' }
    : { rows: titleLevel, scope: 'title' };
}

/** Columns read from `stream_sources` before the episode migration. */
const SOURCE_COLUMNS = 'id, server_name, url, type, priority';
/** …and after it. */
const SOURCE_COLUMNS_WITH_EPISODE = `${SOURCE_COLUMNS}, season_number, episode_number`;

interface RawSourceRow extends EpisodeScoped {
  id: string;
  server_name: string;
  url: string;
  type: string;
  priority: number;
}

/**
 * Fetch stream sources for a TMDB title from Supabase.
 *
 * `selection` narrows a TV title to one episode; the title-level mirrors stay
 * the fallback, so a series can be configured without touching episodes at all.
 */
export async function getStreamsFromSupabase(
  tmdbId: number,
  selection?: StreamSelection,
  mediaType: 'movie' | 'tv' = 'movie',
): Promise<StreamsResponse> {
  const supabase = getSupabaseClient();

  const { data: movie, error: movieError } = await supabase
    .from('movie_streams')
    .select('id, title')
    .eq('tmdb_id', tmdbId)
    .single();

  if (movieError?.code === 'PGRST116') {
    // No row for this TMDB id yet — return the demo fallback.
    return buildDemoResponse(tmdbId, 'no stream record in Supabase yet', mediaType);
  }

  if (movieError) {
    console.error('Supabase movie_streams lookup failed:', movieError);
    return buildDemoResponse(tmdbId, 'supabase lookup error', mediaType);
  }

  const movieId = movie?.id;
  if (!movieId) {
    return buildDemoResponse(tmdbId, 'no stream record in Supabase yet', mediaType);
  }

  const sourcesQuery = () =>
    supabase
      .from('stream_sources')
      .select(SOURCE_COLUMNS_WITH_EPISODE)
      .eq('movie_id', movieId)
      .order('priority', { ascending: false });

  let { data: sourceRows, error: sourcesError } = await sourcesQuery();

  if (sourcesError?.code === '42703') {
    // The project has not run the episode migration yet (undefined column).
    // Degrading every TV page to demo streams would be a much worse outcome
    // than losing per-episode mirrors, so read the legacy shape and treat
    // every row as title-level.
    console.warn(
      'stream_sources has no season_number/episode_number columns yet — serving title-level mirrors only. Re-run supabase/schema.sql to enable per-episode sources.',
    );

    const legacy = await supabase
      .from('stream_sources')
      .select(SOURCE_COLUMNS)
      .eq('movie_id', movieId)
      .order('priority', { ascending: false });

    sourceRows = (legacy.data ?? []).map((row) => ({
      ...row,
      season_number: null,
      episode_number: null,
    }));
    sourcesError = legacy.error;
  }

  if (sourcesError) {
    console.error('Supabase stream_sources lookup failed:', sourcesError);
    return buildDemoResponse(tmdbId, 'supabase sources lookup error', mediaType);
  }

  const applicable = selectSourcesForSelection(
    (sourceRows ?? []) as RawSourceRow[],
    selection,
  );
  const mapped = applicable.rows
    .map(mapSource)
    .filter((source): source is StreamSource => source !== null);

  const record: MovieStreamRecord = {
    tmdb_id: tmdbId,
    // The table is keyed by tmdb_id alone, so the request is the only place
    // that knows which namespace was meant; report it rather than assuming.
    media_type: mediaType,
    title: movie.title ?? `TMDB #${tmdbId}`,
    default_server: mapped[0]?.id ?? '',
    sources: mapped,
  };

  return { record, fallback: false, sourceScope: applicable.scope };
}

function mapSource(row: RawSourceRow): StreamSource | null {
  const type = parseSourceType(row.type);
  if (!type) {
    console.warn(
      `stream_sources row ${row.id} skipped: type must be one of ${ALLOWED_SOURCE_TYPES.join(', ')}, got "${row.type}"`,
    );
    return null;
  }

  return {
    id: row.id,
    name: row.server_name,
    url: row.url,
    type,
    priority: row.priority,
  };
}

function buildDemoResponse(
  tmdbId: number,
  reason: string,
  mediaType: 'movie' | 'tv' = 'movie',
): StreamsResponse {
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
      media_type: mediaType,
      title: `Demo streams for TMDB #${tmdbId}`,
      default_server: sources[0].id,
      sources,
    },
    fallback: true,
    sourceScope: 'title',
  };
}
