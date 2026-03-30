-- Fix: circular RLS evaluation causes 500 on pools and pool_members SELECT.
-- pools SELECT queries pool_members, whose SELECT policy is self-referential.
-- Solution: SECURITY DEFINER helper function bypasses RLS for membership check.

-- 1. Helper function (runs as table owner, bypasses RLS)
CREATE OR REPLACE FUNCTION public.pool_is_member(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pool_members
    WHERE pool_id = p_pool_id AND user_id = auth.uid()
  );
$$;

-- 2. Re-create pools SELECT policy using the helper
DROP POLICY IF EXISTS "Members can view their pools" ON public.pools;

CREATE POLICY "Members can view their pools"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.pool_is_member(id)
  );

-- 3. Re-create pool_members SELECT policy using the helper (no self-reference)
DROP POLICY IF EXISTS "Members can view pool members" ON public.pool_members;

CREATE POLICY "Members can view pool members"
  ON public.pool_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.pool_is_member(pool_id)
  );

-- 4. Re-create pool_members INSERT policy using the helper
DROP POLICY IF EXISTS "Pool creator can add members" ON public.pool_members;

CREATE POLICY "Pool creator can add members"
  ON public.pool_members FOR INSERT TO authenticated
  WITH CHECK (
    pool_id IN (SELECT id FROM public.pools WHERE created_by = auth.uid())
  );

-- 5. Re-create pool_transactions policies using the helper
DROP POLICY IF EXISTS "Members can view pool transactions" ON public.pool_transactions;
DROP POLICY IF EXISTS "Members can add pool transactions" ON public.pool_transactions;

CREATE POLICY "Members can view pool transactions"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (public.pool_is_member(pool_id));

CREATE POLICY "Members can add pool transactions"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND public.pool_is_member(pool_id)
  );
