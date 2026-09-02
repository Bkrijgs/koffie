-- Cadeau-vinkje op beans: cadeau-zakken tellen niet mee in de uitgaven,
-- maar de (geschatte winkel)prijs blijft bruikbaar voor waardevergelijking.
-- Idempotent — safe to re-run.

alter table public.beans
  add column if not exists gift boolean;
