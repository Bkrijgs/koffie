-- Inventory tracker: each bean can have one or more bags.
-- A bag with finished_at = null is the currently-open bag.

create table if not exists public.bags (
  id           uuid primary key default gen_random_uuid(),
  bean_id      uuid not null references public.beans(id) on delete cascade,
  grams        numeric(7,1) not null check (grams > 0),
  opened_at    date        not null,
  finished_at  date,
  notes        text,
  created_at   timestamptz not null default now(),
  check (finished_at is null or finished_at >= opened_at)
);

create index if not exists bags_bean_id_idx     on public.bags (bean_id);
create index if not exists bags_open_idx        on public.bags (bean_id) where finished_at is null;
create index if not exists bags_opened_at_idx   on public.bags (opened_at desc);

alter table public.bags enable row level security;

drop policy if exists "anon read bags"   on public.bags;
drop policy if exists "anon write bags"  on public.bags;
drop policy if exists "anon update bags" on public.bags;

create policy "anon read bags"   on public.bags for select using (true);
create policy "anon write bags"  on public.bags for insert with check (true);
create policy "anon update bags" on public.bags for update using (true) with check (true);
