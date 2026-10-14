'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { CheckCircle, XCircle, Film, Lock, Unlock } from 'lucide-react';
import { addMovieStream } from '../actions/admin';

const ADMIN_PASSCODE = 'admin123';

type ActionState = {
  ok: boolean;
  movieId?: string;
  error?: string;
};

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const initialState: ActionState = { ok: false };
  const [state, formAction, isPending] = useActionState(
    addMovieStream,
    initialState,
  );

  const handleUnlock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passcode.trim() === ADMIN_PASSCODE) {
      setPasscodeError(null);
      setUnlocked(true);
    } else {
      setPasscodeError('Incorrect passcode. Try again.');
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand/20">
              <Film className="size-5 text-brand" />
            </div>
            <h1 className="text-xl font-bold text-white">
              Admin &middot; Add Stream Source
            </h1>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl bg-surface-raised p-6 shadow-2xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand/20">
                  <Lock className="size-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Admin access required
                  </h2>
                  <p className="text-xs text-faint">
                    Enter the passcode to manage stream sources.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Passcode
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (passcodeError) setPasscodeError(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                    placeholder="Enter passcode"
                  />
                </div>

                {passcodeError && (
                  <p className="text-sm text-rating-low">{passcodeError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
                  >
                    Unlock Admin
                  </button>
                  <a
                    href="/"
                    className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    Back
                  </a>
                </div>
              </form>

              <p className="mt-4 text-center text-xs text-muted">
                This page is meant for setup. Keep Supabase credentials out of
                client bundles.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
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

      <main className="flex-1 flex items-start justify-center px-6 py-10">
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
                      Movie Title
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
                onClick={() => setUnlocked(false)}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Lock
              </button>
              <a
                href="/"
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Back
              </a>
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
                      Linked movie record:{' '}
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
                  <p className="mt-1 text-foreground/80">{state.error}</p>
                  <p className="mt-1 text-foreground/70 text-xs">
                    Supabase env vars must be configured for the admin tool to work.
                  </p>
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
