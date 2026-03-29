-- Fix: INSERT on pools fails with RLS violation.
--
-- Two causes:
--   1. created_by had no DEFAULT — if omitted or null, WITH CHECK (created_by = auth.uid())
--      evaluates to NULL (not true) and blocks the insert.
--   2. After INSERT the chained .select().single() uses the SELECT policy.
--      is_pool_member(id) returns false (creator not yet in pool_members), so PostgREST
--      gets an empty result and surfaces it as an RLS violation on some clients.
--
-- Fixes:
--   A. Set created_by DEFAULT auth.uid() — always filled server-side.
--   B. Recreate pools_select to include created_by = auth.uid() so the creator
--      can read their own pool immediately after INSERT (before membership row exists).
--   C. Ensure pools_insert policy is present and unambiguous.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Add server-side default for created_by
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.pools
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Fix SELECT policy — creator can see their pool before membership exists
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "pools_select" ON public.pools;

CREATE POLICY "pools_select" ON public.pools
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR is_pool_member(id)
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Ensure INSERT policy is present and correct
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "pools_insert" ON public.pools;

CREATE POLICY "pools_insert" ON public.pools
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
