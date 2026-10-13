/**
 * MovieDekho — streaming-source domain types (Phase 2).
 *
 * The mirror system maps a TMDB title (`tmdb_id` + `media_type`) to an array
 * of external stream sources. Every source points at a third-party host; the
 * player (Phase 4) picks the highest-priority healthy one and offers manual
 * switching when a server buffers or fails.
 */

export type StreamSourceType = "embed" | "m3u8" | "mp4";

export interface StreamSource {
  /** Stable slug used as the URL param for the player, e.g. `server-1`. */
  id: string;
  /** Human label shown in the server selector, e.g. `Server 1 (Primary)`. */
  name: string;
  /**
   * Provider URL, meaning depends on `type`:
   * - `embed`: an iframe-embeddable page (`https://host/embed/{id}`)
   * - `m3u8`: an HLS playlist (`https://host/index.m3u8`)
   * - `mp4`: a progressive MP4 file
   */
  url: string;
  type: StreamSourceType;
  /** Optional display hint, e.g. `1080p`, `HD`, `Auto`. */
  quality?: string;
  /**
   * Higher wins when the player auto-selects. Must be unique within a record;
   * the resolver sorts by it descending.
   */
  priority: number;
}

export interface MovieStreamRecord {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  /** `StreamSource.id` of the source the player opens with. */
  default_server: string;
  sources: StreamSource[];
}

/** What `/api/streams/[tmdbId]` answers with. */
export interface StreamsResponse {
  /** The stream record, or demo fallback when no mirrors are configured. */
  record: MovieStreamRecord;
  /** True when `record` is the demo fallback rather than real mirrors. */
  fallback: boolean;
}
