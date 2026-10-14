-- ── MovieDekho — repair stale provider URLs ─────────────────────────────────
--
-- Run in the Supabase SQL editor once, whenever a provider moves its path:
--   Dashboard → SQL Editor → paste this file → Run.
--
-- Why: `stream_sources` stores the whole embed URL that was entered at the
-- time. When Embed.su / AutoEmbed / VidSrc move a path, every row for that
-- provider is quietly dead — the "only VidSrc works" symptom. This script
-- rebuilds those URLs from the TMDB id the row already carries.
--
-- Dry run first (recommended): the whole script is one transaction, so change
-- the final `commit;` to `rollback;`, run it, and read step 3 — that grid is the
-- confirmation. Nothing is stored. Change it back to `commit;` and run again to
-- apply.
--
-- Shapes written — the same ones the app builds in `lib/sources.ts`:
--   Embed.su    movies https://embed.su/embed/movie/{tmdbId}
--               TV     https://embed.su/embed/tv/{tmdbId}/{season}/{episode}
--   AutoEmbed   movies https://player.autoembed.cc/embed/movie/{tmdbId}
--               TV     https://player.autoembed.cc/embed/tv/{tmdbId}/{season}/{episode}
--   VidSrc CC   movies https://vidsrc.cc/v2/embed/movie/{tmdbId}
--               TV     https://vidsrc.cc/v2/embed/tv/{tmdbId}/{season}/{episode}
--   VidSrc XYZ  movies https://vidsrc.xyz/embed/movie/{tmdbId}
--               TV     https://vidsrc.xyz/embed/tv/{tmdbId}/{season}/{episode}
--
-- What it touches: only `type = 'embed'` rows whose URL *host* is one of those
-- providers. Matching on the host rather than the server name is deliberate —
-- an m3u8 mirror someone happened to name "AutoEmbed" stays untouched. A series
-- row with no season/episode is a title-level mirror, so it is pointed at S1E1
-- (still a valid embed URL; add an episode-scoped row in /admin to pin an
-- episode). `vidsrc.to` is deliberately left alone — it is the one that works.

begin;

-- ── 1. Every provider-owned row, with the URL it should have ────────────────
drop table if exists stream_url_rewrite;

create temporary table stream_url_rewrite as
with candidates as (
  select
    s.id as source_id,
    m.tmdb_id,
    m.media_type,
    s.season_number,
    s.episode_number,
    s.server_name,
    s.url as old_url,
    case
      when h.host = 'embed.su' or h.host like '%.embed.su' then 'Embed.su'
      when h.host = 'autoembed.cc' or h.host like '%.autoembed.cc' then 'AutoEmbed'
      when h.host = 'vidsrc.cc' or h.host like '%.vidsrc.cc' then 'VidSrc CC'
      when h.host = 'vidsrc.xyz' or h.host like '%.vidsrc.xyz' then 'VidSrc XYZ'
    end as provider
  from public.stream_sources s
  join public.movie_streams m on m.id = s.movie_id
  -- The host, lower-cased and stripped of its port: `embed.su:443/embed/...`
  -- and `EMBED.SU/...` are the same provider as `embed.su`.
  cross join lateral (
    select lower(split_part(split_part(split_part(s.url, '://', 2), '/', 1), ':', 1)) as host
  ) h
  where s.type = 'embed'
)
select
  c.provider,
  c.source_id,
  c.tmdb_id,
  c.media_type,
  c.season_number,
  c.episode_number,
  c.server_name,
  c.old_url,
  case c.provider
    when 'Embed.su' then 'https://embed.su/embed/'
    when 'AutoEmbed' then 'https://player.autoembed.cc/embed/'
    when 'VidSrc CC' then 'https://vidsrc.cc/v2/embed/'
    when 'VidSrc XYZ' then 'https://vidsrc.xyz/embed/'
  end
  || case
       when c.media_type = 'tv'
         then 'tv/' || c.tmdb_id || '/'
              || coalesce(c.season_number, 1) || '/' || coalesce(c.episode_number, 1)
       else 'movie/' || c.tmdb_id
     end as new_url
from candidates c
where c.provider is not null;

-- ── 2. Write the corrected URLs back (no-op rows are left untouched) ────────
update public.stream_sources s
set url = r.new_url
from stream_url_rewrite r
where s.id = r.source_id
  and s.url is distinct from r.new_url;

-- ── 3. Read this: what was found, and which rows actually changed ───────────
select
  r.provider,
  r.tmdb_id,
  r.media_type,
  r.season_number as season,
  r.episode_number as episode,
  r.server_name,
  r.old_url,
  r.new_url,
  (r.old_url is distinct from r.new_url) as changed
from stream_url_rewrite r
order by r.provider, r.media_type, r.tmdb_id, r.episode_number;

-- ── 4. Rows that mention a provider but were NOT rewritten — check by hand ──
-- Either the host is something else entirely (a mirror that was merely *named*
-- "AutoEmbed") or the host is the provider's but `type` is not 'embed', which
-- the player would try to play as a direct file.
select
  m.tmdb_id,
  m.media_type,
  s.server_name,
  s.type,
  s.url,
  case
    when h.host = 'embed.su' or h.host like '%.embed.su'
      or h.host = 'autoembed.cc' or h.host like '%.autoembed.cc'
      or h.host = 'vidsrc.cc' or h.host like '%.vidsrc.cc'
      or h.host = 'vidsrc.xyz' or h.host like '%.vidsrc.xyz'
      then 'provider host but type is not ''embed'''
    else 'named like a provider, but the URL host is not that provider'
  end as why
from public.stream_sources s
join public.movie_streams m on m.id = s.movie_id
cross join lateral (
  select lower(split_part(split_part(split_part(s.url, '://', 2), '/', 1), ':', 1)) as host
) h
where (
    s.server_name ilike '%embed.su%'
    or s.server_name ilike '%autoembed%'
    or s.server_name ilike '%vidsrc cc%'
    or s.server_name ilike '%vidsrc xyz%'
  )
  and not (
    s.type = 'embed'
    and (
      h.host = 'embed.su' or h.host like '%.embed.su'
      or h.host = 'autoembed.cc' or h.host like '%.autoembed.cc'
      or h.host = 'vidsrc.cc' or h.host like '%.vidsrc.cc'
      or h.host = 'vidsrc.xyz' or h.host like '%.vidsrc.xyz'
    )
  )
order by m.tmdb_id, s.priority desc;

commit;

-- Step 3's grid is the record of what changed: it lists every provider-owned
-- row with its old URL, its new URL and a `changed` flag, so nothing else has to
-- be diffed by hand.
--
-- After an *applied* run (the `commit;` variant) the table behind that grid
-- survives for the rest of the session, so in the same SQL-editor session you
-- can ask it again:
--   select provider, tmdb_id, old_url, new_url
--   from stream_url_rewrite
--   where old_url is distinct from new_url
--   order by provider, tmdb_id;
-- A dry run rolls that table back along with everything else — there the grid
-- from the run itself is the only copy.
