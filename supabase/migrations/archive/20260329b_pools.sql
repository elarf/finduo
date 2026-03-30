-- =============================================================================
-- Migration: Pool system — pools, pool_members, pool_transactions
-- =============================================================================

-- 1. pools table
CREATE TABLE IF NOT EXISTS public.pools (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('event', 'continuous')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE,
  end_date   DATE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- 2. pool_members join table
CREATE TABLE IF NOT EXISTS public.pool_members (
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pool_id, user_id)
);

ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;

-- 3. pool_transactions table
CREATE TABLE IF NOT EXISTS public.pool_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pool_transactions ENABLE ROW LEVEL SECURITY;

-- indexes
CREATE INDEX IF NOT EXISTS idx_pool_members_user_id ON public.pool_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_transactions_pool_id ON public.pool_transactions(pool_id);

-- =============================================================================
-- RLS: users can only access pools they are members of
-- Drop existing policies first (idempotent re-run)
-- =============================================================================

DROP POLICY IF EXISTS "Members can view their pools" ON public.pools;
DROP POLICY IF EXISTS "Authenticated users can create pools" ON public.pools;
DROP POLICY IF EXISTS "Creator can update pool" ON public.pools;
DROP POLICY IF EXISTS "Creator can delete pool" ON public.pools;
DROP POLICY IF EXISTS "Members can view pool members" ON public.pool_members;
DROP POLICY IF EXISTS "Pool creator can add members" ON public.pool_members;
DROP POLICY IF EXISTS "Creator can remove or user can leave" ON public.pool_members;
DROP POLICY IF EXISTS "Members can view pool transactions" ON public.pool_transactions;
DROP POLICY IF EXISTS "Members can add pool transactions" ON public.pool_transactions;
DROP POLICY IF EXISTS "Payer can delete pool transaction" ON public.pool_transactions;

-- pools: SELECT
CREATE POLICY "Members can view their pools"
  ON public.pools FOR SELECT TO authenticated
  USING (
    id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

-- pools: INSERT (creator must exist, and creator auto-added as member via app logic)
CREATE POLICY "Authenticated users can create pools"
  ON public.pools FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- pools: UPDATE (only creator)
CREATE POLICY "Creator can update pool"
  ON public.pools FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- pools: DELETE (only creator)
CREATE POLICY "Creator can delete pool"
  ON public.pools FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- pool_members: SELECT (members see co-members)
CREATE POLICY "Members can view pool members"
  ON public.pool_members FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
  );

-- pool_members: INSERT (only pool creator can add members)
CREATE POLICY "Pool creator can add members"
  ON public.pool_members FOR INSERT TO authenticated
  WITH CHECK (
    pool_id IN (SELECT p.id FROM public.pools p WHERE p.created_by = auth.uid())
  );

-- pool_members: DELETE (pool creator can remove, or user can leave)
CREATE POLICY "Creator can remove or user can leave"
  ON public.pool_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR pool_id IN (SELECT p.id FROM public.pools p WHERE p.created_by = auth.uid())
  );

-- pool_transactions: SELECT (pool members)
CREATE POLICY "Members can view pool transactions"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
  );

-- pool_transactions: INSERT (pool members, only as themselves)
CREATE POLICY "Members can add pool transactions"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
  );

-- pool_transactions: DELETE (only the person who paid)
CREATE POLICY "Payer can delete pool transaction"
  ON public.pool_transactions FOR DELETE TO authenticated
  USING (paid_by = auth.uid());
