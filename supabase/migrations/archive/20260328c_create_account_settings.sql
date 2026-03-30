-- Create the account_settings table with all columns the app expects.
-- This table stores per-account configuration (inclusion, carry-over, initial balance).

CREATE TABLE IF NOT EXISTS public.account_settings (
  account_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  included_in_balance BOOLEAN NOT NULL DEFAULT TRUE,
  carry_over_balance BOOLEAN NOT NULL DEFAULT TRUE,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  initial_balance_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage settings for accounts they are members of
CREATE POLICY "Users can view settings for their accounts"
  ON public.account_settings FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid())
  );

CREATE POLICY "Users can insert settings for their accounts"
  ON public.account_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid())
  );

CREATE POLICY "Users can update settings for their accounts"
  ON public.account_settings FOR UPDATE
  TO authenticated
  USING (
    account_id IN (SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid())
  );

CREATE POLICY "Users can delete settings for their accounts"
  ON public.account_settings FOR DELETE
  TO authenticated
  USING (
    account_id IN (SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid())
  );
