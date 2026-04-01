-- =============================================================================
-- FIX: Eliminate RLS infinite recursion
-- Generated 2026-03-30
--
-- ROOT CAUSES:
--
-- 1. "Members can view co-members" on account_members
--    USING ( account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) )
--    → queries the SAME table the policy lives on → direct infinite recursion.
--
-- 2. "Users see own and connected categories" on categories performs a self-join
--    on account_members (am1 JOIN am2). While this is not self-referential on
--    categories itself, evaluating that query triggers the account_members SELECT
--    RLS policy from (1) → chained recursion.
--
-- FIX STRATEGY:
--   • account_members SELECT becomes TERMINAL: only `user_id = auth.uid()`.
--   • A SECURITY DEFINER function get_connected_user_ids() does the co-member
--     self-join outside of RLS context (safe — function is owner-controlled).
--   • categories SELECT policy calls that function instead of the inline join.
--   • A SECURITY DEFINER function get_account_members(UUID) lets the app read
--     all members of a shared account (replaces the visibility previously given
--     by the old "Members can view co-members" policy).
--
-- NO table structure is changed.
-- NO RLS is removed.
-- Security is preserved; only implementation technique changes.
-- =============================================================================


-- ===================================================================
-- STEP 1  Drop the recursive account_members SELECT policy
--         (CHANGED: was self-referencing, now terminal)
-- ===================================================================

DROP POLICY IF EXISTS "Members can view co-members" ON public.account_members;

-- Replacement: TERMINAL — no subqueries, no joins, no cross-table references.
CREATE POLICY "Members can view own membership"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ===================================================================
-- STEP 2  SECURITY DEFINER helper: co-member user IDs
--
--         Runs as the function owner (bypasses RLS on account_members),
--         so the self-join executes against the raw table without
--         triggering any policy recursion.
-- ===================================================================

CREATE OR REPLACE FUNCTION public.get_connected_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT am2.user_id
  FROM   public.account_members am1
  JOIN   public.account_members am2 ON am1.account_id = am2.account_id
  WHERE  am1.user_id = auth.uid()
  AND    am2.user_id <> auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_connected_user_ids() TO authenticated;


-- ===================================================================
-- STEP 3  Fix the categories SELECT policy
--         (CHANGED: replaced inline am1/am2 self-join with function call)
-- ===================================================================

DROP POLICY IF EXISTS "Users see own and connected categories" ON public.categories;

-- Replacement: calls the SECURITY DEFINER function — zero cross-table RLS
-- evaluation inside this policy expression.
CREATE POLICY "Users see own and connected categories"
  ON public.categories FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT public.get_connected_user_ids())
  );


-- ===================================================================
-- STEP 4  SECURITY DEFINER helper: all members of an account
--
--         Replaces the visibility previously granted by the now-removed
--         "Members can view co-members" policy.  The app should call
--         get_account_members(account_id) to list co-members instead of
--         querying account_members directly.
-- ===================================================================

CREATE OR REPLACE FUNCTION public.get_account_members(p_account_id UUID)
RETURNS SETOF public.account_members
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Only expose member list to existing members or the account creator.
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE  account_id = p_account_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE  id = p_account_id AND created_by = auth.uid()
  ) THEN
    RETURN;  -- return empty set; do not raise an error
  END IF;

  RETURN QUERY
    SELECT * FROM public.account_members WHERE account_id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_members(UUID) TO authenticated;


-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
