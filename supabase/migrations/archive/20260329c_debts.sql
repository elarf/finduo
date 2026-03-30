-- =============================================================================
-- Migration: Debts table for pool settlement and lending
-- =============================================================================

-- Drop and recreate to handle partial previous runs
DROP TABLE IF EXISTS public.debts CASCADE;

CREATE TABLE public.debts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     NUMERIC NOT NULL CHECK (amount > 0),
  pool_id    UUID REFERENCES public.pools(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid')),
  from_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  to_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_debts_from_user ON public.debts(from_user);
CREATE INDEX IF NOT EXISTS idx_debts_to_user ON public.debts(to_user);
CREATE INDEX IF NOT EXISTS idx_debts_pool_id ON public.debts(pool_id);

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Pool members can insert debts" ON public.debts;
DROP POLICY IF EXISTS "Involved users can update debts" ON public.debts;

-- SELECT: see debts where you are either party
CREATE POLICY "Users can view own debts"
  ON public.debts FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- INSERT: only for pools you are a member of (settlement), or direct debts you owe
CREATE POLICY "Pool members can insert debts"
  ON public.debts FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    OR (
      pool_id IS NOT NULL
      AND pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
    )
  );

-- UPDATE: only parties involved (for confirmation)
CREATE POLICY "Involved users can update debts"
  ON public.debts FOR UPDATE TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());
