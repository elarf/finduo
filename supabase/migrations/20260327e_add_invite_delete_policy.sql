-- Allow the invite creator to delete their own tokens.
-- Without this, DELETE calls returned a silent RLS failure (0 rows affected).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'account_invites'
      AND policyname = 'Allow invite delete by creator'
  ) THEN
    CREATE POLICY "Allow invite delete by creator"
      ON public.account_invites
      FOR DELETE
      USING (invited_by = auth.uid());
  END IF;
END $$;
