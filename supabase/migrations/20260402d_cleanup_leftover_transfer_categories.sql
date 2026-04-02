-- =============================================================================
-- CLEANUP LEFTOVER TRANSFER CATEGORIES — 2026-04-02
--
-- Re-points any remaining transactions that reference non-global Transfer
-- categories, then deletes the leftover rows.
-- =============================================================================

BEGIN;

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

DELETE FROM public.categories
WHERE name = 'Transfer' AND is_default IS NOT TRUE;

COMMIT;
