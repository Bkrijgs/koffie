-- Mark a shot as a dial-in attempt so it doesn't count in averages,
-- top-shot detection, streaks or trends. Idempotent.

alter table public.shots
  add column if not exists dial_in boolean not null default false;

create index if not exists shots_effective_idx
  on public.shots (bean_id) where dial_in = false;
