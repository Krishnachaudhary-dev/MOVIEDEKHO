/** MovieDekho — source resolver (Phase 2 + Phase 5 Supabase path). */
import seed from '@/data/streams.json';
import type {
  MovieStreamRecord,
  StreamSource,
  StreamSourceType,
  StreamsResponse,
} from '@/lib/types/sources';
import { getStreamsFromSupabase } from './supabase-queries';
import type { StreamSelection } from './supabase-queries';
import { hasSupabaseConfig } from './supabase';

/** Typed view of the JSON seed (JSON modules widen literals to string). */
interface SeedSource {
  id: string;
  name: string;
  url: string;
  type: string;
  quality?: string;
  priority: number;
}

interface SeedRecord {
  tmdb_id: number;
  media_type: string;
  title: string;
  default_server: string;
  sources: SeedSource[];
}

/** Runtime-checked cast helpers — a malformed seed fails loudly at load. */
function toSourceType(value: string): StreamSourceType {
  if (value === 'embed' || value === 'm3u8' || value === 'mp4') return value;
  throw new Error(`data/streams.json: unknown source type "${value}"`);
}

function toMediaType(value: string): 'movie' | 'tv' {
  if (value === 'movie' || value === 'tv') return value;
  throw new Error(`data/streams.json: unknown media_type "${value}"`);
}

/** Normalize the seed once at module load: validate + sort by priority desc. */
const store: MovieStreamRecord[] = (seed as SeedRecord[]).map(
  (raw): MovieStreamRecord => ({
    tmdb_id: raw.tmdb_id,
    media_type: toMediaType(raw.media_type),
    title: raw.title,
    default_server: raw.default_server,
    sources: raw.sources
      .map(
        (source): StreamSource => ({
          id: source.id,
          name: source.name,
          url: source.url,
          type: toSourceType(source.type),
          quality: source.quality,
          priority: source.priority,
        }),
      )
      .sort((a, b) => b.priority - a.priority),
  }),
);

/** In-memory index by composite key; built once. */
const byKey = new Map<string, MovieStreamRecord>(
  store.map((record) => [streamKey(record.tmdb_id, record.media_type), record]),
);

function streamKey(tmdbId: number, mediaType: 'movie' | 'tv'): string {
  return `${mediaType}:${tmdbId}`;
}

/**
 * Build the fallback record when a title has no mirrors anywhere.
 *
 * These are the standard TMDB-keyed embed providers with URL patterns
 * documented in public open-source repos (VidSrc.to/.xyz/.cc `/v2`,
 * `player.autoembed.cc`, `embed.su`, `multiembed.mov`): `embed/movie/{id}`
 * and `embed/tv/{id}/{season}/{episode}`. A dead provider lands in the
 * player's error UI and the switcher bar picks the next server — mirrored
 * servers from Supabase always outrank this fallback because they are what
 * the admin actually configured.
 */
function buildFallback(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  selection?: StreamSelection,
): MovieStreamRecord {
  // TV embeds key by season/episode; with no selection the first episode of
  // season 1 is the conventional default (same shape the old hardcoded
  // Breaking Bad entry used).
  const season = selection?.season ?? 1;
  const episode = selection?.episode ?? 1;
  const path =
    mediaType === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}/${season}/${episode}`;
  const episodeQuery = mediaType === 'movie' ? '' : `&s=${season}&e=${episode}`;

  const sources: StreamSource[] = [
    {
      id: 'vidsrc-to',
      name: 'VidSrc',
      url: `https://vidsrc.to/embed/${path}`,
      type: 'embed',
      priority: 100,
    },
    {
      id: 'autoembed',
      name: 'AutoEmbed',
      url: `https://player.autoembed.cc/embed/${path}`,
      type: 'embed',
      priority: 90,
    },
    {
      id: 'embed-su',
      name: 'Embed.su',
      url: `https://embed.su/embed/${path}`,
      type: 'embed',
      priority: 80,
    },
    {
      id: 'superembed',
      name: 'SuperEmbed',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1${episodeQuery}`,
      type: 'embed',
      priority: 70,
    },
    {
      id: 'vidsrc-xyz',
      name: 'VidSrc XYZ',
      url: `https://vidsrc.xyz/embed/${path}`,
      type: 'embed',
      priority: 60,
    },
    {
      id: 'vidsrc-cc',
      name: 'VidSrc CC',
      url: `https://vidsrc.cc/v2/embed/${path}`,
      type: 'embed',
      priority: 50,
    },
  ];

  return {
    tmdb_id: tmdbId,
    media_type: mediaType,
    title: `Stream mirrors for TMDB #${tmdbId}`,
    default_server: sources[0]!.id,
    sources,
  };
}

/**
 * Resolve stream sources for a TMDB title.
 *
 * Phase 5 path: when Supabase env vars are configured the resolver delegates to
 * `getStreamsFromSupabase`, which queries `movie_streams` + `stream_sources` and
 * falls back to the demo embed when the title has no real mirrors yet.
 *
 * When Supabase is not configured the resolver keeps using the in-memory seed
 * (with its own demo fallback), so the app keeps working for development without
 * credentials.
 */
export async function getMovieSources(
  tmdbId: number,
  mediaType: 'movie' | 'tv' = 'movie',
  selection?: StreamSelection,
): Promise<StreamsResponse> {
  if (hasSupabaseConfig()) {
    return getStreamsFromSupabase(tmdbId, selection, mediaType);
  }

  const key = streamKey(tmdbId, mediaType);
  const record = byKey.get(key);
  if (record) {
    // The bundled seed knows nothing about episodes: whatever it holds for a
    // series plays title-level, and saying so lets the watch page label it.
    return { record, fallback: false, sourceScope: 'title' };
  }

  // Un-mirrored title: the standard public embeds, episode-aware for TV when
  // a selection is known (previously this always reported media_type 'movie').
  return { record: buildFallback(tmdbId, mediaType, selection), fallback: true, sourceScope: 'title' };
}

/** All curated records — used by admin/debug surfaces later. */
export function listStreamRecords(): MovieStreamRecord[] {
  return store;
}

/** Look up a specific source inside a record by id. */
export function findSource(
  record: MovieStreamRecord,
  sourceId: string,
): StreamSource | undefined {
  return record.sources.find((source) => source.id === sourceId);
}
