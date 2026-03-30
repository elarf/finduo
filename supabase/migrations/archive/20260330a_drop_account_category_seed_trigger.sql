-- =============================================================================
-- Drop any trigger/function that seeds default categories on account creation.
-- =============================================================================
-- Categories are now user-global (since 20260329a_categories_user_global).
-- Any per-account category seeding trigger is both redundant and harmful —
-- it creates duplicate categories every time a new account is added.
-- =============================================================================

-- Drop trigger (all common naming conventions)
DROP TRIGGER IF EXISTS create_default_categories       ON public.accounts;
DROP TRIGGER IF EXISTS seed_default_categories         ON public.accounts;
DROP TRIGGER IF EXISTS seed_categories_trigger         ON public.accounts;
DROP TRIGGER IF EXISTS after_account_insert            ON public.accounts;
DROP TRIGGER IF EXISTS on_account_created              ON public.accounts;
DROP TRIGGER IF EXISTS handle_new_account_trigger      ON public.accounts;
DROP TRIGGER IF EXISTS insert_default_categories       ON public.accounts;

-- Drop associated functions
DROP FUNCTION IF EXISTS public.create_default_categories()       CASCADE;
DROP FUNCTION IF EXISTS public.create_default_categories(uuid)   CASCADE;
DROP FUNCTION IF EXISTS public.seed_default_categories()         CASCADE;
DROP FUNCTION IF EXISTS public.seed_account_categories()         CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_account()              CASCADE;
DROP FUNCTION IF EXISTS public.insert_default_categories()       CASCADE;
