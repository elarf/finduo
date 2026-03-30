-- ═══════════════════════════════════════════════════════════════════════
-- COMPREHENSIVE RLS RESET — pools / pool_members / pool_transactions / debts
-- ═══════════════════════════════════════════════════════════════════════
--
-- PROBLEM:
--   "infinite recursion detected in policy for relation pool_members"
--   caused by circular policy dependencies:
--     pool_members policy → is_pool_owner() → reads pools
--     pools policy → is_pool_member() → reads pool_members → CYCLE
--
--   Even plpgsql SECURITY DEFINER functions DO NOT prevent this on
--   Supabase hosted, because the function owner (supabase_admin) is not
--   a true superuser — PostgreSQL still enforces RLS inside the function.
--
-- SOLUTION:
--   pool_members policies are TERMINAL: they ONLY check column values
--   (user_id = auth.uid()), with ZERO cross-table references.
--
--   All other tables may reference pool_members via direct subqueries,
--   because evaluating pool_members policies will NEVER cascade further.
--
--   Owner operations (add/remove members) use SECURITY DEFINER RPCs
--   called from the frontend — these bypass RLS entirely.
--
-- DEPENDENCY GRAPH (guaranteed acyclic):
--   pool_members  → (nothing)                       TERMINAL ✅
--   pools         → pool_members                    ONE-WAY  ✅
--   pool_transactions → pool_members                ONE-WAY  ✅
--   debts         → pool_members                    ONE-WAY  ✅
--
-- GUARANTEE:
--   ✅ No policy queries its own table (directly or indirectly)
--   ✅ No bidirectional dependency between any two tables
--   ✅ pool_members is a terminal node — no cross-table refs at all
--   ✅ No helper functions in policies — no inlining/bypass concerns
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 0. Drop ALL existing policies (every naming convention from migrations b–n)
-- ───────────────────────────────────────────────────────────────────────

-- pools
DROP POLICY IF EXISTS "pools_select"                         ON public.pools;
DROP POLICY IF EXISTS "pools_insert"                         ON public.pools;
DROP POLICY IF EXISTS "pools_update"                         ON public.pools;
DROP POLICY IF EXISTS "pools_delete"                         ON public.pools;
DROP POLICY IF EXISTS "Members can view their pools"         ON public.pools;
DROP POLICY IF EXISTS "Authenticated users can create pools" ON public.pools;
DROP POLICY IF EXISTS "Creator can update pool"              ON public.pools;
DROP POLICY IF EXISTS "Creator can delete pool"              ON public.pools;
DROP POLICY IF EXISTS "Enable read for pool members"         ON public.pools;

-- pool_members
DROP POLICY IF EXISTS "pm_select"                              ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert"                              ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete"                              ON public.pool_members;
DROP POLICY IF EXISTS "pool_members_select"                    ON public.pool_members;
DROP POLICY IF EXISTS "pool_members_insert"                    ON public.pool_members;
DROP POLICY IF EXISTS "pool_members_delete"                    ON public.pool_members;
DROP POLICY IF EXISTS "Members can view pool members"          ON public.pool_members;
DROP POLICY IF EXISTS "Pool creator can add members"           ON public.pool_members;
DROP POLICY IF EXISTS "Creator can remove or user can leave"   ON public.pool_members;
DROP POLICY IF EXISTS "Enable read for own memberships"        ON public.pool_members;
DROP POLICY IF EXISTS "Enable insert for pool owners"          ON public.pool_members;
DROP POLICY IF EXISTS "Enable delete for self"                 ON public.pool_members;

-- pool_transactions
DROP POLICY IF EXISTS "ptx_select"                           ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_insert"                           ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_update"                           ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete"                           ON public.pool_transactions;
DROP POLICY IF EXISTS "pool_transactions_select"             ON public.pool_transactions;
DROP POLICY IF EXISTS "pool_transactions_insert"             ON public.pool_transactions;
DROP POLICY IF EXISTS "pool_transactions_update"             ON public.pool_transactions;
DROP POLICY IF EXISTS "pool_transactions_delete"             ON public.pool_transactions;
DROP POLICY IF EXISTS "Members can view pool transactions"   ON public.pool_transactions;
DROP POLICY IF EXISTS "Members can add pool transactions"    ON public.pool_transactions;
DROP POLICY IF EXISTS "Payer can delete pool transaction"    ON public.pool_transactions;
DROP POLICY IF EXISTS "Enable read for pool members"         ON public.pool_transactions;

-- debts
DROP POLICY IF EXISTS "Users can view own debts"             ON public.debts;
DROP POLICY IF EXISTS "Pool members can insert debts"        ON public.debts;
DROP POLICY IF EXISTS "Involved users can update debts"      ON public.debts;
DROP POLICY IF EXISTS "debts_select"                         ON public.debts;
DROP POLICY IF EXISTS "debts_insert"                         ON public.debts;
DROP POLICY IF EXISTS "debts_update"                         ON public.debts;

