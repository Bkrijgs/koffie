-- Uitgaven buiten de bonen om: waterfilter, schoonmaakmiddel, ontkalker en de
-- spullen die je voor de opstelling koopt. Bonenkosten blijven afgeleid van
-- beans.price_euros/bag_weight_grams — bonen horen hier dus NIET in, anders
-- tel je ze dubbel. Idempotent — safe to re-run.

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  description   text not null,
  amount_euros  numeric not null check (amount_euros > 0),
  category      text not null default 'onderhoud'
                  check (category in ('onderhoud', 'apparatuur', 'overig')),
  purchased_at  date not null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists expenses_purchased_at_idx
  on public.expenses (purchased_at desc);

alter table public.expenses enable row level security;

drop policy if exists "anon read expenses"   on public.expenses;
drop policy if exists "anon write expenses"  on public.expenses;
drop policy if exists "anon update expenses" on public.expenses;
drop policy if exists "anon delete expenses" on public.expenses;

create policy "anon read expenses"   on public.expenses for select using (true);
create policy "anon write expenses"  on public.expenses for insert with check (true);
create policy "anon update expenses" on public.expenses for update using (true) with check (true);
create policy "anon delete expenses" on public.expenses for delete using (true);

-- De app heeft al een deleteShot, maar er stond nergens een delete-policy.
-- Zonder deze regel verwijdert die call 0 rijen zonder foutmelding: de knop
-- lijkt te werken en doet niets.
drop policy if exists "anon delete shots" on public.shots;
create policy "anon delete shots" on public.shots for delete using (true);
