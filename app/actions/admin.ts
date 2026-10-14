'use server';

import { revalidatePath } from 'next/cache';

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

    const supabase = getSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from('movie_streams')
      .select('id')
      .eq('tmdb_id', tmdbId)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('addMovieStream: movie lookup failed', existingError);
      return {
        ok: false,
        error: describeSupabaseError(
          'Failed to look up the movie record',
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
        .insert({ tmdb_id: tmdbId, title })
        .select('id')
        .single();

      if (insertError) {
        // Report the provider's own message (missing table, RLS denial, bad
        // key, …) instead of a generic string — this is what the admin sees.
        console.error('addMovieStream: movie insert failed', insertError);
        return {
          ok: false,
          error: describeSupabaseError(
            'Failed to create movie record',
            insertError,
          ),
        };
      }
      if (!inserted?.id) {
        return { ok: false, error: 'Movie record was not created.' };
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
