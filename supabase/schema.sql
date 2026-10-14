-- ── MovieDekho — Supabase schema ────────────────────────────────────────────
--
-- One-time setup, run once per Supabase project:
--   Supabase dashboard → SQL Editor → paste this file → Run.
--
-- The admin tool (/admin) writes to these two tables; the player reads them
-- through /api/streams/[tmdbId] and through the watch page. Safe to re-run: the
-- create statements are idempotent and the migration block below upgrades a
-- project that predates `media_type` and the per-episode columns.

create extension if not exists "pgcrypto";

-- One row per title, keyed by the TMDB id *and* the media type. TMDB numbers
-- movies and series in separate namespaces — the same id is routinely both a
-- film and a show — so `media_type` is part of the key rather than a label.
create table if not exists public.movie_streams (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null,
  media_type text not null default 'movie',
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many mirrors per title. `type` matches the StreamSourceType union in
-- lib/types/sources.ts. `movie_id` points at a title row, which is now either
-- a movie or a series; the name is kept for compatibility with existing rows.
create table if not exists public.stream_sources (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movie_streams (id) on delete cascade,
  server_name text not null,
  url text not null,
  type text not null check (type in ('embed', 'm3u8', 'mp4')),
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

-- The player orders sources by priority for a given title.
create index if not exists stream_sources_movie_id_priority_idx
  on public.stream_sources (movie_id, priority desc);

-- ── Migration: separate movies from TV by id ────────────────────────────────
-- A fresh project already has the column and the composite key from the create
-- above; for an older project these statements are what upgrade it, and they are
-- no-ops when it is already current.
alter table public.movie_streams
  add column if not exists media_type text not null default 'movie';

-- The original table had a plain unique(tmdb_id). It has to go, or a film and a
-- series that share an id can never both be stored. Postgres named it
-- `movie_streams_tmdb_id_key` because it was declared inline.
--
-- If this table was ever created outside this file, a differently named
-- constraint on tmdb_id alone can survive this drop. Confirm none is left:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.movie_streams'::regclass and contype = 'u';
--
-- …and drop anything still unique on tmdb_id by itself:
--
--   alter table public.movie_streams drop constraint <that name>;
--
alter table public.movie_streams
  drop constraint if exists movie_streams_tmdb_id_key;
alter table public.movie_streams
  drop constraint if exists movie_streams_tmdb_id_media_type_key;
alter table public.movie_streams
  add constraint movie_streams_tmdb_id_media_type_key
  unique (tmdb_id, media_type);

-- `media_type` is a two-value enum in all but name.
alter table public.movie_streams
  drop constraint if exists movie_streams_media_type_check;
alter table public.movie_streams
  add constraint movie_streams_media_type_check
  check (media_type in ('movie', 'tv'));

-- Rows that predate the column are labelled 'movie'. Anything the admin tool
-- added before this migration was labelled the same way, so a series entered
-- back then needs correcting once — for example:
--
--   update public.movie_streams set media_type = 'tv'
--   where tmdb_id in (1399, 1396) and media_type = 'movie';

-- ── Migration: episode-scoped mirrors (TV) ──────────────────────────────────
-- Both columns null  → the mirror serves the title as a whole: every movie, and
--                      any episode of a series (many embeds carry their own
--                      episode picker). This is what every row before this
--                      migration is, which is what makes it backward compatible.
-- Both columns set   → the mirror serves exactly that episode, and takes
--                      precedence over the title-level mirror for it.
alter table public.stream_sources
  add column if not exists season_number integer;
alter table public.stream_sources
  add column if not exists episode_number integer;

-- Enforce the pairing in the database, not just in the admin form. Dropped
-- first because `add constraint` has no `if not exists`.
alter table public.stream_sources
  drop constraint if exists stream_sources_episode_pair_check;
alter table public.stream_sources
  add constraint stream_sources_episode_pair_check
  check ((season_number is null) = (episode_number is null));

-- The watch page asks for "this title's row for this exact episode".
create index if not exists stream_sources_episode_idx
  on public.stream_sources (movie_id, season_number, episode_number);

-- ── Row-level security ──────────────────────────────────────────────────────
-- Reads are public (the player runs with the anon key). There is deliberately
-- no insert/update/delete policy: writes must come from the service-role key,
-- which bypasses RLS. Set SUPABASE_SERVICE_ROLE_KEY in the deployment env for
-- the admin save flow to work.

alter table public.movie_streams enable row level security;
alter table public.stream_sources enable row level security;

drop policy if exists "movie_streams are publicly readable" on public.movie_streams;
create policy "movie_streams are publicly readable"
  on public.movie_streams for select
  using (true);

drop policy if exists "stream_sources are publicly readable" on public.stream_sources;
create policy "stream_sources are publicly readable"
  on public.stream_sources for select
  using (true);
