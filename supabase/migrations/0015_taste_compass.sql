-- Smaakkompas: per shot de plek op het kompas en eventueel toegevoegd water.
-- Alle kolommen zijn optioneel, zodat bestaande shots ongemoeid blijven.
-- Idempotent.

-- taste_x: -1 = zuur (onderextractie) tot 1 = bitter (overextractie).
-- taste_y: -1 = waterig tot 1 = zwaar. (0, 0) is raak.
alter table public.shots
  add column if not exists taste_x numeric,
  add column if not exists taste_y numeric,
  add column if not exists water_grams numeric;

alter table public.shots
  drop constraint if exists shots_taste_range_check;

alter table public.shots
  add constraint shots_taste_range_check
    check (
      (taste_x is null and taste_y is null)
      or (taste_x between -1 and 1 and taste_y between -1 and 1)
    );

alter table public.shots
  drop constraint if exists shots_water_grams_check;

alter table public.shots
  add constraint shots_water_grams_check
    check (water_grams is null or water_grams >= 0);
