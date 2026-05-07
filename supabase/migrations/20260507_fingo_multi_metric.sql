-- FinGo: Multi-metric usage tracking
-- Adds per-type metric columns to usage_logs and cumulative totals to assets.
-- Bike:    distance (km) + moving_time (min) + elevation (m) + rides (count)
-- Vehicle: distance (km) + moving_time (min)
-- Shoe:    steps (count)
-- Other:   distance/units

-- ─── usage_logs: add optional metric columns ──────────────────────────────────

alter table public.usage_logs
  add column if not exists moving_time_delta integer,   -- minutes
  add column if not exists elevation_delta   numeric;   -- meters

-- ─── assets: add cumulative metric totals ────────────────────────────────────

alter table public.assets
  add column if not exists total_distance    numeric not null default 0,
  add column if not exists total_moving_time integer not null default 0,  -- minutes
  add column if not exists total_elevation   numeric not null default 0,
  add column if not exists total_rides       integer not null default 0,
  add column if not exists total_steps       integer not null default 0;

-- Seed totals from existing usage_delta rows so history stays accurate
-- (usage_delta was distance for vehicles/bikes, steps for shoes, but we
--  cannot know type retroactively for mixed data — leave at 0 is safest)
