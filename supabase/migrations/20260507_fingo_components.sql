-- FinGo: Component management
-- Introduces the Component model — a physical part with full lifecycle
-- (installed → storage → retired), 5 tracking methods, unlimited nesting,
-- service intervals, and service records.

-- ─── Components ──────────────────────────────────────────────────────────────

create table if not exists public.components (
  id                    uuid primary key default gen_random_uuid(),
  created_by            uuid not null references auth.users(id) on delete cascade,

  -- Library reference (nullable — user can create a fully custom component)
  template_key          text,

  name                  text not null,

  -- Asset type drives storage scoping (bike component → only reusable on bikes)
  asset_type            text not null default 'other',

  -- Hierarchy: top-level components point to the root asset;
  -- sub-components also set installed_on_asset_id = root asset for easy querying
  installed_on_asset_id uuid references public.assets(id) on delete set null,
  parent_component_id   uuid references public.components(id) on delete cascade,

  status                text not null default 'installed'
                          check (status in ('installed', 'storage', 'retired')),

  installed_at          timestamptz,

  -- Accumulated tracking — all five methods always stored simultaneously
  track_distance        numeric not null default 0,       -- km (or asset's distance unit)
  track_moving_time     numeric not null default 0,       -- hours
  track_elapsed_time    numeric not null default 0,       -- hours
  track_rides           int     not null default 0,       -- count
  track_elevation_gain  numeric not null default 0,       -- metres

  picture_url           text,
  notes                 text,
  position              int not null default 0,           -- sort order within parent

  created_at            timestamptz not null default now()
);

-- ─── Component service intervals ─────────────────────────────────────────────

create table if not exists public.component_service_intervals (
  id                    uuid primary key default gen_random_uuid(),
  component_id          uuid not null references public.components(id) on delete cascade,
  name                  text not null,
  tracking_method       text not null
                          check (tracking_method in (
                            'distance', 'moving_time', 'elapsed_time',
                            'rides', 'elevation_gain'
                          )),
  interval_value        numeric not null,
  last_serviced_value   numeric not null default 0,
  created_at            timestamptz not null default now()
);

-- ─── Component service records ────────────────────────────────────────────────

create table if not exists public.component_service_records (
  id           uuid primary key default gen_random_uuid(),
  -- component_id is nullable: service records survive component deletion
  component_id uuid references public.components(id) on delete set null,
  asset_id     uuid not null references public.assets(id) on delete cascade,
  name         text not null,
  serviced_at  timestamptz not null default now(),
  notes        text,
  cost         numeric,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.components                enable row level security;
alter table public.component_service_intervals enable row level security;
alter table public.component_service_records   enable row level security;

-- components: installed → asset membership; storage/retired → own rows only
create policy "components_select" on public.components
  for select using (
    (installed_on_asset_id is not null and is_asset_member(installed_on_asset_id))
    or (installed_on_asset_id is null and created_by = auth.uid())
  );

create policy "components_insert" on public.components
  for insert with check (created_by = auth.uid());

create policy "components_update" on public.components
  for update using (created_by = auth.uid());

create policy "components_delete" on public.components
  for delete using (created_by = auth.uid());

-- service intervals: follow component ownership
create policy "csi_select" on public.component_service_intervals
  for select using (
    exists (
      select 1 from public.components c
      where c.id = component_id and (
        (c.installed_on_asset_id is not null and is_asset_member(c.installed_on_asset_id))
        or (c.installed_on_asset_id is null and c.created_by = auth.uid())
      )
    )
  );

create policy "csi_insert" on public.component_service_intervals
  for insert with check (
    exists (
      select 1 from public.components c
      where c.id = component_id and c.created_by = auth.uid()
    )
  );

create policy "csi_update" on public.component_service_intervals
  for update using (
    exists (
      select 1 from public.components c
      where c.id = component_id and c.created_by = auth.uid()
    )
  );

create policy "csi_delete" on public.component_service_intervals
  for delete using (
    exists (
      select 1 from public.components c
      where c.id = component_id and c.created_by = auth.uid()
    )
  );

-- service records: asset membership
create policy "csr_select" on public.component_service_records
  for select using (is_asset_member(asset_id));

create policy "csr_insert" on public.component_service_records
  for insert with check (is_asset_member(asset_id) and created_by = auth.uid());

create policy "csr_delete" on public.component_service_records
  for delete using (created_by = auth.uid());

-- ─── Trigger: propagate asset usage to installed components ──────────────────
-- Fires on every usage_log insert — increments track_distance and track_rides
-- for all components currently installed on the asset.
-- moving_time / elapsed_time / elevation_gain will be populated once the
-- GoButton activity feature provides those fields.

create or replace function public.update_components_on_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.components
  set
    track_distance   = track_distance + new.usage_delta,
    track_rides      = track_rides    + 1
  where
    installed_on_asset_id = new.asset_id
    and status            = 'installed';
  return new;
end;
$$;

drop trigger if exists trg_update_components_on_usage on public.usage_logs;

create trigger trg_update_components_on_usage
  after insert on public.usage_logs
  for each row execute function public.update_components_on_usage();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_components_asset    on public.components(installed_on_asset_id);
create index if not exists idx_components_parent   on public.components(parent_component_id);
create index if not exists idx_components_owner    on public.components(created_by);
create index if not exists idx_csi_component       on public.component_service_intervals(component_id);
create index if not exists idx_csr_asset           on public.component_service_records(asset_id);
create index if not exists idx_csr_component       on public.component_service_records(component_id);
