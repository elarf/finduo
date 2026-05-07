-- Fix FinGo RLS policies — drop and recreate idempotently.
-- Run this if the initial migration left RLS enabled but policies missing
-- (e.g. when the migration was applied more than once and create policy errored).

-- ─── Drop existing policies (ignore if they don't exist) ─────────────────────

drop policy if exists "asset_select"              on public.assets;
drop policy if exists "asset_insert"              on public.assets;
drop policy if exists "asset_update"              on public.assets;
drop policy if exists "asset_delete"              on public.assets;

drop policy if exists "asset_members_select"      on public.asset_members;
drop policy if exists "asset_members_insert"      on public.asset_members;
drop policy if exists "asset_members_delete"      on public.asset_members;

drop policy if exists "asset_parts_select"        on public.asset_parts;
drop policy if exists "asset_parts_insert"        on public.asset_parts;
drop policy if exists "asset_parts_update"        on public.asset_parts;
drop policy if exists "asset_parts_delete"        on public.asset_parts;

drop policy if exists "asset_categories_select"   on public.asset_categories;
drop policy if exists "asset_categories_insert"   on public.asset_categories;
drop policy if exists "asset_categories_delete"   on public.asset_categories;

drop policy if exists "usage_logs_select"         on public.usage_logs;
drop policy if exists "usage_logs_insert"         on public.usage_logs;
drop policy if exists "usage_logs_delete"         on public.usage_logs;

drop policy if exists "part_service_logs_select"  on public.part_service_logs;
drop policy if exists "part_service_logs_insert"  on public.part_service_logs;
drop policy if exists "part_service_logs_delete"  on public.part_service_logs;

-- ─── Recreate helper function ────────────────────────────────────────────────

create or replace function public.is_asset_member(p_asset_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.asset_members
    where asset_id = p_asset_id
      and user_id  = auth.uid()
  )
$$;

-- ─── assets ───────────────────────────────────────────────────────────────────

create policy "asset_select" on public.assets
  for select using (is_asset_member(id));

create policy "asset_insert" on public.assets
  for insert with check (created_by = auth.uid());

create policy "asset_update" on public.assets
  for update using (created_by = auth.uid());

create policy "asset_delete" on public.assets
  for delete using (created_by = auth.uid());

-- ─── asset_members ────────────────────────────────────────────────────────────

create policy "asset_members_select" on public.asset_members
  for select using (is_asset_member(asset_id));

create policy "asset_members_insert" on public.asset_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.assets
      where id = asset_id and created_by = auth.uid()
    )
  );

create policy "asset_members_delete" on public.asset_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.assets
      where id = asset_id and created_by = auth.uid()
    )
  );

-- ─── asset_parts ─────────────────────────────────────────────────────────────

create policy "asset_parts_select" on public.asset_parts
  for select using (is_asset_member(asset_id));

create policy "asset_parts_insert" on public.asset_parts
  for insert with check (is_asset_member(asset_id));

create policy "asset_parts_update" on public.asset_parts
  for update using (is_asset_member(asset_id));

create policy "asset_parts_delete" on public.asset_parts
  for delete using (is_asset_member(asset_id));

-- ─── asset_categories ────────────────────────────────────────────────────────

create policy "asset_categories_select" on public.asset_categories
  for select using (is_asset_member(asset_id));

create policy "asset_categories_insert" on public.asset_categories
  for insert with check (is_asset_member(asset_id));

create policy "asset_categories_delete" on public.asset_categories
  for delete using (is_asset_member(asset_id));

-- ─── usage_logs ──────────────────────────────────────────────────────────────

create policy "usage_logs_select" on public.usage_logs
  for select using (is_asset_member(asset_id));

create policy "usage_logs_insert" on public.usage_logs
  for insert with check (is_asset_member(asset_id) and recorded_by = auth.uid());

create policy "usage_logs_delete" on public.usage_logs
  for delete using (recorded_by = auth.uid());

-- ─── part_service_logs ───────────────────────────────────────────────────────

create policy "part_service_logs_select" on public.part_service_logs
  for select using (
    exists (
      select 1 from public.asset_parts p
      where p.id = part_id and is_asset_member(p.asset_id)
    )
  );

create policy "part_service_logs_insert" on public.part_service_logs
  for insert with check (
    exists (
      select 1 from public.asset_parts p
      where p.id = part_id and is_asset_member(p.asset_id)
    )
  );

create policy "part_service_logs_delete" on public.part_service_logs
  for delete using (
    exists (
      select 1 from public.asset_parts p
      join public.assets a on a.id = p.asset_id
      where p.id = part_id and a.created_by = auth.uid()
    )
  );
