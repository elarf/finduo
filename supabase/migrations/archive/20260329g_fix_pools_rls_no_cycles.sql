-- Fix: break ALL circular RLS dependencies between pools ↔ pool_members.
-- PostgreSQL traces dependency chains at plan time (even through SECURITY DEFINER),
-- so the ONLY fix is: pool_members policies must NEVER reference pools (or itself).
--
-- Strategy:
--   pool_members policies: only check user_id = auth.uid() (no cross-table refs)
--   pools policies: CAN reference pool_members (one-way, no cycle)
--   pool_transactions: CAN reference pool_members (one-way, no cycle)
--   For loading co-members: SECURITY DEFINER RPC function (bypasses RLS entirely)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Drop everything from previous attempts
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view their pools"         ON public.pools;
DROP POLICY IF EXISTS "Authenticated users can create pools" ON public.pools;
DROP POLICY IF EXISTS "Creator can update pool"              ON public.pools;
DROP POLICY IF EXISTS "Creator can delete pool"              ON public.pools;

DROP POLICY IF EXISTS "Members can view pool members"        ON public.pool_members;
DROP POLICY IF EXISTS "Pool creator can add members"         ON public.pool_members;
DROP POLICY IF EXISTS "Creator can remove or user can leave" ON public.pool_members;

DROP POLICY IF EXISTS "Members can view pool transactions"   ON public.pool_transactions;
DROP POLICY IF EXISTS "Members can add pool transactions"    ON public.pool_transactions;
DROP POLICY IF EXISTS "Payer can delete pool transaction"    ON public.pool_transactions;

DROP FUNCTION IF EXISTS public.pool_is_member(UUID);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. pool_members: simple user_id checks ONLY (no cross-table refs!)
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
-- 3. pools: references pool_members (safe — pool_members won't cycle back)
-- ═══════════════════════════════════════════════════════════════════════
CREATE POLICY "pools_select" ON public.pools
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

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
-- 4. pool_transactions: references pool_members (safe — no cycle)
-- ═══════════════════════════════════════════════════════════════════════
CREATE POLICY "ptx_select" ON public.pool_transactions
  FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_insert" ON public.pool_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_delete" ON public.pool_transactions
  FOR DELETE TO authenticated
  USING (paid_by = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- 5. RPC function: load ALL members of a pool (bypasses RLS)
--    Only returns data if the caller is actually a member.
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
