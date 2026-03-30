-- =============================================================================
-- Migration: Make categories user-global instead of per-account
-- =============================================================================
-- Categories are currently scoped per-account (account_id FK). This migration:
--   1. Adds user_id column to categories (owner of the category)
--   2. Creates user_hidden_categories table (per-user hiding)
--   3. Populates user_id from existing account_id → account.created_by
--   4. Merges duplicate categories (same user + LOWER(name) + type)
--   5. Replaces RLS policies for connected-user visibility
-- =============================================================================

-- 1a. Add user_id column (nullable initially so existing rows aren't rejected)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- 1b. Create user_hidden_categories junction table
CREATE TABLE IF NOT EXISTS public.user_hidden_categories (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);

ALTER TABLE public.user_hidden_categories ENABLE ROW LEVEL SECURITY;

-- 1c. Populate user_id from existing data
-- Categories with an account_id → derive user from account creator
UPDATE public.categories c
SET user_id = a.created_by
FROM public.accounts a
WHERE c.account_id = a.id AND c.user_id IS NULL;

-- Orphan global categories (account_id IS NULL) → assign to user who used them most
UPDATE public.categories c
SET user_id = sub.owner
FROM (
  SELECT t.category_id, (
    SELECT a2.created_by
    FROM public.transactions t2
    JOIN public.accounts a2 ON a2.id = t2.account_id
    WHERE t2.category_id = t.category_id
    GROUP BY a2.created_by
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS owner
  FROM public.transactions t
  WHERE t.category_id IN (SELECT id FROM public.categories WHERE user_id IS NULL)
  GROUP BY t.category_id
) sub
WHERE c.id = sub.category_id AND c.user_id IS NULL AND sub.owner IS NOT NULL;

-- Delete any remaining orphan categories with no user and no transactions
DELETE FROM public.categories WHERE user_id IS NULL;

-- 1d. Merge duplicate categories (same user + LOWER(name) + type)
-- First, reassign transactions from losers to winners (winner = lowest id)
WITH ranked AS (
  SELECT id, user_id, LOWER(name) AS lname, type,
    ROW_NUMBER() OVER (PARTITION BY user_id, LOWER(name), type ORDER BY id ASC) AS rn
  FROM public.categories
),
winners AS (
  SELECT id AS winner_id, user_id, lname, type FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, w.winner_id
  FROM ranked r
  JOIN winners w ON w.user_id = r.user_id AND w.lname = r.lname AND w.type = r.type
  WHERE r.rn > 1
)
UPDATE public.transactions t
SET category_id = l.winner_id
FROM losers l
WHERE t.category_id = l.loser_id;

-- Then delete the duplicate (loser) categories
WITH ranked AS (
  SELECT id, user_id, LOWER(name) AS lname, type,
    ROW_NUMBER() OVER (PARTITION BY user_id, LOWER(name), type ORDER BY id ASC) AS rn
  FROM public.categories
)
DELETE FROM public.categories
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 1e. Make user_id NOT NULL now that all rows have it
ALTER TABLE public.categories ALTER COLUMN user_id SET NOT NULL;

-- Nullify account_id (kept for backwards compat, no longer meaningful)
UPDATE public.categories SET account_id = NULL WHERE account_id IS NOT NULL;

-- 1f. Replace RLS policies on categories
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can view categories for their accounts') THEN
    DROP POLICY "Users can view categories for their accounts" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can insert categories for their accounts') THEN
    DROP POLICY "Users can insert categories for their accounts" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can update categories for their accounts') THEN
    DROP POLICY "Users can update categories for their accounts" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can delete categories for their accounts') THEN
    DROP POLICY "Users can delete categories for their accounts" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can view categories for their accounts or global') THEN
    DROP POLICY "Users can view categories for their accounts or global" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can insert categories for their accounts or global') THEN
    DROP POLICY "Users can insert categories for their accounts or global" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can update categories for their accounts or global') THEN
    DROP POLICY "Users can update categories for their accounts or global" ON public.categories;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Users can delete categories for their accounts or global') THEN
    DROP POLICY "Users can delete categories for their accounts or global" ON public.categories;
  END IF;
END $$;

-- Index for connected-users subquery performance
CREATE INDEX IF NOT EXISTS idx_account_members_user_id ON public.account_members(user_id);

-- SELECT: own categories + categories from any user you share at least one account with
CREATE POLICY "Users see own and connected categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT DISTINCT am2.user_id
      FROM public.account_members am1
      JOIN public.account_members am2 ON am1.account_id = am2.account_id
      WHERE am1.user_id = auth.uid() AND am2.user_id <> auth.uid()
    )
  );

-- INSERT: own categories only
CREATE POLICY "Users insert own categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: own categories only
CREATE POLICY "Users update own categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: own categories only
CREATE POLICY "Users delete own categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS for user_hidden_categories
CREATE POLICY "Users manage own hidden categories"
  ON public.user_hidden_categories FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
