-- FinGo: Asset Lifecycle Manager
-- Tracks wearable assets (cars, bikes, shoes) and their parts,
-- linking usage data and existing FinDuo expenses.

-- ─── Assets ──────────────────────────────────────────────────────────────────

create table if not exists public.assets (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  type          text not null default 'vehicle', -- 'vehicle' | 'bike' | 'shoe' | 'other'
  usage_unit    text not null default 'km',       -- display label for odometer readings
  current_usage numeric not null default 0,
  icon          text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ─── Asset members (sharing — mirrors pool_participants pattern) ──────────────

create table if not exists public.asset_members (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member', -- 'owner' | 'member'
  invited_by uuid references auth.users(id),
  joined_at  timestamptz not null default now(),
  unique (asset_id, user_id)
);

-- ─── Asset parts ─────────────────────────────────────────────────────────────

create table if not exists public.asset_parts (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets(id) on delete cascade,
  name                 text not null,
  usage_unit           text not null default 'km', -- independent unit per part
  reset_interval       numeric not null,            -- e.g. 5000 km, 300 charge_cycles
  usage_at_last_reset  numeric not null default 0,
  priority             int not null default 5 check (priority between 1 and 10),
  warn_at_pct          numeric not null default 0.8,
  notes                text,
  created_at           timestamptz not null default now()
);

-- ─── Asset ↔ FinDuo category link ────────────────────────────────────────────

create table if not exists public.asset_categories (
  asset_id    uuid not null references public.assets(id) on delete cascade,
  category_id uuid not null, -- FK to categories table (existing FinDuo)
  primary key (asset_id, category_id)
);

-- ─── Usage logs ──────────────────────────────────────────────────────────────

create table if not exists public.usage_logs (
  id                 uuid primary key default gen_random_uuid(),
  asset_id           uuid not null references public.assets(id) on delete cascade,
  recorded_by        uuid not null references auth.users(id),
  usage_delta        numeric not null,   -- amount added this entry
  usage_after        numeric not null,   -- asset's total usage after this entry
  source             text not null default 'odometer', -- 'odometer' | 'health_connect' | 'gps'
  recorded_at        timestamptz not null default now(),
  linked_expense_id  uuid,               -- optional FK to transactions
  notes              text
);

-- ─── Part service logs ───────────────────────────────────────────────────────

create table if not exists public.part_service_logs (
  id                 uuid primary key default gen_random_uuid(),
  part_id            uuid not null references public.asset_parts(id) on delete cascade,
  usage_at_service   numeric not null,   -- asset usage reading at time of service
  serviced_at        timestamptz not null default now(),
  linked_expense_id  uuid,               -- optional FK to transactions
  notes              text
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.assets enable row level security;
alter table public.asset_members enable row level security;
alter table public.asset_parts enable row level security;
alter table public.asset_categories enable row level security;
alter table public.usage_logs enable row level security;
alter table public.part_service_logs enable row level security;

-- Helper: is the current user a member of the asset?
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

-- assets: visible to members, writable by owner
create policy "asset_select" on public.assets
  for select using (is_asset_member(id));

create policy "asset_insert" on public.assets
  for insert with check (created_by = auth.uid());

create policy "asset_update" on public.assets
  for update using (created_by = auth.uid());

create policy "asset_delete" on public.assets
  for delete using (created_by = auth.uid());

-- asset_members: members can see their asset's member list; owner manages
create policy "asset_members_select" on public.asset_members
  for select using (is_asset_member(asset_id));

create policy "asset_members_insert" on public.asset_members
  for insert with check (
    user_id = auth.uid()  -- self-join on creation
    or exists (
      select 1 from public.assets
      where id = asset_id and created_by = auth.uid()
    )
  );

create policy "asset_members_delete" on public.asset_members
  for delete using (
    user_id = auth.uid()  -- leave
    or exists (
      select 1 from public.assets
      where id = asset_id and created_by = auth.uid()
    )
  );

-- asset_parts: follow asset membership
create policy "asset_parts_select" on public.asset_parts
  for select using (is_asset_member(asset_id));

create policy "asset_parts_insert" on public.asset_parts
  for insert with check (is_asset_member(asset_id));

create policy "asset_parts_update" on public.asset_parts
  for update using (is_asset_member(asset_id));

create policy "asset_parts_delete" on public.asset_parts
  for delete using (is_asset_member(asset_id));

-- asset_categories: follow asset membership
create policy "asset_categories_select" on public.asset_categories
  for select using (is_asset_member(asset_id));

create policy "asset_categories_insert" on public.asset_categories
  for insert with check (is_asset_member(asset_id));

create policy "asset_categories_delete" on public.asset_categories
  for delete using (is_asset_member(asset_id));

-- usage_logs: follow asset membership
create policy "usage_logs_select" on public.usage_logs
  for select using (is_asset_member(asset_id));

create policy "usage_logs_insert" on public.usage_logs
  for insert with check (is_asset_member(asset_id) and recorded_by = auth.uid());

create policy "usage_logs_delete" on public.usage_logs
  for delete using (recorded_by = auth.uid());

-- part_service_logs: follow part → asset membership
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

-- ─── Auto-add creator as owner member ────────────────────────────────────────

create or replace function public.auto_add_asset_owner()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.asset_members (asset_id, user_id, role, invited_by)
  values (new.id, new.created_by, 'owner', new.created_by);
  return new;
end;
$$;

create trigger trg_auto_add_asset_owner
  after insert on public.assets
  for each row execute function public.auto_add_asset_owner();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_asset_members_user  on public.asset_members(user_id);
create index if not exists idx_asset_members_asset on public.asset_members(asset_id);
create index if not exists idx_asset_parts_asset   on public.asset_parts(asset_id);
create index if not exists idx_asset_categories_asset    on public.asset_categories(asset_id);
create index if not exists idx_asset_categories_category on public.asset_categories(category_id);
create index if not exists idx_usage_logs_asset    on public.usage_logs(asset_id);
create index if not exists idx_part_service_logs_part on public.part_service_logs(part_id);
