-- ── MovieDekho — bulk-fix stale provider URLs ───────────────────────────────
--
-- Run in the Supabase SQL editor once, after the URLs of a provider change:
--   Dashboard → SQL Editor → paste this file → Run.
--
-- Why: the rows in `stream_sources` store the full embed URL the admin typed at
-- the time. When Embed.su / AutoEmbed / VidSrc move a path (they do, and the
-- old paths keep answering with an error page), every row for that provider is
-- silently dead — exactly the "only VidSrc works" symptom. This script rebuilds
-- those URLs from the TMDB id the row already knows, so nothing has to be
-- re-entered by hand.
--
-- Shapes written (the same table the app's fallback list uses, see
-- `lib/sources.ts`):
--   Embed.su      movies https://embed.su/embed/movie/{tmdbId}
--                 TV     https://embed.su/embed/tv/{tmdbId}/{season}/{episode}
--   AutoEmbed     movies https://player.autoembed.cc/embed/movie/{tmdbId}
--                 TV     https://player.autoembed.cc/embed/tv/{tmdbId}/{season}/{episode}
--   VidSrc CC     movies https://vidsrc.cc/v2/embed/movie/{tmdbId}
--                 TV     https://vidsrc.cc/v2/embed/tv/{tmdbId}/{season}/{episode}
--   VidSrc XYZ    movies https://vidsrc.xyz/embed/movie/{tmdbId}
--                 TV     https://vidsrc.xyz/embed/tv/{tmdbId}/{season}/{episode}
--
-- Notes:
--   * VidSrc (`vidsrc.to`) is intentionally untouched — it is the one that works.
--   * A series row whose `season_number` / `episode_number` are both null is a
--     title-level mirror, so it is pointed at S1E1: the URL stays a valid embed
--     and the player's episode browser decides what actually plays. Add an
--     episode-scoped row in /admin to pin a specific episode.
--   * Only rows that already look like one of these providers are touched,
--     matched on the URL or the server name — hand-added custom mirrors are
--     never rewritten.
--   * The SQL editor runs as the database owner, so RLS (public read, no write
--     policy) does not block this.

begin;

-- ── 1. What is there now (expect: the rows that need fixing) ────────────────
select s.id,
       m.tmdb_id,
       m.media_type,
       s.season_number,
       s.episode_number,
       s.server_name,
       s.url
from public.stream_sources s
join public.movie_streams m on m.id = s.movie_id
where s.url ilike '%embed.su%'
   or s.url ilike '%autoembed%'
   or s.url ilike '%vidsrc.cc%'
   or s.url ilike '%vidsrc.xyz%'
   or s.server_name ilike '%embed.su%'
   or s.server_name ilike '%autoembed%'
   or s.server_name ilike '%vidsrc cc%'
   or s.server_name ilike '%vidsrc xyz%'
order by m.tmdb_id, s.priority desc;

-- ── 2. Embed.su ────────────────────────────────────────────────────────────
update public.stream_sources s
set url = case
    when m.media_type = 'tv' then
      'https://embed.su/embed/tv/' || m.tmdb_id || '/'
        || coalesce(s.season_number, 1) || '/' || coalesce(s.episode_number, 1)
    else
      'https://embed.su/embed/movie/' || m.tmdb_id
  end
from public.movie_streams m
where m.id = s.movie_id
  and (s.url ilike '%embed.su%' or s.server_name ilike '%embed.su%');

-- ── 3. AutoEmbed ───────────────────────────────────────────────────────────
update public.stream_sources s
set url = case
    when m.media_type = 'tv' then
      'https://player.autoembed.cc/embed/tv/' || m.tmdb_id || '/'
        || coalesce(s.season_number, 1) || '/' || coalesce(s.episode_number, 1)
    else
      'https://player.autoembed.cc/embed/movie/' || m.tmdb_id
  end
from public.movie_streams m
where m.id = s.movie_id
  and (s.url ilike '%autoembed%' or s.server_name ilike '%autoembed%');

-- ── 4. VidSrc CC (the /v2 path) ────────────────────────────────────────────
update public.stream_sources s
set url = case
    when m.media_type = 'tv' then
      'https://vidsrc.cc/v2/embed/tv/' || m.tmdb_id || '/'
        || coalesce(s.season_number, 1) || '/' || coalesce(s.episode_number, 1)
    else
      'https://vidsrc.cc/v2/embed/movie/' || m.tmdb_id
  end
from public.movie_streams m
where m.id = s.movie_id
  and (s.url ilike '%vidsrc.cc%' or s.server_name ilike '%vidsrc cc%');

-- ── 5. VidSrc XYZ ──────────────────────────────────────────────────────────
update public.stream_sources s
set url = case
    when m.media_type = 'tv' then
      'https://vidsrc.xyz/embed/tv/' || m.tmdb_id || '/'
        || coalesce(s.season_number, 1) || '/' || coalesce(s.episode_number, 1)
    else
      'https://vidsrc.xyz/embed/movie/' || m.tmdb_id
  end
from public.movie_streams m
where m.id = s.movie_id
  and (s.url ilike '%vidsrc.xyz%' or s.server_name ilike '%vidsrc xyz%');

-- ── 6. What they are now (re-run of step 1 to eyeball the result) ───────────
select s.id,
       m.tmdb_id,
       m.media_type,
       s.season_number,
       s.episode_number,
       s.server_name,
       s.url
from public.stream_sources s
join public.movie_streams m on m.id = s.movie_id
where s.url ilike '%embed.su%'
   or s.url ilike '%autoembed%'
   or s.url ilike '%vidsrc.cc%'
   or s.url ilike '%vidsrc.xyz%'
order by m.tmdb_id, s.priority desc;

commit;

-- Rollback before commit: nothing (the script only commits once, at the end —
-- run `rollback;` instead if step 6 looks wrong). After a commit there is no
-- undo, so keep the step-1 output if you may need to restore the old values.
