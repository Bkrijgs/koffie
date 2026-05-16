-- Smaak-tags per shot: optionele chips (fruitig, noten, chocolade, ...)
-- die de barista gebruikt om tag-patronen per boon te herkennen. Idempotent.

alter table public.shots
  add column if not exists tags text[] not null default '{}';

create index if not exists shots_tags_gin_idx
  on public.shots using gin(tags);
