-- Fix FinGo: ensure auto_add_asset_owner trigger exists.
-- PostgREST surfaces "violates row-level security" when INSERT succeeds but
-- the SELECT policy (is_asset_member) denies the RETURNING row.  This happens
-- when the trigger that auto-enrolls the creator into asset_members was never
-- created (original migration may have failed before reaching it).

-- ─── Recreate trigger function ───────────────────────────────────────────────

create or replace function public.auto_add_asset_owner()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.asset_members (asset_id, user_id, role, invited_by)
  values (new.id, new.created_by, 'owner', new.created_by)
  on conflict (asset_id, user_id) do nothing;
  return new;
end;
$$;

-- ─── Recreate trigger (drop first so it's idempotent) ────────────────────────

drop trigger if exists trg_auto_add_asset_owner on public.assets;

create trigger trg_auto_add_asset_owner
  after insert on public.assets
  for each row execute function public.auto_add_asset_owner();
