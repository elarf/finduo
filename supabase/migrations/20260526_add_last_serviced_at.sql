-- Add last_serviced_at to component_service_intervals for date-based progress calculation.
-- This allows progress to be computed by summing usage_logs after this date,
-- so that editing a ride or service date correctly affects the displayed progress.
ALTER TABLE component_service_intervals
  ADD COLUMN IF NOT EXISTS last_serviced_at TIMESTAMPTZ DEFAULT NULL;
