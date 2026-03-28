-- Pool System
-- Shared expense splitting with settlement and debt tracking.
-- Pool types: event (single settlement closes pool) or continuous (multiple snapshots).
-- Pool data is completely separate from regular account transactions.

-- ── pools ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('event', 'continuous')),
  currency      TEXT NOT NULL DEFAULT 'USD',
  icon          TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'settled', 'archived')),
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date    DATE,
  end_date      DATE,
  settled_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pools_created_by_idx ON public.pools (created_by);
CREATE INDEX IF NOT EXISTS pools_status_idx     ON public.pools (status);

ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- ── pool_members ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id   UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member'
            CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS pool_members_pool_id_idx ON public.pool_members (pool_id);
CREATE INDEX IF NOT EXISTS pool_members_user_id_idx ON public.pool_members (user_id);

ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;

-- ── pool_expenses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  split_among UUID[],
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pool_expenses_pool_id_idx ON public.pool_expenses (pool_id);
CREATE INDEX IF NOT EXISTS pool_expenses_paid_by_idx ON public.pool_expenses (paid_by);

ALTER TABLE public.pool_expenses ENABLE ROW LEVEL SECURITY;

-- ── pool_settlements ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  settled_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balances    JSONB NOT NULL,
  transfers   JSONB NOT NULL,
  expense_ids UUID[] NOT NULL,
  settled_at  TIMESTAMPTZ DEFAULT now(),
  note        TEXT
);

CREATE INDEX IF NOT EXISTS pool_settlements_pool_id_idx ON public.pool_settlements (pool_id);

ALTER TABLE public.pool_settlements ENABLE ROW LEVEL SECURITY;

-- ── pool_debts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_debts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id           UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  settlement_id     UUID NOT NULL REFERENCES public.pool_settlements(id) ON DELETE CASCADE,
  from_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount            NUMERIC NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'paid', 'disputed')),
  confirmed_by_from BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_by_to   BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pool_debts_pool_id_idx       ON public.pool_debts (pool_id);
CREATE INDEX IF NOT EXISTS pool_debts_settlement_id_idx ON public.pool_debts (settlement_id);
CREATE INDEX IF NOT EXISTS pool_debts_from_user_id_idx  ON public.pool_debts (from_user_id);
CREATE INDEX IF NOT EXISTS pool_debts_to_user_id_idx    ON public.pool_debts (to_user_id);

ALTER TABLE public.pool_debts ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── pools RLS ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pools' AND policyname='Members can view their pools') THEN
    CREATE POLICY "Members can view their pools"
      ON public.pools FOR SELECT
      USING (id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pools' AND policyname='Authenticated users can create pools') THEN
    CREATE POLICY "Authenticated users can create pools"
      ON public.pools FOR INSERT
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pools' AND policyname='Pool owners can update their pools') THEN
    CREATE POLICY "Pool owners can update their pools"
      ON public.pools FOR UPDATE
      USING (
        id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid() AND role = 'owner')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pools' AND policyname='Pool owners can delete their pools') THEN
    CREATE POLICY "Pool owners can delete their pools"
      ON public.pools FOR DELETE
      USING (
        id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid() AND role = 'owner')
      );
  END IF;
END $$;

-- ── pool_members RLS ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_members' AND policyname='Pool members can see co-members') THEN
    CREATE POLICY "Pool members can see co-members"
      ON public.pool_members FOR SELECT
      USING (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_members' AND policyname='Pool owners can add members') THEN
    CREATE POLICY "Pool owners can add members"
      ON public.pool_members FOR INSERT
      WITH CHECK (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'owner')
        OR user_id = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_members' AND policyname='Pool owners or self can remove members') THEN
    CREATE POLICY "Pool owners or self can remove members"
      ON public.pool_members FOR DELETE
      USING (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'owner')
        OR user_id = auth.uid()
      );
  END IF;
END $$;

-- ── pool_expenses RLS ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_expenses' AND policyname='Pool members can view expenses') THEN
    CREATE POLICY "Pool members can view expenses"
      ON public.pool_expenses FOR SELECT
      USING (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_expenses' AND policyname='Pool members can add expenses') THEN
    CREATE POLICY "Pool members can add expenses"
      ON public.pool_expenses FOR INSERT
      WITH CHECK (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
        AND created_by = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_expenses' AND policyname='Expense creators can update own expenses') THEN
    CREATE POLICY "Expense creators can update own expenses"
      ON public.pool_expenses FOR UPDATE
      USING (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_expenses' AND policyname='Expense creators can delete own expenses') THEN
    CREATE POLICY "Expense creators can delete own expenses"
      ON public.pool_expenses FOR DELETE
      USING (created_by = auth.uid());
  END IF;
END $$;

-- ── pool_settlements RLS ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_settlements' AND policyname='Pool members can view settlements') THEN
    CREATE POLICY "Pool members can view settlements"
      ON public.pool_settlements FOR SELECT
      USING (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_settlements' AND policyname='Pool owners can create settlements') THEN
    CREATE POLICY "Pool owners can create settlements"
      ON public.pool_settlements FOR INSERT
      WITH CHECK (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'owner')
        AND settled_by = auth.uid()
      );
  END IF;
END $$;

-- ── pool_debts RLS ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_debts' AND policyname='Debt parties can view debts') THEN
    CREATE POLICY "Debt parties can view debts"
      ON public.pool_debts FOR SELECT
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_debts' AND policyname='Settlement creator can insert debts') THEN
    CREATE POLICY "Settlement creator can insert debts"
      ON public.pool_debts FOR INSERT
      WITH CHECK (
        pool_id IN (SELECT pm.pool_id FROM public.pool_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'owner')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pool_debts' AND policyname='Debt parties can update debts') THEN
    CREATE POLICY "Debt parties can update debts"
      ON public.pool_debts FOR UPDATE
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
END $$;
