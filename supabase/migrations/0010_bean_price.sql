-- Aankoopprijs per zak + zakgewicht op beans, voor de prijs/kwaliteit-score.
-- Idempotent — safe to re-run.

alter table public.beans
  add column if not exists price_euros numeric,
  add column if not exists bag_weight_grams numeric;
