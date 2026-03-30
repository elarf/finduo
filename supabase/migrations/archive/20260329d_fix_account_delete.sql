-- Fix: account deletion fails silently because RLS on account_members / accounts
-- prevents the owner from deleting other users' rows. Use a SECURITY DEFINER
-- function so the owner can fully cascade-delete their own account.

CREATE OR REPLACE FUNCTION public.delete_own_account(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the account creator may delete it
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not the account owner';
  END IF;

  -- Delete child rows that reference transactions first
  DELETE FROM public.transaction_tags
  WHERE transaction_id IN (
    SELECT id FROM public.transactions WHERE account_id = p_account_id
  );

  -- Delete direct children
  DELETE FROM public.transactions    WHERE account_id = p_account_id;
  DELETE FROM public.tags            WHERE account_id = p_account_id;
  DELETE FROM public.account_invites WHERE account_id = p_account_id;
  DELETE FROM public.account_members WHERE account_id = p_account_id;
  DELETE FROM public.account_settings WHERE account_id = p_account_id;

  -- Finally delete the account itself
  DELETE FROM public.accounts WHERE id = p_account_id;
END;
$$;
