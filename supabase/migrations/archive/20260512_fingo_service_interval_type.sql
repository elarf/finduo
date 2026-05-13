-- FinGo: add service_type to service intervals
-- Types: general (fix), replace (change), cleaning (wipe)

alter table component_service_intervals
  add column if not exists service_type text not null default 'general'
  check (service_type in ('general', 'replace', 'cleaning'));
