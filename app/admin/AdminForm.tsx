'use client';

/**
 * AdminForm — the stream-source form shown only to cookie-authenticated
 * admins. Uses the `addMovieStream` server action; the Lock button ends the
 * session via the `lockAdmin` server action and the gate re-renders.
 */

import { useActionState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, Unlock } from 'lucide-react';

import { addMovieStream, type AddMovieStreamResult } from '@/app/actions/admin';
import { lockAdmin } from '@/app/actions/auth';

export default function AdminForm() {
  const [state, formAction, isPending] = useActionState<
    AddMovieStreamResult,
    FormData
  >(addMovieStream, { ok: false });

  return (
    <div className="flex min-h-screen flex-col bg-black pt-24 sm:pt-20">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand/20">
            <Unlock className="size-5 text-brand" />
          </div>
          <h1 className="text-xl font-bold text-white">
            Admin &middot; Add Stream Source
          </h1>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <form action={formAction} className="rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <div className="mb-5 space-y-1.5">
              <h2 className="text-sm font-semibold uppercase text-muted">
                New Stream Source
              </h2>
              <p className="text-xs text-faint">
                Adds or links a movie record and its playback source in Supabase.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <label>
                  <span className="block text-sm font-medium text-foreground">
                    Media Type
                  </span>
                  <select
                    name="mediaType"
                    required
                    defaultValue="movie"
                    className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white focus:border-brand focus:outline-none"
                  >
                    <option value="movie">Movie</option>
                    <option value="tv">TV Show</option>
                  </select>
                  <span className="mt-1.5 block text-xs text-faint">
                    Part of the title&apos;s identity: TMDB reuses ids between
                    movies and shows, so the same number can name both.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="col-span-1">
                    <span className="block text-sm font-medium text-foreground">
                      TMDB ID
                    </span>
                    <input
                      name="tmdbId"
                      type="number"
                      required
                      min="1"
                      className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                      placeholder="550"
                    />
                  </label>
                  <label className="col-span-1">
                    <span className="block text-sm font-medium text-foreground">
                      Title
                    </span>
                    <input
                      name="title"
                      type="text"
                      required
                      className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                      placeholder="Fight Club"
                    />
                  </label>
                </div>

                <label className="col-span-2">
                  <span className="block text-sm font-medium text-foreground">
                    Server Name
                  </span>
                  <input
                    name="serverName"
                    type="text"
                    required
                    className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                    placeholder="Server 1"
                  />
                </label>

                <label className="col-span-2">
                  <span className="block text-sm font-medium text-foreground">
                    Video URL
                  </span>
                  <input
                    name="url"
                    type="url"
                    required
                    className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                    placeholder="https://.../playlist.m3u8"
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="col-span-1">
                    <span className="block text-sm font-medium text-foreground">
                      Source Type
                    </span>
                    <select
                      name="type"
                      required
                      className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white focus:border-brand focus:outline-none"
                    >
                      <option value="m3u8">HLS (m3u8)</option>
                      <option value="mp4">MP4</option>
                      <option value="embed">Embed</option>
                    </select>
                  </label>
                  <label className="col-span-1">
                    <span className="block text-sm font-medium text-foreground">
                      Priority
                    </span>
                    <input
                      name="priority"
                      type="number"
                      required
                      min="0"
                      className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                      placeholder="100"
                    />
                  </label>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="col-span-1">
                      <span className="block text-sm font-medium text-foreground">
                        Season{' '}
                        <span className="text-faint">(TV, optional)</span>
                      </span>
                      <input
                        name="seasonNumber"
                        type="number"
                        min="0"
                        className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                        placeholder="1"
                      />
                    </label>
                    <label className="col-span-1">
                      <span className="block text-sm font-medium text-foreground">
                        Episode{' '}
                        <span className="text-faint">(TV, optional)</span>
                      </span>
                      <input
                        name="episodeNumber"
                        type="number"
                        min="1"
                        className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                        placeholder="3"
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-xs text-faint">
                    Leave both blank for a server that covers the whole title —
                    every movie, and series whose embed picks its own episode.
                    Fill both to register a mirror for one exact episode; it then
                    overrides the title-level server for that episode only. For a
                    movie these must stay blank.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Add Stream Source'}
              </button>
              <button
                type="button"
                // Server-action call; revalidatePath('/admin') inside re-renders
                // the page shell so the gate takes over.
                onClick={() => {
                  void lockAdmin();
                }}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Lock
              </button>
              <Link
                href="/"
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Back
              </Link>
            </div>
          </form>

          {state.ok && (
            <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-5 text-emerald-400" />
                <div>
                  <p className="font-semibold">Stream source saved.</p>
                  {state.movieId ? (
                    <p className="mt-1 text-foreground/80">
                      Linked title record:{' '}
                      <span className="font-mono">{state.movieId}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-foreground/70 text-xs">
                    Changes may take a short moment to appear in the player.
                  </p>
                </div>
              </div>
            </div>
          )}

          {state.error && (
            <div className="mt-4 rounded-xl bg-rating-low/10 border border-rating-low/30 p-4 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 size-5 text-rating-low" />
                <div>
                  <p className="font-semibold">Could not save the stream source.</p>
                  {/* The detail is the provider's own message (missing table,
                      RLS denial, rejected key, …). The configuration note is
                      only appended when the failure really is a
                      missing-configuration one — it used to print
                      unconditionally and mask everything else. */}
                  <p className="mt-1 break-words text-foreground/80">{state.error}</p>
                  {/supabase is not configured/i.test(state.error ?? '') ? (
                    <p className="mt-1 text-foreground/70 text-xs">
                      Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
                      deployment environment, then redeploy.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted">
            This page is meant for setup. Keep Supabase credentials out of client
            bundles.
          </p>
        </div>
      </main>
    </div>
  );
}
