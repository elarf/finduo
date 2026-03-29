-- Fix: pool_transactions INSERT blocked for pool owner.
--
-- Root cause: ptx_insert requires is_pool_member(pool_id), which queries
-- pool_members WHERE user_id = auth.uid(). If the creator's membership row
-- was never inserted (e.g., earlier policy migration blocked the auto-add),
-- is_pool_member returns false and blocks every transaction insert.
--
-- Fix: also allow the pool creator directly via pools.created_by.
-- This makes the policy resilient regardless of membership row state.

DROP POLICY IF EXISTS "ptx_insert" ON public.pool_transactions;

CREATE POLICY "ptx_insert" ON public.pool_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND (
      is_pool_member(pool_id)
      OR pool_id IN (SELECT id FROM public.pools WHERE created_by = auth.uid())
    )
  );

-- Mirror the same logic on SELECT so creators can always see their transactions.
DROP POLICY IF EXISTS "ptx_select" ON public.pool_transactions;

CREATE POLICY "ptx_select" ON public.pool_transactions
  FOR SELECT TO authenticated
  USING (
    is_pool_member(pool_id)
    OR pool_id IN (SELECT id FROM public.pools WHERE created_by = auth.uid())
  );
