-- Мое Скопје: Supabase schema (spec §5.4).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- All writes go through Next.js route handlers with the service-role key, which bypasses RLS.
-- RLS is on for every table; the only public access is reading reports (minus device_hash) with the anon key.

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

-- The policy above exposes every row, so also limit which COLUMNS anon can read: device_hash is the
-- rate-limit pseudonym, and with the anon key public it would let anyone link all reports from one device.
-- Revoking the table-level select first also drops any column grants, so this block is re-runnable.
-- A NEW column is private until it is added to this list: grant it explicitly if the public should see it.
revoke select on public.reports from anon;
grant select (id, category, description, lat, lng, photo_path, nickname, status, upvotes, created_at)
  on public.reports to anon;

-- Report photos: public read, uploads only via the service role.
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict do nothing;
