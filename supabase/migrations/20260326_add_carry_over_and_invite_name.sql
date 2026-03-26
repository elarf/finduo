-- Adds columns required by the dashboard carry-over and invitation naming features.
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'account_settings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'account_settings'
        AND column_name = 'carry_over_balance'
    ) THEN
      ALTER TABLE public.account_settings
        ADD COLUMN carry_over_balance boolean NOT NULL DEFAULT true;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'account_invites'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'account_invites'
        AND column_name = 'name'
    ) THEN
      ALTER TABLE public.account_invites
        ADD COLUMN name text;
    END IF;
  END IF;
END $$;
