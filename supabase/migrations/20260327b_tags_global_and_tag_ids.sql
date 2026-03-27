-- Makes tags global (account_id nullable), adds tag_ids to categories and accounts.
-- Safe to run multiple times.

-- 1. Make tags.account_id nullable so tags can be global (not tied to an account).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tags'
  ) THEN
    -- Drop NOT NULL constraint if present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tags'
        AND column_name = 'account_id' AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.tags ALTER COLUMN account_id DROP NOT NULL;
    END IF;
  END IF;
END $$;

-- 2. Add tag_ids JSONB column to categories (stores associated tag IDs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'tag_ids'
    ) THEN
      ALTER TABLE public.categories ADD COLUMN tag_ids JSONB DEFAULT '[]';
    END IF;
  END IF;
END $$;

-- 3. Add tag_ids JSONB column to accounts (stores associated tag IDs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'tag_ids'
    ) THEN
      ALTER TABLE public.accounts ADD COLUMN tag_ids JSONB DEFAULT '[]';
    END IF;
  END IF;
END $$;
