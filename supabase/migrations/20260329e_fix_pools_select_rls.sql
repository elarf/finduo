-- Fix: createPool fails with 500 because the creator can't SELECT their own pool
-- immediately after INSERT (before they are added as a member).
-- Extend the pools SELECT policy to also allow the creator to see their own pools.

DROP POLICY IF EXISTS "Members can view their pools" ON public.pools;

CREATE POLICY "Members can view their pools"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );
