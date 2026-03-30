-- Fix infinite recursion in pool_members policies.
--
-- Root cause: LANGUAGE sql SECURITY DEFINER functions CAN be inlined by the PostgreSQL
-- query planner. When inlined, the SECURITY DEFINER context is stripped and the function
-- body runs as the calling user WITH row-level security applied. This creates the cycle:
--
--   pool_members policy
--     → queries pools
--     → pools SELECT policy calls is_pool_member (inlined as plain SQL)
--     → inlined body queries pool_members WITH RLS
--     → pool_members policy fires again → ∞
--
-- Fix: rewrite all helper functions in LANGUAGE plpgsql.
-- plpgsql functions are NEVER inlined — SECURITY DEFINER context always preserved.
--
-- Also:
--   • Add is_pool_owner() helper (plpgsql) so pm_insert/pm_select can check
--     pool ownership without going through pools RLS.
--   • Remove paid_by = auth.uid() restriction from ptx_insert so pool members
--     can log expenses paid by any other member (needed for "who paid?" UX).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Recreate helper functions as plpgsql (not inlinable)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_pool_member(p_pool_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.pool_members
    WHERE pool_id = p_pool_id AND user_id = auth.uid()
  );
END;
$$;

-- is_pool_owner: queries pools as postgres (superuser), bypassing pools RLS.
-- Safe to call from pool_members policies — no cycle possible.
CREATE OR REPLACE FUNCTION public.is_pool_owner(p_pool_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.pools
    WHERE id = p_pool_id AND created_by = auth.uid()
  );
END;
$$;

-- Recreate get_pool_members as plpgsql for the same inlining reason.
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS SETOF public.pool_members
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Guard: only members or the pool owner may list members.
  IF NOT (
    EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.pools WHERE id = p_pool_id AND created_by = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.pool_members WHERE pool_id = p_pool_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Recreate pool_members policies using SECURITY DEFINER helpers only.
--    is_pool_owner() queries pools as postgres → no RLS → no cycle.
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "pm_select" ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert" ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete" ON public.pool_members;

-- Own row always visible; owner sees all their pool's rows.
CREATE POLICY "pm_select" ON public.pool_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_pool_owner(pool_id));

-- Only pool owner may add members.
CREATE POLICY "pm_insert" ON public.pool_members
  FOR INSERT TO authenticated
  WITH CHECK (is_pool_owner(pool_id));

-- Member leaves themselves; owner removes anyone.
CREATE POLICY "pm_delete" ON public.pool_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_pool_owner(pool_id));

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Update pool_transactions policies for "who paid?" feature.
--    Remove paid_by = auth.uid() so a pool member can log an expense
--    paid by any other pool member. Access control is membership only.
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "ptx_insert" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete" ON public.pool_transactions;

CREATE POLICY "ptx_insert" ON public.pool_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    is_pool_member(pool_id) OR is_pool_owner(pool_id)
  );

-- Payer deletes their own, or pool owner deletes any.
CREATE POLICY "ptx_delete" ON public.pool_transactions
  FOR DELETE TO authenticated
  USING (
    paid_by = auth.uid()
    OR is_pool_owner(pool_id)
  );
