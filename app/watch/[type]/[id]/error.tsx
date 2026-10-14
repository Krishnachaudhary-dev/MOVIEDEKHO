'use client';

/**
 * `/watch` error boundary.
 *
 * A render failure inside the watch page (stream-record resolution throwing,
 * a player integration bug) gets this segment-local recovery card; the
 * in-player error overlay handles *playback* failures — this covers the page
 * itself failing to render.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, TriangleAlert } from 'lucide-react';

export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/watch] render error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface-raised p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rating-low/10">
          <TriangleAlert className="size-8 text-rating-low" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm text-muted">
          The watch page hit an unexpected error while loading. If a video
          itself fails, use the server switcher on the player.
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
