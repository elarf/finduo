-- =============================================================================
-- GLOBAL TRANSFER CATEGORIES — 2026-04-02
--
-- Transfer categories are system-level (no owner, is_default = true).
-- All users share the same two Transfer entries (expense + income).
-- Existing per-user Transfer categories are migrated to the global ones.
--
-- CHANGES:
--   A. Allow NULL user_id on categories (system rows have no owner)
--   B. Insert the two global Transfer categories with stable UUIDs
--   C. Re-point existing Transfer transactions to the global IDs
--   D. Delete old per-user Transfer categories
--   E. Update categories_select RLS to expose is_default rows to everyone
-- =============================================================================

BEGIN;

-- =============================================================================
-- A. Allow NULL user_id for system categories
-- =============================================================================

ALTER TABLE public.categories ALTER COLUMN user_id DROP NOT NULL;


-- =============================================================================
-- B. Insert global Transfer categories (stable UUIDs, no owner)
-- =============================================================================

INSERT INTO public.categories (id, name, type, icon, color, is_default, user_id, tag_ids)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'Transfer', 'expense', 'Replace', '#a855f7', true, NULL, '[]'),
  ('00000000-0000-0000-0000-000000000011', 'Transfer', 'income',  'Replace', '#a855f7', true, NULL, '[]')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- C. Re-point existing Transfer transactions to the global IDs
-- =============================================================================

UPDATE public.transactions
SET category_id = '00000000-0000-0000-0000-000000000010'
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE name = 'Transfer' AND type = 'expense' AND is_default IS NOT TRUE
);

UPDATE public.transactions
SET category_id = '00000000-0000-0000-0000-000000000011'
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE name = 'Transfer' AND type = 'income' AND is_default IS NOT TRUE
);


-- =============================================================================
-- D. Delete old per-user Transfer categories
-- =============================================================================

DELETE FROM public.categories
WHERE name = 'Transfer' AND is_default IS NOT TRUE AND user_id IS NOT NULL;


-- =============================================================================
-- E. Update RLS: is_default categories visible to all authenticated users
--    (preserves conditions added by 20260402b: temp_for + get_connected_user_ids)
-- =============================================================================

DROP POLICY IF EXISTS "categories_select" ON public.categories;

CREATE POLICY "categories_select"
  ON public.categories FOR SELECT TO authenticated
  USING (
    is_default = true
    OR user_id = auth.uid()
    OR user_id IN (SELECT public.get_connected_user_ids())
    OR temp_for @> jsonb_build_array(auth.uid())
  );


-- =============================================================================
-- Reload PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
