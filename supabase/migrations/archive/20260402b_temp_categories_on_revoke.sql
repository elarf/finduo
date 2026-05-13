-- =============================================================================
-- TEMP CATEGORIES ON REVOKE — 2026-04-02
--
-- When account sharing is revoked, categories from the disconnected user that
-- are still referenced in the revoked user's accessible transactions are marked
-- as "temp" for that user via the temp_for JSONB array.
--
-- The user can then "clone" a temp category, which:
--   1. Creates a new owned copy (user_id = caller)
--   2. Re-links all transactions they can still see to the new category
--   3. Removes them from temp_for on the original
--
-- CHANGES:
--   A. Add temp_for column + GIN index to categories
--   B. Replace categories_select policy to include temp_for visibility
--   C. Create share_account RPC
--   D. Create unshare_account RPC (handles temp_for population before delete)
--   E. Create clone_temp_category RPC
-- =============================================================================

BEGIN;

-- =============================================================================
-- A. SCHEMA: add temp_for to categories
-- =============================================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS temp_for JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_categories_temp_for
  ON public.categories USING GIN (temp_for);


-- =============================================================================
-- B. RLS: replace categories_select to include temp_for visibility
-- =============================================================================

DROP POLICY IF EXISTS "categories_select" ON public.categories;

CREATE POLICY "categories_select"
  ON public.categories FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT public.get_connected_user_ids())
    OR temp_for @> jsonb_build_array(auth.uid())
  );


-- =============================================================================
-- C. share_account RPC
-- Allows the account owner to add a user as a member.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.share_account(
  p_account_id UUID,
  p_user_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE  id = p_account_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the account owner can share';
  END IF;

  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (p_account_id, p_user_id, 'member')
  ON CONFLICT (account_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_account(UUID, UUID) TO authenticated;


-- =============================================================================
-- D. unshare_account RPC
-- Before removing p_user_id from account_members, marks as temp_for any
-- categories that:
--   1. Are owned by users who will be FULLY disconnected from p_user_id after
--      this revocation (i.e., their only connection was via p_account_id), AND
--   2. Are referenced in transactions that p_user_id will still have access to
--      (in accounts other than p_account_id).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.unshare_account(
  p_account_id UUID,
  p_user_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the account creator can revoke access
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE  id = p_account_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the account owner can revoke access';
  END IF;

  -- Tag categories that will become orphaned for p_user_id:
  -- Owner: a user who is in this account AND is not connected to p_user_id
  --        via any OTHER account.
  -- Usage: the category is referenced in at least one transaction that
  --        p_user_id can still see after revocation (excluding p_account_id).
  UPDATE public.categories c
  SET    temp_for = c.temp_for || jsonb_build_array(p_user_id)
  WHERE
    -- Category is owned by a user who will be fully disconnected from p_user_id
    c.user_id IN (
      SELECT am.user_id
      FROM   public.account_members am
      WHERE  am.account_id = p_account_id
        AND  am.user_id <> p_user_id
        -- This user shares NO other account with p_user_id
        AND  NOT EXISTS (
          SELECT 1
          FROM   public.account_members am1
          JOIN   public.account_members am2 ON am1.account_id = am2.account_id
          WHERE  am1.user_id = am.user_id
            AND  am2.user_id = p_user_id
            AND  am1.account_id <> p_account_id
        )
    )
    -- Category is still in use in transactions p_user_id will retain access to
    AND EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.category_id = c.id
        AND  am.user_id = p_user_id
        AND  t.account_id <> p_account_id
    )
    -- Avoid duplicates
    AND NOT (c.temp_for @> jsonb_build_array(p_user_id));

  -- Remove the member
  DELETE FROM public.account_members
  WHERE  account_id = p_account_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unshare_account(UUID, UUID) TO authenticated;


-- =============================================================================
-- E. clone_temp_category RPC
-- Creates an owned copy of a temp category for the calling user:
--   1. Inserts a new category row with user_id = auth.uid()
--   2. Re-links all transactions accessible to auth.uid() from old → new ID
--   3. Removes auth.uid() from temp_for on the original
-- Returns the new category ID.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.clone_temp_category(
  p_category_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat    public.categories%ROWTYPE;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_cat FROM public.categories WHERE id = p_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT (v_cat.temp_for @> jsonb_build_array(auth.uid())) THEN
    RAISE EXCEPTION 'You do not have a temp reference to this category';
  END IF;

  -- Clone: new category owned by caller (account_id intentionally NULL — user-global)
  INSERT INTO public.categories (name, icon, color, type, is_default, tag_ids, user_id)
  VALUES (v_cat.name, v_cat.icon, v_cat.color, v_cat.type, false, v_cat.tag_ids, auth.uid())
  RETURNING id INTO v_new_id;

  -- Re-link transactions in accounts the caller still has access to
  UPDATE public.transactions t
  SET    category_id = v_new_id
  WHERE  t.category_id = p_category_id
    AND  EXISTS (
      SELECT 1 FROM public.account_members am
      WHERE  am.account_id = t.account_id AND am.user_id = auth.uid()
    );

  -- Remove caller from temp_for on the original
  UPDATE public.categories
  SET    temp_for = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM   jsonb_array_elements(temp_for) AS elem
    WHERE  elem <> to_jsonb(auth.uid())
  )
  WHERE  id = p_category_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_temp_category(UUID) TO authenticated;


-- =============================================================================
-- Reload PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
