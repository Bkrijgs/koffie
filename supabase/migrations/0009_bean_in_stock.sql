-- Add an "in_stock" flag to beans so an empty bag can be switched off and the
-- bean disappears from the shot log form. Defaults to true so existing beans
-- stay available. Idempotent — safe to re-run.

alter table public.beans
  add column if not exists in_stock boolean not null default true;

-- Helpful when filtering the shot form's bean picker to in-stock beans only.
create index if not exists beans_in_stock_idx on public.beans (in_stock) where in_stock = true;
