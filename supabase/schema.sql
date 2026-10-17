-- Мое Скопје: Supabase schema (spec §5.4).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- All writes go through Next.js route handlers with the service-role key, which bypasses RLS.
-- RLS is on for every table; the only public access is reading reports with the anon key.

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  description text,
  lat         float8 not null,
  lng         float8 not null,
  photo_path  text,
  nickname    text,
  status      text not null default 'new',
  upvotes     int not null default 0,
  device_hash text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.report_votes (
  report_id   uuid not null references public.reports (id) on delete cascade,
  device_hash text not null,
  primary key (report_id, device_hash)
);

create table if not exists public.source_snapshots (
  source_id  text primary key,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Rate limit lookup: "reports from this device in the last hour".
create index if not exists reports_device_hash_created_at_idx
  on public.reports (device_hash, created_at);

alter table public.reports          enable row level security;
alter table public.report_votes     enable row level security;
alter table public.source_snapshots enable row level security;

drop policy if exists "reports are publicly readable" on public.reports;
create policy "reports are publicly readable"
  on public.reports for select
  to anon
  using (true);

-- Report photos: public read, uploads only via the service role.
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict do nothing;

-- Upvote: one vote per device per report, counted atomically (called from POST /api/reports/[id]/vote).
-- A repeat vote violates the report_votes primary key (SQLSTATE 23505), an unknown report violates the
-- foreign key (23503). Both abort the transaction, so upvotes only moves when the vote row is inserted.
create or replace function public.vote_report(p_report_id uuid, p_device_hash text)
returns int
language plpgsql
as $$
declare
  n int;
begin
  insert into public.report_votes (report_id, device_hash) values (p_report_id, p_device_hash);
  update public.reports set upvotes = upvotes + 1 where id = p_report_id returning upvotes into n;
  return n;
end;
$$;

-- Only the service role may vote; anon/authenticated could otherwise call it over PostgREST with any device_hash.
revoke execute on function public.vote_report(uuid, text) from public, anon, authenticated;
grant execute on function public.vote_report(uuid, text) to service_role;
