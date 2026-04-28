-- Allow half-star ratings (0.5, 1, 1.5, ..., 5).
-- Idempotent — safe to re-run.

alter table public.shots
  alter column rating type numeric(2,1) using rating::numeric(2,1);

alter table public.shots
  drop constraint if exists shots_rating_check;

alter table public.shots
  add constraint shots_rating_check
    check (rating between 0.5 and 5 and (rating * 2) = floor(rating * 2));
