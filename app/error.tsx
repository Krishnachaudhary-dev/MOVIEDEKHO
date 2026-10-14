'use client';

/**
 * Route-level error boundary — catches render/runtime failures in any page
 * segment and shows a friendly recovery screen (Netflix-style retry).
 */

import { useEffect } from 'react';
import { TriangleAlert, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error for observability without leaking it to users.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface-raised p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rating-low/10">
          <TriangleAlert className="size-8 text-rating-low" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted">
          We hit an unexpected snag loading this page. Try again — if the
          problem sticks around, come back in a few minutes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-hover"
        >
          <RotateCcw className="size-4" />
          Try again
        </button>
      </div>
    </main>
  );
}
