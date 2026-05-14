-- balance_snapshots: monthly running balance checkpoints per account.
-- Fixes balance drift when transactions exceed the 1000-row client fetch limit.

CREATE TABLE IF NOT EXISTS public.balance_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  snapshot_date DATE        NOT NULL,   -- last day of the month
  balance       BIGINT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date)
);

ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_snapshots_member_all" ON public.balance_snapshots
  FOR ALL USING (is_account_member(account_id));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.balance_snapshots TO authenticated, service_role;

-- refresh_account_snapshots: recomputes monthly snapshots for an account.
-- p_from_date: if provided, only recomputes snapshots from that month onward
--              (invalidation on edit/delete). If NULL, full recompute from scratch.
CREATE OR REPLACE FUNCTION public.refresh_account_snapshots(
  p_account_id uuid,
  p_from_date  date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from_month   date;
  v_base_balance bigint;
BEGIN
  IF NOT is_account_member(p_account_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_from_date IS NULL THEN
    -- Full recompute: wipe all existing snapshots and rebuild from oldest transaction
    DELETE FROM balance_snapshots WHERE account_id = p_account_id;
    v_from_month := (
      SELECT date_trunc('month', MIN(date))::date
      FROM transactions WHERE account_id = p_account_id
    );
    IF v_from_month IS NULL THEN RETURN; END IF;
    SELECT COALESCE(initial_balance, 0)::bigint INTO v_base_balance
    FROM account_settings WHERE account_id = p_account_id;
  ELSE
    -- Partial recompute: delete snapshots from p_from_date's month onward, reuse earlier ones
    v_from_month := date_trunc('month', p_from_date)::date;
    DELETE FROM balance_snapshots
    WHERE account_id = p_account_id AND snapshot_date >= v_from_month;

    -- Use the last remaining snapshot as base (avoids re-scanning all history)
    SELECT balance INTO v_base_balance
    FROM balance_snapshots
    WHERE account_id = p_account_id AND snapshot_date < v_from_month
    ORDER BY snapshot_date DESC LIMIT 1;

    IF NOT FOUND THEN
      -- No prior snapshot exists; compute base from initial_balance + all txns before v_from_month
      SELECT COALESCE(initial_balance, 0)::bigint
           + COALESCE((
               SELECT SUM(CASE WHEN type = 'income' THEN amount::bigint ELSE -amount::bigint END)
               FROM transactions
               WHERE account_id = p_account_id AND date < v_from_month
             ), 0)
      INTO v_base_balance
      FROM account_settings WHERE account_id = p_account_id;
    END IF;
  END IF;

  -- Insert one snapshot per complete month from v_from_month to end of last complete month
  INSERT INTO balance_snapshots (account_id, snapshot_date, balance)
  WITH monthly_deltas AS (
    SELECT
      (date_trunc('month', date) + interval '1 month - 1 day')::date AS month_end,
      SUM(CASE WHEN type = 'income' THEN amount::bigint ELSE -amount::bigint END) AS delta
    FROM transactions
    WHERE account_id = p_account_id
      AND date >= v_from_month
      AND date < date_trunc('month', CURRENT_DATE)::date
    GROUP BY date_trunc('month', date)
  )
  SELECT
    p_account_id,
    month_end,
    v_base_balance + SUM(delta) OVER (ORDER BY month_end)
  FROM monthly_deltas
  ON CONFLICT (account_id, snapshot_date) DO UPDATE
    SET balance = EXCLUDED.balance, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_account_snapshots(uuid, date) TO authenticated;
