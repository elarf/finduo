-- FinGo: add 'charge' to service_type allowed values
alter table component_service_intervals
  drop constraint if exists component_service_intervals_service_type_check;

alter table component_service_intervals
  add constraint component_service_intervals_service_type_check
  check (service_type in ('general', 'replace', 'cleaning', 'charge'));
