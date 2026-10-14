'use server';

import { revalidatePath } from 'next/cache';

import type {
  PostgrestError,
  SupabaseClient,
} from '@supabase/supabase-js/dist/index.cjs';

import { isAdminAuthenticated } from '@/app/actions/auth';
import { describeSupabaseError, getSupabaseClient } from '@/lib/supabase';

export interface AddMovieStreamResult {
  ok: boolean;
  movieId?: string;
  error?: string;
}

const ALLOWED_TYPES = ['embed', 'm3u8', 'mp4'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function parsePositiveInteger(value: FormDataEntryValue | null | undefined, fieldName: string): number {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is required.`);
  }
  if (typeof value === 'object') {
    throw new Error(`${fieldName} must be a number, not a file.`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return n;
}

/**
 * An optional season/episode field. `undefined` means "left blank" — a
 * series-wide server — while a blank string is treated the same way so an
 * untouched input never reads as an error.
 */
function parseOptionalIndex(
  value: FormDataEntryValue | null | undefined,
  fieldName: string,
  min: number,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object') {
    throw new Error(`${fieldName} must be a number, not a file.`);
  }
  const raw = String(value).trim();
  if (raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(
      `${fieldName} must be a whole number of ${min} or more — or left blank for a series-wide server.`,
    );
  }
  return n;
}

/**
 * Find the title row for a (tmdb id, media type) pair.
 *
 * Returns `mediaTypeColumnMissing` so the caller can insert without the column
 * on a project that has not run the migration yet — the save still works there,
 * it just keeps the old one-row-per-id behaviour.
 */
async function findTitleRow(
  supabase: SupabaseClient,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<{
  data: { id: string } | null;
  error: PostgrestError | null;
  mediaTypeColumnMissing: boolean;
}> {
  const { data, error } = await supabase
    .from('movie_streams')
    .select('id')
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .single();

  if (error?.code !== '42703') {
    return { data, error, mediaTypeColumnMissing: false };
  }

  console.warn(
    'movie_streams has no media_type column yet — saving against the tmdb_id row. Re-run supabase/schema.sql to separate movies from series that share an id.',
  );

  const legacy = await supabase
    .from('movie_streams')
    .select('id')
    .eq('tmdb_id', tmdbId)
    .single();

  return { data: legacy.data, error: legacy.error, mediaTypeColumnMissing: true };
}

export async function addMovieStream(
  _previousState: AddMovieStreamResult,
  formData: FormData,
): Promise<AddMovieStreamResult> {
  try {
    // The page shell is gated already, but a server action is a public POST
    // endpoint: verify the session here too so an unlocked browser is not the
    // only thing standing between the internet and an insert.
    if (!(await isAdminAuthenticated())) {
      return {
        ok: false,
        error: 'Your admin session has expired. Unlock /admin again and retry.',
      };
    }

    const tmdbId = parsePositiveInteger(formData.get('tmdbId'), 'TMDB ID');
    const title = String(formData.get('title') ?? '').trim();
    const serverName = String(formData.get('serverName') ?? '').trim();
    const url = String(formData.get('url') ?? '').trim();
    const typeRaw = String(formData.get('type') ?? '');
    const priority = parsePositiveInteger(formData.get('priority'), 'Priority');
    const mediaTypeRaw = String(formData.get('mediaType') ?? 'movie').trim();
    if (mediaTypeRaw !== 'movie' && mediaTypeRaw !== 'tv') {
      return { ok: false, error: "Media type must be 'movie' or 'tv'." };
    }
    const mediaType: 'movie' | 'tv' = mediaTypeRaw;
    const seasonNumber = parseOptionalIndex(
      formData.get('seasonNumber'),
      'Season',
      0,
    );
    const episodeNumber = parseOptionalIndex(
      formData.get('episodeNumber'),
      'Episode',
      1,
    );

    // Half a selection is meaningless (and the schema's check constraint would
    // reject it), so say so plainly instead of letting Postgres explain it.
    if ((seasonNumber === undefined) !== (episodeNumber === undefined)) {
      return {
        ok: false,
        error:
          'Season and episode must be filled in together, or both left blank for a server that covers the whole series.',
      };
    }

    if (!title) {
      return { ok: false, error: 'Movie title is required.' };
    }
    if (!serverName) {
      return { ok: false, error: 'Server name is required.' };
    }
    if (!url) {
      return { ok: false, error: 'Video URL is required.' };
    }
    if (!ALLOWED_TYPES.includes(typeRaw as AllowedType)) {
      return { ok: false, error: `Source type must be one of: ${ALLOWED_TYPES.join(', ')}.` };
    }
    if (mediaType === 'movie' && seasonNumber !== undefined) {
      return {
        ok: false,
        error:
          'A movie has no episodes — clear the season and episode, or switch the media type to TV.',
      };
    }

    const supabase = getSupabaseClient();

    // The title row is keyed by (tmdb_id, media_type), so the lookup has to say
    // which one is meant — otherwise adding a mirror for a series could attach
    // it to a film that happens to share the id.
    const { data: existing, error: existingError, mediaTypeColumnMissing } =
      await findTitleRow(supabase, tmdbId, mediaType);

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('addMovieStream: title lookup failed', existingError);
      return {
        ok: false,
        error: describeSupabaseError(
          'Failed to look up the title record',
          existingError,
        ),
      };
    }

    let movieId: string;
    if (existing?.id) {
      movieId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('movie_streams')
        .insert({
          tmdb_id: tmdbId,
          title,
          // Omitted on a project that has not migrated: the table has no such
          // column there, and one row per tmdb_id is all it can hold.
          ...(mediaTypeColumnMissing ? {} : { media_type: mediaType }),
        })
        .select('id')
        .single();

      if (insertError) {
        // Report the provider's own message (missing table, RLS denial, bad
        // key, …) instead of a generic string — this is what the admin sees.
        console.error('addMovieStream: title insert failed', insertError);
        return {
          ok: false,
          error: describeSupabaseError(
            'Failed to create the title record',
            insertError,
          ),
        };
      }
      if (!inserted?.id) {
        return { ok: false, error: 'The title record was not created.' };
      }
      movieId = inserted.id;
    }

    const { error: sourcesError } = await supabase.from('stream_sources').insert({
      movie_id: movieId,
      server_name: serverName,
      url,
      type: typeRaw as 'embed' | 'm3u8' | 'mp4',
      priority,
      // Sent only when an episode was given, so a project that has not re-run
      // schema.sql yet keeps saving title-level sources; an episode-scoped save
      // reports the missing columns (code 42703) instead of silently dropping
      // the episode.
      ...(seasonNumber !== undefined && episodeNumber !== undefined
        ? { season_number: seasonNumber, episode_number: episodeNumber }
        : {}),
    });

    if (sourcesError) {
      console.error('addMovieStream: source insert failed', sourcesError);
      return {
        ok: false,
        error: describeSupabaseError('Failed to save stream source', sourcesError),
      };
    }

    revalidatePath('/admin');
    revalidatePath('/');

    return { ok: true, movieId };
  } catch (error) {
    console.error('addMovieStream: unexpected error', error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
}
