-- AI-geschat cafeïnegehalte per boon (mg per gram gemalen koffie in het
-- kopje bij espresso-extractie). Per shot: dose × deze waarde.
-- Idempotent — safe to re-run.

alter table public.beans
  add column if not exists caffeine_mg_per_gram numeric;
