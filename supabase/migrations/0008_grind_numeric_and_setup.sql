-- 0008: maalgraad numeriek + apparatuur-setup
--
-- De coffee-AI moet machine-specifiek kunnen rekenen. Daarvoor:
--  1. maalgraad van vrije tekst naar een getal op de maler-schaal
--  2. een setup-tabel met de apparatuur (Sage Barista Express e.d.)

-- Maalgraad: bestaande waarden zijn al numeriek; non-numeriek (mocht het
-- voorkomen) valt terug op 5 zodat de NOT NULL-constraint blijft kloppen.
alter table public.shots
  alter column grind_size type numeric using (
    coalesce(nullif(regexp_replace(grind_size, '[^0-9.]', '', 'g'), '')::numeric, 5)
  );

-- Eén-rij tabel met de apparatuur. id is vastgepind op 1 zodat er altijd
-- precies één setup-record is.
create table if not exists public.setup (
  id              int         primary key default 1,
  machine         text        not null default 'Sage Barista Express',
  grinder         text        not null default 'Ingebouwde conische maler',
  grind_min       numeric     not null default 1,
  grind_max       numeric     not null default 16,
  grind_step      numeric     not null default 1,
  default_basket  text        not null default 'double',
  pressurized     boolean     not null default false,
  pressure_gauge  boolean     not null default true,
  pre_infusion    boolean     not null default true,
  pid             boolean     not null default false,
  weighs          boolean     not null default true,
  notes           text,
  updated_at      timestamptz not null default now(),
  constraint setup_singleton check (id = 1)
);

insert into public.setup (id) values (1) on conflict (id) do nothing;

alter table public.setup enable row level security;

drop policy if exists "anon read setup"   on public.setup;
drop policy if exists "anon write setup"  on public.setup;
drop policy if exists "anon update setup" on public.setup;

create policy "anon read setup"   on public.setup for select using (true);
create policy "anon write setup"  on public.setup for insert with check (true);
create policy "anon update setup" on public.setup for update using (true) with check (true);
