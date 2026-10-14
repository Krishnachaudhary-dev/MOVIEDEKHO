-- ── MovieDekho — Supabase schema ────────────────────────────────────────────
--
-- One-time setup, run once per Supabase project:
--   Supabase dashboard → SQL Editor → paste this file → Run.
--
-- The admin tool (/admin) writes to these two tables; the player reads them
-- through /api/streams/[tmdbId]. Safe to re-run: everything is idempotent.

create extension if not exists "pgcrypto";

-- One row per title. `tmdb_id` is unique so the admin "find or create" lookup
-- can never produce a duplicate title row.
create table if not exists public.movie_streams (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null unique,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many mirrors per title. `type` matches the StreamSourceType union in
-- lib/types/sources.ts.
create table if not exists public.stream_sources (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movie_streams (id) on delete cascade,
  server_name text not null,
  url text not null,
  type text not null check (type in ('embed', 'm3u8', 'mp4')),
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

-- The player orders sources by priority for a given movie.
create index if not exists stream_sources_movie_id_priority_idx
  on public.stream_sources (movie_id, priority desc);

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
