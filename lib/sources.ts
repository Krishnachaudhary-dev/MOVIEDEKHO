/** MovieDekho — source resolver (Phase 2 + Phase 5 Supabase path). */
import seed from '@/data/streams.json';
import type {
  MovieStreamRecord,
  StreamSource,
  StreamSourceType,
  StreamsResponse,
} from '@/lib/types/sources';
import { getStreamsFromSupabase } from './supabase-queries';

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

/** Deterministic pseudo-id from the numeric tmdb id — stable across builds. */
function hashId(tmdbId: number): number {
  let x = (tmdbId ^ 0x9e3779b9) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return x;
}

/** Build the demo fallback record when nothing else is available. */
function buildFallback(tmdbId: number): MovieStreamRecord {
  const bucket = hashId(tmdbId) % 100;

  const sources: StreamSource[] = [
    {
      id: 'demo-hls',
      name: 'Demo Stream (HLS)',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      type: 'm3u8',
      quality: 'Auto',
      priority: 100,
    },
    {
      id: 'demo-mp4',
      name: 'Demo Stream (MP4)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      type: 'mp4',
      quality: '720p',
      priority: 60,
    },
  ];

  if (bucket < 40) {
    sources.push({
      id: 'demo-embed',
      name: 'Demo Embedded Player',
      url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
      type: 'embed',
      priority: 40,
    });
  }

  sources.push({
    id: 'demo-server-1',
    name: 'Demo Server 1',
    url: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
    type: 'embed',
    priority: 30,
  });

  return {
    tmdb_id: tmdbId,
    media_type: 'movie',
    title: `Demo streams for TMDB #${tmdbId}`,
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
): Promise<StreamsResponse> {
  if (hasSupabaseConfig()) {
    return getStreamsFromSupabase(tmdbId);
  }

  const key = streamKey(tmdbId, mediaType);
  const record = byKey.get(key) ?? buildFallback(tmdbId);
  return { record, fallback: !byKey.has(key) };
}

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
