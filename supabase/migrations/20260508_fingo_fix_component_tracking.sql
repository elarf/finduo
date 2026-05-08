-- Fix: propagate all usage metrics from usage_logs to installed components.
-- Previously only track_distance and track_rides were updated; moving_time and
-- elevation_gain were never incremented, so intervals based on those methods
-- never counted down.

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
    track_moving_time    = track_moving_time    + coalesce(new.moving_time_delta, 0),
    track_elevation_gain = track_elevation_gain + coalesce(new.elevation_delta,   0)
  where
    installed_on_asset_id = new.asset_id
    and status            = 'installed';
  return new;
end;
$$;
