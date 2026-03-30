-- =============================================================================
-- Fix: account_settings RLS blocks account owners who aren't in account_members
-- =============================================================================
-- The existing policies only check account_members, but when a user creates a
-- new account they are the owner (accounts.created_by) and may not yet have an
-- account_members row. Allow the account owner to manage settings too.
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "Users can insert settings for their accounts" ON public.account_settings;
DROP POLICY IF EXISTS "Users can update settings for their accounts" ON public.account_settings;
DROP POLICY IF EXISTS "Users can delete settings for their accounts" ON public.account_settings;

-- Recreate with owner OR member access
CREATE POLICY "Users can view settings for their accounts"
  ON public.account_settings FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert settings for their accounts"
  ON public.account_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update settings for their accounts"
  ON public.account_settings FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete settings for their accounts"
  ON public.account_settings FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );
