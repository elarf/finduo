-- pools_all WITH CHECK uses is_pool_member(id), which returns false for a
-- brand-new row (creator is not yet in pool_members). Add a dedicated INSERT
-- policy so authenticated users can create pools where they are the creator.

CREATE POLICY "pools_insert"
  ON public.pools
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
