-- Add service_type to component_service_records so individual service logs
-- can display the same type icons used by service intervals.
ALTER TABLE public.component_service_records
  ADD COLUMN IF NOT EXISTS service_type text
    CHECK (service_type IN ('general', 'replace', 'cleaning', 'charge', 'pump'));
