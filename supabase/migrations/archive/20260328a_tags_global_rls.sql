-- Allow inserting and managing global tags (account_id IS NULL).
-- The existing tags RLS likely only allows operations on tags belonging to the user's accounts.
-- This adds/replaces policies to also permit tags with NULL account_id for authenticated users.

-- Drop existing restrictive policies and recreate with NULL support
DO $$
BEGIN
  -- Drop old INSERT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Users can insert tags for their accounts'
  ) THEN
    DROP POLICY "Users can insert tags for their accounts" ON public.tags;
  END IF;

  -- Drop old SELECT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Users can view tags for their accounts'
  ) THEN
    DROP POLICY "Users can view tags for their accounts" ON public.tags;
  END IF;

  -- Drop old UPDATE policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Users can update tags for their accounts'
  ) THEN
    DROP POLICY "Users can update tags for their accounts" ON public.tags;
  END IF;

  -- Drop old DELETE policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tags' AND policyname = 'Users can delete tags for their accounts'
  ) THEN
    DROP POLICY "Users can delete tags for their accounts" ON public.tags;
  END IF;
END $$;

-- Recreate policies that allow both account-scoped and global (NULL) tags
CREATE POLICY "Users can view tags for their accounts or global"
  ON public.tags FOR SELECT
  TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert tags for their accounts or global"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update tags for their accounts or global"
  ON public.tags FOR UPDATE
  TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete tags for their accounts or global"
  ON public.tags FOR DELETE
  TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );
