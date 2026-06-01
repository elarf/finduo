-- ============================================================
-- FINMED: Add max_repeat_window_minutes for MyTherapy-style escalating notifications
-- ============================================================

-- Add max_repeat_window_minutes column to finmed_reminders
-- Default to 120 minutes (2 hours) for escalating notifications
ALTER TABLE public.finmed_reminders
  ADD COLUMN IF NOT EXISTS max_repeat_window_minutes INTEGER DEFAULT 120;

-- Update type constraint to include 'custom' reminder type
ALTER TABLE public.finmed_reminders
  DROP CONSTRAINT IF EXISTS finmed_reminders_type_check;

ALTER TABLE public.finmed_reminders
  ADD CONSTRAINT finmed_reminders_type_check
  CHECK (type IN ('medication', 'measurement', 'symptom_check', 'appointment', 'custom'));

-- Add comment explaining the column
COMMENT ON COLUMN public.finmed_reminders.max_repeat_window_minutes IS
  'Maximum time window (in minutes) for escalating 5-minute repeat notifications. After this window, reminder is marked as missed. Default: 120 minutes (2 hours).';
