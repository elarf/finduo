-- Replaces direct INSERT + trigger pattern for asset creation.
-- The trigger's INSERT into asset_members is silently blocked by the
-- asset_members_insert RLS policy (circular dependency via is_asset_member),
-- leaving the asset with no member row, which causes RETURNING to be blocked
-- and PostgREST to raise 42501. This RPC runs as postgres (SECURITY DEFINER)
-- so it bypasses RLS for both inserts atomically.

CREATE OR REPLACE FUNCTION public.create_asset(
  p_name       TEXT,
  p_type       TEXT,
  p_usage_unit TEXT,
  p_icon       TEXT DEFAULT NULL,
  p_notes      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.assets (name, type, usage_unit, current_usage, created_by, icon, notes)
  VALUES (p_name, p_type, p_usage_unit, 0, v_uid, p_icon, p_notes)
  RETURNING id INTO v_id;

  INSERT INTO public.asset_members (asset_id, user_id, role, invited_by)
  VALUES (v_id, v_uid, 'owner', v_uid)
  ON CONFLICT (asset_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_asset(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
