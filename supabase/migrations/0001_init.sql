-- Koffie schema: beans + shots
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query)
-- or via `supabase db push` if you use the Supabase CLI.

create extension if not exists "pgcrypto";

create table if not exists public.beans (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  roaster     text,
  origin      text,
  roast_date  date,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.shots (
  id                       uuid primary key default gen_random_uuid(),
  bean_id                  uuid not null references public.beans(id) on delete cascade,
  grind_size               text        not null,
  dose_grams               numeric(6,2) not null,
  yield_grams              numeric(6,2) not null,
  brew_ratio               numeric(6,2) not null,
  extraction_time_seconds  integer     not null,
  notes                    text,
  next_adjustment          text,
  rating                   smallint    not null check (rating between 1 and 5),
  created_at               timestamptz not null default now()
);

create index if not exists shots_bean_id_idx     on public.shots (bean_id);
create index if not exists shots_created_at_idx  on public.shots (created_at desc);
create index if not exists beans_created_at_idx  on public.beans (created_at desc);

-- Row Level Security
-- The MVP is single-user / unauthenticated, so we allow anon read+write.
-- Tighten this once auth is added (e.g. add a user_id column + auth.uid() policies).
alter table public.beans  enable row level security;
alter table public.shots  enable row level security;

drop policy if exists "anon read beans"   on public.beans;
drop policy if exists "anon write beans"  on public.beans;
drop policy if exists "anon read shots"   on public.shots;
drop policy if exists "anon write shots"  on public.shots;

create policy "anon read beans"   on public.beans for select using (true);
create policy "anon write beans"  on public.beans for insert with check (true);
create policy "anon read shots"   on public.shots for select using (true);
create policy "anon write shots"  on public.shots for insert with check (true);
