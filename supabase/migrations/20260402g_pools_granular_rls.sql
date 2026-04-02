-- Replace the catch-all pools_all policy with granular policies that match
-- the intended access model:
--   SELECT  → creator OR any pool member
--   INSERT  → already handled by pools_insert (created_by = auth.uid())
--   UPDATE  → creator only (close, rename, etc.)
--   DELETE  → creator only
--
-- This also fixes "can't see pool I just created": the old pools_all SELECT
-- checked is_pool_member(id), which returned false before add_pool_member ran.
-- Now the creator can always see their own pool regardless of membership state.

DROP POLICY IF EXISTS "pools_all" ON public.pools;

-- SELECT: creator always sees their pool; members see pools they belong to
CREATE POLICY "pools_select"
  ON public.pools
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR is_pool_member(id));

-- UPDATE: only the creator can close or rename a pool
CREATE POLICY "pools_update"
  ON public.pools
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: only the creator can delete a pool
CREATE POLICY "pools_delete"
  ON public.pools
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
