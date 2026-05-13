-- Add external_id to usage_logs so Health Connect (and future) records can be
-- deduplication-checked after a screen remount.
alter table public.usage_logs
  add column if not exists external_id text;

comment on column public.usage_logs.external_id is
  'Optional opaque ID from the originating data source (e.g. Health Connect record UUID). Used to detect duplicate imports.';
