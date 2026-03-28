-- Standalone Debt System
-- Direct person-to-person lending/borrowing (not tied to pools)

-- ── debts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount            NUMERIC NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL DEFAULT 'USD',
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'paid', 'disputed', 'cancelled')),
  confirmed_by_from BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_by_to   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date          DATE,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

CREATE INDEX IF NOT EXISTS debts_from_user_id_idx ON public.debts (from_user_id);
CREATE INDEX IF NOT EXISTS debts_to_user_id_idx   ON public.debts (to_user_id);
CREATE INDEX IF NOT EXISTS debts_status_idx       ON public.debts (status);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Both parties can view the debt
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='debts' AND policyname='Debt parties can view debts') THEN
    CREATE POLICY "Debt parties can view debts"
      ON public.debts FOR SELECT
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
END $$;

-- Anyone can create a debt (as long as they are one of the parties)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='debts' AND policyname='Users can create debts they are party to') THEN
    CREATE POLICY "Users can create debts they are party to"
      ON public.debts FOR INSERT
      WITH CHECK (
        created_by = auth.uid()
        AND (from_user_id = auth.uid() OR to_user_id = auth.uid())
      );
  END IF;
END $$;

-- Both parties can update the debt (for confirmation, status changes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='debts' AND policyname='Debt parties can update debts') THEN
    CREATE POLICY "Debt parties can update debts"
      ON public.debts FOR UPDATE
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
END $$;

-- Only the creator can delete (cancel) a debt
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='debts' AND policyname='Debt creator can delete') THEN
    CREATE POLICY "Debt creator can delete"
      ON public.debts FOR DELETE
      USING (created_by = auth.uid());
  END IF;
END $$;
