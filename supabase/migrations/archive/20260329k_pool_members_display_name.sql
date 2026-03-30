-- Add display_name to pool_members.
-- Allows storing a human-readable name for both app users and external (non-account) members.
-- Nullable: existing rows and app-user rows without an explicit name stay NULL.

ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS display_name TEXT;