-- Drop old helper functions (no longer used in policies)
DROP FUNCTION IF EXISTS public.is_pool_member(UUID);
DROP FUNCTION IF EXISTS public.is_pool_owner(UUID);
DROP FUNCTION IF EXISTS public.pool_is_member(UUID);
DROP FUNCTION IF EXISTS public.get_pool_members(UUID);
DROP FUNCTION IF EXISTS public.add_pool_member(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.remove_pool_member(UUID);

-- Ensure RLS is enabled
ALTER TABLE public.pools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts              ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────────
-- 1. pool_members — TERMINAL NODE
--
--    Policies ONLY check user_id = auth.uid().
--    ZERO cross-table references. This is what breaks the cycle.
--
--    Consequence: a user can only see/insert/delete their OWN membership
--    rows via direct table access. For the pool owner to add/remove
--    OTHER users, we provide SECURITY DEFINER RPC functions (section 6).
-- ───────────────────────────────────────────────────────────────────────

-- SELECT: user sees only their own membership rows.
-- (Co-members are loaded via get_pool_members() RPC.)
CREATE POLICY "pm_select" ON public.pool_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: user can only insert themselves as a member.
-- (Owner adds others via add_pool_member() RPC.)
CREATE POLICY "pm_insert" ON public.pool_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: user can only remove themselves (leave pool).
-- (Owner removes others via remove_pool_member() RPC.)
CREATE POLICY "pm_delete" ON public.pool_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────
-- 2. pools — references pool_members (safe: pool_members is terminal)
--
--    Subquery: SELECT pool_id FROM pool_members WHERE user_id = auth.uid()
--    This triggers pm_select → user_id = auth.uid() → DONE. No cascade.
-- ───────────────────────────────────────────────────────────────────────

-- SELECT: creator sees own pools; members see pools they belong to.
CREATE POLICY "pools_select" ON public.pools
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

-- INSERT: only the creator.
CREATE POLICY "pools_insert" ON public.pools
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: only the creator.
CREATE POLICY "pools_update" ON public.pools
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: only the creator.
CREATE POLICY "pools_delete" ON public.pools
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ───────────────────────────────────────────────────────────────────────
-- 3. pool_transactions — references pool_members (safe: terminal)
--
--    All access gated by pool membership. The pool creator is always a
--    member (auto-added on creation), so they have access too.
-- ───────────────────────────────────────────────────────────────────────

-- SELECT: pool members see transactions.
CREATE POLICY "ptx_select" ON public.pool_transactions
  FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

-- INSERT: pool members can log expenses (no paid_by restriction — a
-- member may log an expense paid by another member).
CREATE POLICY "ptx_insert" ON public.pool_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

-- UPDATE: only the payer can edit their own transaction.
CREATE POLICY "ptx_update" ON public.pool_transactions
  FOR UPDATE TO authenticated
  USING (paid_by = auth.uid())
  WITH CHECK (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

-- DELETE: only the payer can delete their own transaction.
CREATE POLICY "ptx_delete" ON public.pool_transactions
  FOR DELETE TO authenticated
  USING (paid_by = auth.uid());

-- ───────────────────────────────────────────────────────────────────────
-- 4. debts — references pool_members (safe: terminal)
-- ───────────────────────────────────────────────────────────────────────

-- SELECT: see debts where you are either party.
CREATE POLICY "debts_select" ON public.debts
  FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- INSERT: debts you owe, or pool settlement (membership check).
CREATE POLICY "debts_insert" ON public.debts
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    OR (
      pool_id IS NOT NULL
      AND pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
    )
  );

-- UPDATE: only parties involved (for confirmation).
CREATE POLICY "debts_update" ON public.debts
  FOR UPDATE TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());

-- ───────────────────────────────────────────────────────────────────────
-- 5. SECURITY DEFINER RPC functions
--
--    These run as the function owner (bypasses RLS) and are called from
--    the frontend for operations that the simple policies can't handle.
--    Using CREATE OR REPLACE so pre-existing functions don't block the script.
-- ───────────────────────────────────────────────────────────────────────

-- get_pool_members: returns all members of a pool.
-- Guard: caller must be a member or the pool owner.
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS SETOF public.pool_members
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.pools WHERE id = p_pool_id AND created_by = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.pool_members WHERE pool_id = p_pool_id;
END;
$$;

-- add_pool_member: pool owner adds a member (app user or guest).
CREATE OR REPLACE FUNCTION public.add_pool_member(
  p_pool_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.pool_members;
BEGIN
  -- Guard: only the pool owner can add members
  IF NOT EXISTS (
    SELECT 1 FROM public.pools WHERE id = p_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can add members';
  END IF;

  INSERT INTO public.pool_members (pool_id, user_id, display_name)
  VALUES (p_pool_id, p_user_id, p_display_name)
  RETURNING * INTO result;

  RETURN row_to_json(result);
END;
$$;

-- remove_pool_member: pool owner removes a member by member row id.
CREATE OR REPLACE FUNCTION public.remove_pool_member(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
BEGIN
  SELECT pool_id INTO v_pool_id
  FROM public.pool_members WHERE id = p_member_id;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pools WHERE id = v_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can remove members';
  END IF;

  DELETE FROM public.pool_members WHERE id = p_member_id;
END;
$$;

-- Grant execute to authenticated role so PostgREST can discover them
GRANT EXECUTE ON FUNCTION public.get_pool_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pool_member(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pool_member(UUID) TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
