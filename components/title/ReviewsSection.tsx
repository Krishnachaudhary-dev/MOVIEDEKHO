"use client";

/**
 * ReviewsSection — the title page review feed.
 *
 * Two coexisting streams:
 * - TMDB reviews (read-only, server-fetched props).
 * - Visitor comments with a 1–5 star rating, persisted to localStorage under
 *   `moviedekho:comments/{titleKey}`. There is no account/write API yet, so
 *   these are explicitly device-local — the composer says so in its label,
 *   keeping the persistence model honest in the UI.
 */

import { Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface LeanReview {
  id: string;
  author: string;
  username: string;
  avatarPath: string | null;
  /** 0–10 or null. */
  rating: number | null;
  content: string;
  createdAt: string;
  url: string;
}

interface LocalComment {
  key: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface ReviewsSectionProps {
  /** Trimmed TMDB reviews passed from the server component. */
  tmdbReviews: LeanReview[];
  titleKey: string;
  /** Free-form label, e.g. "MovieDekho film 603". */
  titleKeyLabel: string;
}

const COMMENTS_KEY_PREFIX = "moviedekho:comments:";
const MAX_COMMENT_LENGTH = 2000;

function commentsStorageKey(titleKey: string): string {
  return `${COMMENTS_KEY_PREFIX}${titleKey}`;
}

function readComments(titleKey: string): LocalComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(commentsStorageKey(titleKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as LocalComment[]).sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        )
      : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** 1–5 star row; TMDB ratings (0–10) are shown as numeric badges instead. */
function StarRow({ value, onChange }: { value: number; onChange?: (next: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange?.(star)}
          className={`${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
        >
          <Star
            className={`size-4 ${star <= value ? "fill-rating-mid text-rating-mid" : "text-faint"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsSection({ tmdbReviews, titleKey, titleKeyLabel }: ReviewsSectionProps) {
  const [comments, setComments] = useState<LocalComment[] | null>(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Comments live in browser storage: load after mount so hydration matches.
  // The read is deferred a tick — storage access is browser-only state and
  // the pending frame renders the pre-hydration silence meanwhile.
  useEffect(() => {
    const timer = setTimeout(() => setComments(readComments(titleKey)), 0);
    return () => clearTimeout(timer);
  }, [titleKey]);

  const submit = () => {
    const text = draftText.trim();
    if (!text) {
      setError("Write something before posting.");
      return;
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      setError(`Keep it under ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }
    if (draftRating < 1 || draftRating > 5) {
      setError("Pick a star rating.");
      return;
    }

    // Local-only store: a generated key keeps delete stable across renders.
    const comment: LocalComment = {
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      rating: draftRating,
      text,
      createdAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(
        commentsStorageKey(titleKey),
        JSON.stringify([comment, ...readComments(titleKey)]),
      );
      setComments(readComments(titleKey));
      setDraftText("");
      setDraftRating(0);
      setError(null);
    } catch {
      setError("Could not save your comment — browser storage may be full.");
    }
  };

  const remove = (key: string) => {
    const next = readComments(titleKey).filter((comment) => comment.key !== key);
    try {
      window.localStorage.setItem(commentsStorageKey(titleKey), JSON.stringify(next));
    } finally {
      setComments(next);
    }
  };

  return (
    <section aria-label="Reviews" className="space-y-6">
      <h2 className="text-lg font-bold uppercase tracking-wider text-muted sm:text-xl">Reviews</h2>

      {/* Visitor comments */}
      <div className="rounded-xl bg-surface p-4 sm:p-6">
        <p className="text-sm font-semibold text-foreground">
          Leave a comment{" "}
          <span className="font-normal text-faint">
            (saved on this device — {titleKeyLabel})
          </span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <StarRow value={draftRating} onChange={setDraftRating} />
          <span className="text-xs text-faint">{draftRating > 0 ? `${draftRating}/5` : ""}</span>
        </div>
        <textarea
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder="What did you think?"
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          className="mt-2 w-full resize-y rounded-lg border border-surface-hover bg-black/20 px-3 py-2 text-sm text-foreground outline-none placeholder:text-faint focus:border-brand/60"
        />
        {error ? <p className="mt-1 text-xs text-rating-low">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover"
          >
            Post comment
          </button>
        </div>

        {comments === null ? (
          // Pre-hydration silence rather than a flash of "no comments".
          <div className="mt-4 space-y-2" aria-hidden />
        ) : comments.length === 0 ? (
          <p className="mt-4 text-sm text-faint">No comments yet — be the first.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {comments.map((comment) => (
              <li key={comment.key} className="rounded-lg bg-surface-raised p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StarRow value={comment.rating} />
                    <span className="text-xs text-muted">
                      {formatDate(comment.createdAt) ?? "Just now"}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => remove(comment.key)}
                    className="rounded p-1 text-faint transition hover:text-rating-low"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {comment.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* TMDB reviews */}
      {tmdbReviews.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted">
            Reviews from TMDB{" "}
            <span className="font-normal text-faint">
              ({tmdbReviews.length})
            </span>
          </p>
          <ul className="space-y-3">
            {tmdbReviews.map((review) => (
              <li key={review.id} className="rounded-xl bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  {review.avatarPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.avatarPath}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full bg-surface-raised object-cover"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-surface-raised text-xs font-bold uppercase text-brand">
                      {review.author.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{review.author}</p>
                    <p className="text-xs text-faint">
                      @{review.username}
                      {formatDate(review.createdAt) ? ` · ${formatDate(review.createdAt)}` : ""}
                    </p>
                  </div>
                  {review.rating !== null && review.rating > 0 ? (
                    <span className="ml-auto rounded bg-surface-raised px-2 py-0.5 text-xs font-bold text-rating-mid">
                      {review.rating.toFixed(1)}/10
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {review.content}
                </p>
                <a
                  href={review.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                >
                  Read full review on TMDB →
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
