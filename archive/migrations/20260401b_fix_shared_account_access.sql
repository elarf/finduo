-- =============================================================================
-- FIX: Shared account access
-- 2026-04-01
--
-- ROOT CAUSE:
--   saveAccount() inserts into `accounts` but never creates an account_members
--   row for the creator. Under the flat RLS architecture (20260330e), all child
--   tables (transactions, tags, account_settings, etc.) require:
--     EXISTS(account_members WHERE account_id = ... AND user_id = auth.uid())
--   Without the creator's membership row, they can see the account (via
--   created_by check) but NOT any child data, and sharing breaks because the
--   entire membership-based model is incomplete.
--
-- FIXES:
--   1. Backfill: Insert account_members rows for every account creator that
--      doesn't already have one. Uses ON CONFLICT DO NOTHING for safety.
--   2. Trigger: auto-insert creator as 'owner' member on every new account.
--   3. Clean re-apply of account_members RLS policies (idempotent).
--      Ensures no stale/duplicate policies from prior migrations.
--
-- SAFE FOR PRODUCTION:
--   - Backfill uses INSERT ... ON CONFLICT DO NOTHING (no-op for existing rows)
--   - Trigger uses ON CONFLICT DO NOTHING (idempotent)
--   - Policy drops use IF EXISTS (no error if already gone)
--   - No changes to any other table's policies
-- =============================================================================


-- =============================================================================
-- STEP 1: Backfill missing creator membership rows
-- =============================================================================

INSERT INTO public.account_members (account_id, user_id, role)
SELECT a.id, a.created_by, 'owner'
FROM   public.accounts a
WHERE  NOT EXISTS (
  SELECT 1
  FROM   public.account_members am
  WHERE  am.account_id = a.id
  AND    am.user_id    = a.created_by
)
ON CONFLICT (account_id, user_id) DO NOTHING;


-- =============================================================================
-- STEP 2: Trigger — auto-insert creator as member on account creation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (account_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_creator_member ON public.accounts;

CREATE TRIGGER trg_auto_add_creator_member
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_creator_as_member();


-- =============================================================================
-- STEP 3: Clean re-apply of account_members RLS policies
--
-- Drops all known policy names from baseline + every subsequent migration,
-- then creates the correct terminal policies. This ensures no stale policies
-- from partial migration runs.
--
-- DESIGN:
--   SELECT:  user_id = auth.uid()  → TERMINAL (no subqueries, no functions)
--   INSERT:  auth.role() = 'authenticated'  → any authenticated user can add
--            (the trigger/app handles WHO gets added; RLS just gates auth)
--   DELETE:  user_id = auth.uid()  → self-remove only
--            (owner-removes-member via remove_account_member() SECURITY DEFINER)
-- =============================================================================

-- Drop every known policy name from all prior migrations
DROP POLICY IF EXISTS "Members can view co-members"           ON public.account_members;
DROP POLICY IF EXISTS "Members can view own membership"       ON public.account_members;
DROP POLICY IF EXISTS "Authenticated users can join accounts" ON public.account_members;
DROP POLICY IF EXISTS "Members can leave or owner can remove" ON public.account_members;
DROP POLICY IF EXISTS "account_members_select"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_insert"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_update"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_delete"                ON public.account_members;

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- SELECT: TERMINAL — user sees only their own membership rows.
-- Other tables' policies use EXISTS against this table; because the WHERE
-- clause always includes user_id = auth.uid(), the terminal filter is
-- compatible and sufficient.
CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: any authenticated user may insert a membership row.
-- The app controls who gets added (addFriendToAccount, joinByToken, trigger).
-- WITH CHECK is permissive to allow User A inserting a row for User B.
CREATE POLICY "account_members_insert"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- DELETE: user can remove their own membership (leave an account).
-- Owner removing another member goes through remove_account_member() which
-- is SECURITY DEFINER and bypasses RLS.
CREATE POLICY "account_members_delete"
  ON public.account_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- =============================================================================
-- Force PostgREST to reload schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';
