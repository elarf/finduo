-- ============================================================
-- Add metadata column to finmed_reminder_logs for slot tracking
-- ============================================================

-- Add metadata JSONB column to store slot index for multiple_times_daily reminders
ALTER TABLE public.finmed_reminder_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index on metadata for efficient querying
CREATE INDEX IF NOT EXISTS idx_finmed_reminder_logs_metadata
  ON public.finmed_reminder_logs USING gin(metadata);

COMMENT ON COLUMN public.finmed_reminder_logs.metadata IS
  'JSON metadata for reminder logs. For multiple_times_daily reminders, contains { slotIndex: number } to track which time slot (0=first, 1=second, etc.) this log refers to.';
