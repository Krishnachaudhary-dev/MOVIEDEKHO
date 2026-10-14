'use client';

/**
 * AdminGate — passcode screen shown while unauthenticated. The passcode is
 * validated by the `unlockAdmin` server action against ADMIN_PASSCODE; this
 * component never sees the secret.
 */

import { useActionState } from 'react';
import Link from 'next/link';
import { Film, Lock } from 'lucide-react';

import { unlockAdmin, type AdminAuthState } from '@/app/actions/auth';

export default function AdminGate() {
  const [state, formAction, isPending] = useActionState<AdminAuthState, FormData>(
    unlockAdmin,
    { ok: false },
  );

  return (
    <div className="flex min-h-screen flex-col bg-black pt-24 sm:pt-20">
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

      <main className="flex flex-1 items-center justify-center px-6 py-10">
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

            <form action={formAction} className="space-y-4">
              <div>
                <label htmlFor="admin-passcode" className="block text-sm font-medium text-foreground">
                  Passcode
                </label>
                <input
                  id="admin-passcode"
                  name="passcode"
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-surface-hover bg-black px-3 py-2 text-white placeholder:text-faint focus:border-brand focus:outline-none"
                  placeholder="Enter passcode"
                />
              </div>

              {state.error && (
                <p className="text-sm text-rating-low">{state.error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {isPending ? 'Checking…' : 'Unlock Admin'}
                </button>
                <Link
                  href="/"
                  className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  Back
                </Link>
              </div>
            </form>

            <p className="mt-4 text-center text-xs text-muted">
              Access is validated server-side and stored in an HttpOnly cookie.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
