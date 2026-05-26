-- is_asset_member was declared STABLE, which causes PostgreSQL to snapshot
-- asset_members at the start of the INSERT statement. When RETURNING * then
-- evaluates the asset_select policy, it can't see the row that
-- auto_add_asset_owner just inserted (same-statement trigger), so
-- is_asset_member returns false, PostgREST blocks RETURNING, and raises 42501.
-- Changing to VOLATILE forces a fresh read after the trigger has run.

CREATE OR REPLACE FUNCTION public.is_asset_member(p_asset_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asset_members
    WHERE  asset_id = p_asset_id AND user_id = auth.uid()
  );
$$;
