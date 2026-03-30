-- Refactor categories SELECT: replace get_connected_user_ids() with flat EXISTS
-- Supersedes categories_select from 20260330e_flat_rls_final.sql

DROP POLICY IF EXISTS "categories_select" ON public.categories;

CREATE POLICY "categories_select"
  ON public.categories FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   public.account_members am1
      JOIN   public.account_members am2
             ON  am2.account_id = am1.account_id
      WHERE  am1.user_id = auth.uid()
      AND    am2.user_id = categories.user_id
    )
  );

NOTIFY pgrst, 'reload schema';
