-- Fix: ensure the component tracking trigger actually exists, and correct the
-- moving_time unit mismatch (moving_time_delta is in minutes; track_moving_time
-- is in hours per schema — divide by 60 when storing).
--
-- The original trigger in 20260507_fingo_components.sql may never have been
-- created if that migration failed partway through (same pattern that required
-- 20260507_fingo_fix_trigger.sql for auto_add_asset_owner).
-- 20260508_fingo_fix_component_tracking.sql only ran CREATE OR REPLACE FUNCTION
-- but did not recreate the trigger, so it still never fired.

create or replace function public.update_components_on_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.components
  set
    track_distance       = track_distance       + new.usage_delta,
    track_rides          = track_rides          + 1,
    track_moving_time    = track_moving_time    + coalesce(new.moving_time_delta, 0) / 60.0,
    track_elevation_gain = track_elevation_gain + coalesce(new.elevation_delta,   0)
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
