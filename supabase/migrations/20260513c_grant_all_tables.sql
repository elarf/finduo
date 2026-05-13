-- =============================================================================
-- GRANT FIX: Explicit table grants for Supabase PostgREST / Data API
--
-- Starting May 30 2026, new Supabase projects no longer auto-grant public
-- schema access to PostgREST roles.  Existing projects follow on October 30.
-- This migration adds the required explicit GRANTs to every public table.
--
-- Safe to run on production — adds nothing except role permissions.
-- RLS policies continue to control per-row access.
-- =============================================================================

-- ─── FinDuo domain ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts               TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_members        TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories             TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags                   TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_tags       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_invites        TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_settings       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles          TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friends                TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hidden_categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts               TO authenticated, service_role;

-- ─── Pool domain ──────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pools                  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_members           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_transactions      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts                  TO authenticated, service_role;

-- ─── FinGo domain ─────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets                          TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_members                   TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_parts                     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_categories                TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_logs                      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_service_logs               TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.components                      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_service_intervals     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_service_records       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_swaps                 TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
