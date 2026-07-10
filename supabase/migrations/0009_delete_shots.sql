-- Shots kunnen verwijderd worden vanuit de UI (typefout, dubbele log).
-- Zelfde open anon-model als de bestaande policies; aanscherpen zodra
-- auth is toegevoegd. Idempotent — safe to re-run.

drop policy if exists "anon delete shots" on public.shots;
create policy "anon delete shots" on public.shots for delete using (true);
