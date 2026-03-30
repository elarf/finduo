-- Adds icon and color columns to categories, and color to tags.
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'icon'
    ) THEN
      ALTER TABLE public.categories ADD COLUMN icon text;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'color'
    ) THEN
      ALTER TABLE public.categories ADD COLUMN color text;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tags'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'color'
    ) THEN
      ALTER TABLE public.tags ADD COLUMN color text;
    END IF;
  END IF;
END $$;
