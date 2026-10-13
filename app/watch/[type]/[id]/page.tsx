import { notFound } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/VideoPlayerFixed";
import { getDetailsByType } from "@/lib/tmdb-server";
import { getMovieSources } from "@/lib/sources";
import type { TmdbMovieDetails, TmdbTvDetails } from "@/lib/types/tmdb";
import type { MovieStreamRecord } from "@/lib/types/sources";

type RouteParams = Promise<{ type: string; id: string }>;

async function getDetails(type: string, id: number) {
  const mediaType = type === "movie" ? ("movie" as const) : ("tv" as const);
  return getDetailsByType(mediaType, id);
}

async function getSources(id: number, mediaType: "movie" | "tv") {
  return getMovieSources(id, mediaType);
}

function normalizeTitle(details: TmdbMovieDetails | TmdbTvDetails | null, record: MovieStreamRecord) {
  if (details && "title" in details) return (details as TmdbMovieDetails).title;
  if (details && "name" in details) return (details as TmdbTvDetails).name;
  return record.title;
}

export default async function WatchPage({
  params,
}: {
  params: RouteParams;
}) {
  const { type, id } = await params;
  const tmdbId = Number(id);

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    notFound();
  }

  const mediaType = type === "movie" ? ("movie" as const) : ("tv" as const);

  const [detailsOutcome, sourcesResponse] = await Promise.all([
    getDetails(type, tmdbId),
    getSources(tmdbId, mediaType),
  ]);

  const details = detailsOutcome.ok ? detailsOutcome.data : null;
  const record: MovieStreamRecord = sourcesResponse.record ?? {
    tmdb_id: tmdbId,
    media_type: mediaType,
    title: "Unknown",
    default_server: "",
    sources: [],
  };

  const pageTitle = normalizeTitle(details, record);
  const pageDescription =
    details && "overview" in details && details.overview
      ? (details as { overview: string }).overview
      : "Watch online.";

  const posterPath: string | null =
    details && "poster_path" in details
      ? (details as { poster_path: string | null }).poster_path
      : null;
  const posterSrc = posterPath
    ? `https://image.tmdb.org/t/p/w780${posterPath}`
    : null;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main className="flex-1 relative flex items-center justify-center p-4 sm:p-6">
        {record.sources.length > 0 ? (
          <VideoPlayer title={pageTitle} sources={record.sources} autoplay={false} />
        ) : (
          <NoStreamsFallback title={pageTitle} posterSrc={posterSrc} />
        )}
      </main>

      {details && "overview" in details && details.overview && (
        <section className="max-w-3xl mx-auto px-4 text-sm leading-relaxed text-foreground/80">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-muted">
            Synopsis
          </h2>
          <p className="line-clamp-5">{details.overview}</p>
        </section>
      )}

      <div className="px-4 pb-6 text-center text-xs text-muted">
        Streams are provided by third-party mirrors and may be unavailable.
      </div>
    </div>
  );
}

function NoStreamsFallback({
  title,
  posterSrc,
}: {
  title: string;
  posterSrc: string | null;
}) {
  return (
    <div className="relative flex min-h-[70vh] w-full items-center justify-center p-6">
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black via-black/80 to-black/20" />

      <div className="relative z-10 flex max-w-lg flex-col items-center gap-4 text-center">
        <div className="relative h-56 w-full max-w-md overflow-hidden rounded-xl bg-surface">
          {posterSrc ? (
            <img src={posterSrc} alt={title} className="size-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              <span>No poster</span>
            </div>
          )}
        </div>

        <h1 className="text-3xl font-black">{title}</h1>
        <p className="text-muted">No streams available for this title yet.</p>

        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-lg bg-brand px-6 py-2.5 font-bold text-white transition hover:bg-brand-hover"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    </div>
  );
}
