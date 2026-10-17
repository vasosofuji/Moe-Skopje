-- Мое Скопје: Supabase schema (spec §5.4, trimmed by spec §11: no citizen reports).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- The only table is source_snapshots (last good payload per layer, the "stale" step of the fallback chain).
-- All writes go through Next.js route handlers / lib/server with the service-role key, which bypasses RLS.
-- RLS is on and there is no policy, so the anon key can read and write nothing.

create table if not exists public.source_snapshots (
  source_id  text primary key,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.source_snapshots enable row level security;

-- Clean-up for a project that ran the pre-§11 schema. Uncomment once to drop the report tables, function and photo bucket
-- (this deletes any stored reports; nothing in the app reads them any more).
-- drop function if exists public.vote_report(uuid, text);
-- drop table if exists public.report_votes;
-- drop table if exists public.reports;
-- delete from storage.objects where bucket_id = 'report-photos';
-- delete from storage.buckets where id = 'report-photos';
