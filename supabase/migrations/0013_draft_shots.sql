-- Concept-shots: een shot loggen (maalgraad, dose, yield, tijd) terwijl de
-- rating nog volgt. Zolang draft = true telt de shot niet mee in gemiddeldes,
-- top-shots, trends of de coach. Idempotent.

alter table public.shots
  add column if not exists draft boolean not null default false;

-- Rating 0 = "nog niet beoordeeld". Dat mag alleen bij een concept of een
-- dial-in shot; een afgeronde shot houdt een halve-ster rating van 0,5–5.
alter table public.shots
  drop constraint if exists shots_rating_check;

alter table public.shots
  add constraint shots_rating_check
    check (
      (rating * 2) = floor(rating * 2)
      and (
        rating between 0.5 and 5
        or (rating = 0 and (draft or dial_in))
      )
    );

-- Concepten worden apart opgehaald (openstaande ratings) en de effective-index
-- moet ze net als dial-ins overslaan.
create index if not exists shots_draft_idx
  on public.shots (created_at desc) where draft = true;

drop index if exists shots_effective_idx;
create index if not exists shots_effective_idx
  on public.shots (bean_id) where dial_in = false and draft = false;
