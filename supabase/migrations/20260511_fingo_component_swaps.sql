-- FinGo: component swap/installation history
-- Tracks every period a component was installed on an asset so stats can be
-- attributed correctly when a component moves between assets.

create table if not exists component_swaps (
  id           uuid        primary key default gen_random_uuid(),
  component_id uuid        not null references components(id) on delete cascade,
  asset_id     uuid        references assets(id) on delete set null,
  installed_at timestamptz not null,
  removed_at   timestamptz,
  notes        text,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists component_swaps_component_id_idx
  on component_swaps(component_id);

alter table component_swaps enable row level security;

create policy "Users can manage their own component swaps"
  on component_swaps for all
  using  (created_by = auth.uid())
  with check (created_by = auth.uid());
