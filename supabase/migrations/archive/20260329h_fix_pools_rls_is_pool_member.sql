-- Fix infinite recursion in pool RLS policies using SECURITY DEFINER helper.
--
-- Root cause: pools policy → pool_members → pools creates a cycle at plan time.
--
-- Solution:
--   1. is_pool_member(pool_id) runs as postgres (superuser), bypasses RLS entirely.
--      It queries pool_members directly — no policy evaluation, no cycle.
--   2. pools SELECT uses is_pool_member(id) — one-way, safe.
--   3. pool_members policies only check user_id = auth.uid() — no cross-table refs.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Drop all existing pool policies (from previous migrations)
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "pools_select"   ON public.pools;
DROP POLICY IF EXISTS "pools_insert"   ON public.pools;
DROP POLICY IF EXISTS "pools_update"   ON public.pools;
DROP POLICY IF EXISTS "pools_delete"   ON public.pools;

DROP POLICY IF EXISTS "pm_select"      ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert"      ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete"      ON public.pool_members;

DROP POLICY IF EXISTS "ptx_select"     ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_insert"     ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete"     ON public.pool_transactions;

-- Also drop any earlier naming conventions
DROP POLICY IF EXISTS "Members can view their pools"          ON public.pools;
DROP POLICY IF EXISTS "Authenticated users can create pools"  ON public.pools;
DROP POLICY IF EXISTS "Creator can update pool"               ON public.pools;
DROP POLICY IF EXISTS "Creator can delete pool"               ON public.pools;

DROP POLICY IF EXISTS "Members can view pool members"         ON public.pool_members;
DROP POLICY IF EXISTS "Pool creator can add members"          ON public.pool_members;
DROP POLICY IF EXISTS "Creator can remove or user can leave"  ON public.pool_members;

DROP POLICY IF EXISTS "Members can view pool transactions"    ON public.pool_transactions;
DROP POLICY IF EXISTS "Members can add pool transactions"     ON public.pool_transactions;
DROP POLICY IF EXISTS "Payer can delete pool transaction"     ON public.pool_transactions;

-- Drop previous helper functions
DROP FUNCTION IF EXISTS public.pool_is_member(UUID);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. SECURITY DEFINER helper: is_pool_member(pool_id uuid)
--    Runs as postgres (superuser) → bypasses RLS on pool_members.
--    No policy is evaluated inside this function, so no cycle is possible.
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_pool_member(p_pool_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pool_members
    WHERE pool_id = p_pool_id
      AND user_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. pool_members: user_id = auth.uid() only — NO cross-table references.
--    This is what prevents any cycle: pool_members never looks at pools.
-- ═══════════════════════════════════════════════════════════════════════
CREATE POLICY "pm_select" ON public.pool_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pm_insert" ON public.pool_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pm_delete" ON public.pool_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- 4. pools: use is_pool_member(id) for SELECT.
--    is_pool_member bypasses RLS → no cycle back through pool_members.
-- ═══════════════════════════════════════════════════════════════════════
CREATE POLICY "pools_select" ON public.pools
  FOR SELECT TO authenticated
  USING (is_pool_member(id));

CREATE POLICY "pools_insert" ON public.pools
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_update" ON public.pools
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_delete" ON public.pools
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- 5. pool_transactions: use is_pool_member for consistency.
--    is_pool_member bypasses RLS → no cycle possible.
-- ═══════════════════════════════════════════════════════════════════════
CREATE POLICY "ptx_select" ON public.pool_transactions
  FOR SELECT TO authenticated
  USING (is_pool_member(pool_id));

CREATE POLICY "ptx_insert" ON public.pool_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND is_pool_member(pool_id)
  );

CREATE POLICY "ptx_delete" ON public.pool_transactions
  FOR DELETE TO authenticated
  USING (paid_by = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- 6. RPC: get_pool_members(pool_id) — load ALL members of a pool.
--    SECURITY DEFINER bypasses RLS; guard ensures caller is a member.
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
    AND EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE pool_id = p_pool_id AND user_id = auth.uid()
    );
$$;
