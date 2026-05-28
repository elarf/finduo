-- ============================================================
-- Transaction Splits
-- Allows a single transaction to be attributed to multiple
-- categories (e.g. a grocery run split between Food and Health).
-- ============================================================

-- 1. Add has_splits flag to transactions (default false)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS has_splits BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. transaction_splits table
CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_transaction_id   UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id             UUID        NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount                  NUMERIC     NOT NULL CHECK (amount > 0),
  note                    TEXT,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_transaction_splits_parent ON public.transaction_splits(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category ON public.transaction_splits(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_user ON public.transaction_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_has_splits ON public.transactions(has_splits) WHERE has_splits = TRUE;

-- 4. Trigger: keep transactions.has_splits in sync
CREATE OR REPLACE FUNCTION public.sync_has_splits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.transactions SET has_splits = TRUE WHERE id = NEW.parent_transaction_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.transactions
    SET has_splits = EXISTS (
      SELECT 1 FROM public.transaction_splits WHERE parent_transaction_id = OLD.parent_transaction_id
    )
    WHERE id = OLD.parent_transaction_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_has_splits_insert
  AFTER INSERT ON public.transaction_splits
  FOR EACH ROW EXECUTE FUNCTION public.sync_has_splits();

CREATE OR REPLACE TRIGGER trg_sync_has_splits_delete
  AFTER DELETE ON public.transaction_splits
  FOR EACH ROW EXECUTE FUNCTION public.sync_has_splits();

-- Note: sum-of-splits ≤ parent amount is enforced at the application layer
-- in useSplits.saveSplits() before calling the DB. A DB-level constraint
-- would require a row-level trigger with a full-table aggregate which is
-- expensive; application enforcement is sufficient for this use case.

-- 5. RLS
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- Own rows (inserted by this user)
CREATE POLICY "splits_select_own"
  ON public.transaction_splits FOR SELECT
  USING (
    user_id = auth.uid()
    OR parent_transaction_id IN (
      SELECT t.id FROM public.transactions t
      WHERE t.account_id IN (
        SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "splits_insert_own"
  ON public.transaction_splits FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "splits_update_own"
  ON public.transaction_splits FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "splits_delete_own"
  ON public.transaction_splits FOR DELETE
  USING (user_id = auth.uid());

-- 6. Grants
GRANT ALL ON public.transaction_splits TO authenticated, service_role;
