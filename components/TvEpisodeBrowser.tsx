import Image from "next/image";
import Link from "next/link";

import { getStillUrl } from "@/lib/tmdb";

/**
 * TvEpisodeBrowser — the season pills and episode list on a TV watch page.
 *
 * Pure presentation over data the page already fetched, and deliberately a
 * server component: every episode is a real `<Link>`, so the URL is the state
 * (`/watch/tv/1399?season=2&episode=3`), the back button works, and a link can
 * be shared mid-series. No client state to keep in sync with the URL.
 *
 * Episode links turn `prefetch` off: the season list can hold 20+ episodes, and
 * each prefetch costs a server render of the watch shell.
 */

export interface TvEpisodeSummary {
  episode_number: number;
  /** Carried per episode so a link never has to guess its season. */
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
  still_path: string | null;
}

export interface TvSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
}

export interface TvEpisodeBrowserProps {
  /** `/watch/tv/1399` — the route these links stay on. */
  basePath: string;
  seasons: TvSeasonSummary[];
  episodes: TvEpisodeSummary[];
  activeSeason: number | null;
  activeEpisode: number | null;
  /** Shown when there are no episodes to list (TMDB has none, or a failure). */
  emptyMessage?: string;
}

function formatAirDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Fixed locale + UTC so the server-rendered string never drifts.
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function seasonLabel(season: TvSeasonSummary): string {
  return season.season_number === 0 ? "Specials" : season.name || `Season ${season.season_number}`;
}

export default function TvEpisodeBrowser({
  basePath,
  seasons,
  episodes,
  activeSeason,
  activeEpisode,
  emptyMessage,
}: TvEpisodeBrowserProps) {
  return (
    <section className="mt-8" aria-label="Episodes">
      <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-muted sm:text-xl">
        Episodes
      </h2>

      {seasons.length > 0 && (
        <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {seasons.map((season) => {
            const active = season.season_number === activeSeason;
            return (
              <Link
                key={season.season_number}
                // No `episode`: the page resolves the first episode of the
                // season, so a season with an empty episode list still works.
                href={`${basePath}?season=${season.season_number}`}
                aria-current={active ? "true" : undefined}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand text-white"
                    : "bg-surface-raised text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {seasonLabel(season)}
              </Link>
            );
          })}
        </div>
      )}

      {episodes.length === 0 ? (
        <p className="rounded-lg border border-surface-hover bg-surface px-4 py-3 text-sm text-muted">
          {emptyMessage ?? "No episodes are available for this season yet."}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {episodes.map((episode) => {
            const active = episode.episode_number === activeEpisode;
            const still = getStillUrl(episode.still_path, "w300");
            const airDate = formatAirDate(episode.air_date);
            const runtime = formatRuntime(episode.runtime);

            return (
              <li key={episode.episode_number}>
                <Link
                  href={`${basePath}?season=${episode.season_number}&episode=${episode.episode_number}`}
                  prefetch={false}
                  aria-current={active ? "true" : undefined}
                  className={`flex h-full gap-3 rounded-lg border p-2 transition ${
                    active
                      ? "border-brand bg-brand/10"
                      : "border-surface-hover bg-surface-raised hover:bg-surface-hover"
                  }`}
                >
                  <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-surface">
                    {still ? (
                      <Image
                        src={still}
                        alt=""
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-faint">
                        {episode.episode_number}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      <span className="mr-2 text-muted">
                        {episode.season_number === 0
                          ? `S0 E${episode.episode_number}`
                          : `E${episode.episode_number}`}
                      </span>
                      {episode.name || `Episode ${episode.episode_number}`}
                    </p>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                      {airDate ? <span>{airDate}</span> : null}
                      {runtime ? <span>{runtime}</span> : null}
                      {episode.vote_average > 0 ? (
                        <span>{episode.vote_average.toFixed(1)} / 10</span>
                      ) : null}
                      {active ? <span className="text-brand">Now playing</span> : null}
                    </p>

                    {episode.overview ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/70">
                        {episode.overview}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
