-- Add excluded_account_ids to user_preferences for per-user account exclusion from overview.
-- This allows shared account members to independently control which accounts appear in their overview.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS excluded_account_ids TEXT[] NOT NULL DEFAULT '{}';
