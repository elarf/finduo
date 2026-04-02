-- pool_members.user_id must be nullable for external (contact-only) members.
-- The add_pool_member RPC already handles both cases correctly; the NOT NULL
-- constraint on the column is incorrectly blocking external member inserts.
--
-- Also adds a CHECK constraint to preserve data integrity:
--   auth members     → user_id must be set
--   external members → external_name must be set

ALTER TABLE public.pool_members
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.pool_members
  DROP CONSTRAINT IF EXISTS chk_member_type;

ALTER TABLE public.pool_members
  ADD CONSTRAINT chk_member_type CHECK (
    (type = 'auth'     AND user_id IS NOT NULL)
    OR
    (type = 'external' AND external_name IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';
