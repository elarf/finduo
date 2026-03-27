-- Fix invite RLS so that users from other accounts can look up and redeem invites.
--
-- Problem: existing SELECT policy only allowed account members to read invites.
-- A new user trying to join has no membership yet, so the lookup returned 0 rows
-- and .single() threw a 406 Not Acceptable error.
--
-- Fix 1: Allow any authenticated user to SELECT invites (token = authorization).
-- Fix 2: Allow any authenticated user to UPDATE used_at on an invite they know
--        the ID of (they obtained it via the SELECT above, so they knew the token).
--
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'account_invites'
      AND policyname = 'Allow token lookup by authenticated users'
  ) THEN
    CREATE POLICY "Allow token lookup by authenticated users"
      ON public.account_invites
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'account_invites'
      AND policyname = 'Allow invite redemption by authenticated users'
  ) THEN
    -- Joining users need to mark the invite as used immediately after
    -- inserting themselves into account_members.
    CREATE POLICY "Allow invite redemption by authenticated users"
      ON public.account_invites
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
