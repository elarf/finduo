-- Fix: pool_members INSERT policy causes recursion / blocks pool owner from adding members.
--
-- Problems with current pm_insert (WITH CHECK (user_id = auth.uid())):
--   1. Only allows a user to insert themselves — pool owner cannot add others.
--   2. user_id NOT NULL blocks guest/non-app-user members.
--   3. Any future policy that checks pool_members inside pool_members causes recursion.
--
-- Strategy:
--   - All pool_members policies reference ONLY pools table (one-way, no cycle possible).
--   - user_id becomes nullable so guest members (no account) can be recorded.
--   - Surrogate UUID pk replaces (pool_id, user_id) composite PK (NULLs not allowed in PK).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Schema: add surrogate PK, make user_id nullable
-- ═══════════════════════════════════════════════════════════════════════

-- Add surrogate id (nullable first so it can be backfilled)
ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Backfill any existing rows that got NULL (shouldn't happen with DEFAULT, but be safe)
UPDATE public.pool_members SET id = gen_random_uuid() WHERE id IS NULL;

-- Drop user-FK before making user_id nullable (FK still stays, NULLs are fine in FKs)
-- Drop the composite PK
ALTER TABLE public.pool_members DROP CONSTRAINT IF EXISTS pool_members_pkey;

-- Promote id to primary key
ALTER TABLE public.pool_members ADD PRIMARY KEY (id);

-- Make user_id nullable (allows guest/non-app members)
ALTER TABLE public.pool_members ALTER COLUMN user_id DROP NOT NULL;

-- Partial unique index: at most one row per (pool, user) for real users
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_members_pool_user
  ON public.pool_members (pool_id, user_id)
  WHERE user_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Drop all existing pool_members policies
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "pm_select"                          ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert"                          ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete"                          ON public.pool_members;
DROP POLICY IF EXISTS "Members can view pool members"      ON public.pool_members;
DROP POLICY IF EXISTS "Pool creator can add members"       ON public.pool_members;
DROP POLICY IF EXISTS "Creator can remove or user can leave" ON public.pool_members;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. New pool_members policies — reference pools only, never pool_members
--
--    No policy here queries pool_members itself, so recursion is impossible.
-- ═══════════════════════════════════════════════════════════════════════

-- SELECT: own membership row  OR  owner sees all rows for their pools
CREATE POLICY "pm_select" ON public.pool_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR pool_id IN (SELECT id FROM public.pools WHERE created_by = auth.uid())
  );

-- INSERT: only pool owner can add members (including guests with no user_id)
CREATE POLICY "pm_insert" ON public.pool_members
  FOR INSERT TO authenticated
  WITH CHECK (
    pool_id IN (SELECT id FROM public.pools WHERE created_by = auth.uid())
  );

-- DELETE: member removes themselves  OR  owner removes anyone from their pool
CREATE POLICY "pm_delete" ON public.pool_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR pool_id IN (SELECT id FROM public.pools WHERE created_by = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Update get_pool_members RPC to also allow pool owner to list members
--    (previously required the caller to have a membership row)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS SETOF public.pool_members
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pm.*
  FROM public.pool_members pm
  WHERE pm.pool_id = p_pool_id
    AND (
      -- caller is a member (app user with a row in this pool)
      EXISTS (
        SELECT 1 FROM public.pool_members
        WHERE pool_id = p_pool_id AND user_id = auth.uid()
      )
      -- OR caller is the pool owner
      OR EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id AND created_by = auth.uid()
      )
    );
$$;
