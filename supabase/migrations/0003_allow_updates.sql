-- Allow anonymous clients to update beans + shots so the UI can edit
-- existing rows. Idempotent — safe to re-run.

drop policy if exists "anon update beans"  on public.beans;
drop policy if exists "anon update shots"  on public.shots;

create policy "anon update beans"  on public.beans for update using (true) with check (true);
create policy "anon update shots"  on public.shots for update using (true) with check (true);
