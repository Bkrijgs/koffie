-- Add a free-text "blend" column to beans (e.g. "100% arabica", "blend").
-- Idempotent — safe to re-run.

alter table public.beans
  add column if not exists blend text;
