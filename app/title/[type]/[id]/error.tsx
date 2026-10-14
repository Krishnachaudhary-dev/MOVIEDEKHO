'use client';

/**
 * `/title` error boundary.
 *
 * A render failure inside the detail page (TMDB outage between the outcome
 * checks, a component bug) gets this segment-local recovery card instead of
 * bubbling to the root boundary — the shell, navbar and footer stay intact.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, TriangleAlert } from 'lucide-react';

export default function TitleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/title] render error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface-raised p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rating-low/10">
          <TriangleAlert className="size-8 text-rating-low" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">
          Couldn&apos;t load this title
        </h1>
        <p className="mt-2 text-sm text-muted">
          The detail page hit an unexpected error. Try again — TMDB outages
          usually clear within a few minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
          >
            Back to browse
          </Link>
        </div>
      </div>
    </main>
  );
}
