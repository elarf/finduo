-- =============================================================================
-- CLEAN RLS BASELINE — Single source of truth
-- Generated 2026-04-01
--
-- Supersedes ALL prior RLS migrations. This file:
--   1. Drops every known RLS policy
--   2. Creates/replaces helper functions
--   3. Ensures RLS is enabled on every table
--   4. Creates the authoritative policy set
--   5. Backfills creator membership + trigger
--   6. Adds debts participant columns (if missing)
--
-- ARCHITECTURE:
--   ACCOUNTS domain: owner + members, owner = full control
--   POOLS domain:    FULL TRUST — all members have equal permissions
--   TERMINAL TABLES: account_members, pool_participants
--     SELECT: user_id = auth.uid() ONLY. No subqueries, no functions.
--
-- RLS RULES:
--   ✓ NEVER cross-table direct references (always EXISTS)
--   ✓ Default-deny: every permission explicitly granted
--   ✓ Membership enforced via account_members / pool_participants
--   ✓ NO cycles, NO recursion
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: DROP ALL EXISTING POLICIES (idempotent)
-- =============================================================================

-- accounts
DROP POLICY IF EXISTS "accounts_select" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete" ON public.accounts;
DROP POLICY IF EXISTS "Users can view accounts they own or belong to" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts" ON public.accounts;
DROP POLICY IF EXISTS "Members can update their accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owner can delete account" ON public.accounts;

-- account_members
DROP POLICY IF EXISTS "account_members_select" ON public.account_members;
DROP POLICY IF EXISTS "account_members_insert" ON public.account_members;
DROP POLICY IF EXISTS "account_members_update" ON public.account_members;
DROP POLICY IF EXISTS "account_members_delete" ON public.account_members;
DROP POLICY IF EXISTS "Members can view co-members" ON public.account_members;
DROP POLICY IF EXISTS "Members can view own membership" ON public.account_members;
DROP POLICY IF EXISTS "Authenticated users can join accounts" ON public.account_members;
DROP POLICY IF EXISTS "Members can leave or owner can remove" ON public.account_members;

-- categories
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;
DROP POLICY IF EXISTS "Users see own and connected categories" ON public.categories;
DROP POLICY IF EXISTS "Users insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users delete own categories" ON public.categories;

-- tags
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_insert" ON public.tags;
DROP POLICY IF EXISTS "tags_update" ON public.tags;
DROP POLICY IF EXISTS "tags_delete" ON public.tags;

-- transactions
DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;

-- transaction_tags
DROP POLICY IF EXISTS "transaction_tags_select" ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_insert" ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_delete" ON public.transaction_tags;

-- account_invites
DROP POLICY IF EXISTS "account_invites_select" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_insert" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_update" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_delete" ON public.account_invites;
DROP POLICY IF EXISTS "Allow token lookup by authenticated users" ON public.account_invites;
DROP POLICY IF EXISTS "Account members can create invites" ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite redemption by authenticated users" ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite delete by creator" ON public.account_invites;

-- user_preferences
DROP POLICY IF EXISTS "user_preferences_all" ON public.user_preferences;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;

-- account_settings
DROP POLICY IF EXISTS "account_settings_select" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_insert" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_update" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_delete" ON public.account_settings;

-- user_profiles
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_all" ON public.user_profiles;
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;

-- friends
DROP POLICY IF EXISTS "friends_select" ON public.friends;
DROP POLICY IF EXISTS "friends_insert" ON public.friends;
DROP POLICY IF EXISTS "friends_update" ON public.friends;
DROP POLICY IF EXISTS "friends_delete" ON public.friends;

-- user_hidden_categories
DROP POLICY IF EXISTS "user_hidden_categories_all" ON public.user_hidden_categories;

-- pools
DROP POLICY IF EXISTS "pools_select" ON public.pools;
DROP POLICY IF EXISTS "pools_insert" ON public.pools;
DROP POLICY IF EXISTS "pools_update" ON public.pools;
DROP POLICY IF EXISTS "pools_delete" ON public.pools;

-- pool_participants
DROP POLICY IF EXISTS "pp_select" ON public.pool_participants;
DROP POLICY IF EXISTS "pp_insert" ON public.pool_participants;
DROP POLICY IF EXISTS "pp_delete" ON public.pool_participants;

-- pool_transactions
DROP POLICY IF EXISTS "ptx_select" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_insert" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_update" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete" ON public.pool_transactions;

-- debts
DROP POLICY IF EXISTS "debts_select" ON public.debts;
DROP POLICY IF EXISTS "debts_insert" ON public.debts;
DROP POLICY IF EXISTS "debts_update" ON public.debts;
DROP POLICY IF EXISTS "debts_delete" ON public.debts;

-- Legacy pool_members (may still exist in some environments)
DROP POLICY IF EXISTS "pm_select" ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert" ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete" ON public.pool_members;


-- =============================================================================
-- PART 2: SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- get_connected_user_ids(): co-member visibility for categories SELECT.
-- Reads account_members raw (bypasses RLS). account_members is TERMINAL.
-- ONLY function used in any RLS policy expression.
CREATE OR REPLACE FUNCTION public.get_connected_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT am2.user_id
  FROM   public.account_members am1
  JOIN   public.account_members am2 ON am1.account_id = am2.account_id
  WHERE  am1.user_id = auth.uid()
  AND    am2.user_id <> auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_connected_user_ids() TO authenticated;

-- get_account_members(UUID): app-level call, NOT in any RLS policy.
CREATE OR REPLACE FUNCTION public.get_account_members(p_account_id UUID)
RETURNS SETOF public.account_members
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE  account_id = p_account_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE  id = p_account_id AND created_by = auth.uid()
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT * FROM public.account_members WHERE account_id = p_account_id;
END;
$$;

-- remove_account_member(UUID, UUID): app-level call, NOT in any RLS policy.
CREATE OR REPLACE FUNCTION public.remove_account_member(
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
    RAISE EXCEPTION 'Only the account creator can remove members';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use the standard account_members DELETE to leave an account';
  END IF;

  DELETE FROM public.account_members
  WHERE  account_id = p_account_id AND user_id = p_user_id;
END;
$$;

-- delete_own_account(UUID): cascade-delete an account and all children.
CREATE OR REPLACE FUNCTION public.delete_own_account(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not the account owner';
  END IF;

  DELETE FROM public.transaction_tags
  WHERE transaction_id IN (
    SELECT id FROM public.transactions WHERE account_id = p_account_id
  );

  DELETE FROM public.transactions    WHERE account_id = p_account_id;
  DELETE FROM public.tags            WHERE account_id = p_account_id;
  DELETE FROM public.account_invites WHERE account_id = p_account_id;
  DELETE FROM public.account_members WHERE account_id = p_account_id;
  DELETE FROM public.account_settings WHERE account_id = p_account_id;

  DELETE FROM public.accounts WHERE id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_account_member(UUID, UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account(UUID)            TO authenticated;


-- =============================================================================
-- PART 3: ENSURE RLS IS ENABLED ON ALL TABLES
-- =============================================================================

ALTER TABLE public.accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                  ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PART 4: POLICIES
-- =============================================================================


-- ---------------------------------------------------------------------------
-- account_members  *** TERMINAL ***
-- SELECT: user_id = auth.uid() ONLY. No subqueries, no functions.
-- DELETE: own row only. Owner uses remove_account_member() SECURITY DEFINER.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "account_members_insert"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_members_delete"
  ON public.account_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- accounts
-- SELECT/UPDATE: owner OR member (EXISTS → account_members terminal)
-- INSERT/DELETE: owner only
-- ---------------------------------------------------------------------------

CREATE POLICY "accounts_select"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = accounts.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "accounts_insert"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accounts_update"
  ON public.accounts FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- categories (user-owned, visible to connected users)
-- SELECT: own OR co-member via get_connected_user_ids() [SECURITY DEFINER]
-- WRITE: own only (user_id ownership)
-- ---------------------------------------------------------------------------

CREATE POLICY "categories_select"
  ON public.categories FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT public.get_connected_user_ids())
  );

CREATE POLICY "categories_insert"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "categories_update"
  ON public.categories FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "categories_delete"
  ON public.categories FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- tags (account-scoped, nullable account_id = global)
-- EXISTS → account_members terminal
-- ---------------------------------------------------------------------------

CREATE POLICY "tags_select"
  ON public.tags FOR SELECT TO authenticated
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "tags_insert"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "tags_update"
  ON public.tags FOR UPDATE TO authenticated
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "tags_delete"
  ON public.tags FOR DELETE TO authenticated
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id AND user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- transactions (account-scoped)
-- EXISTS → account_members terminal
-- ---------------------------------------------------------------------------

CREATE POLICY "transactions_select"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_insert"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_update"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_delete"
  ON public.transactions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id AND user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- transaction_tags (joins through transactions → account_members)
-- Single JOIN inside EXISTS — no nested RLS evaluation
-- ---------------------------------------------------------------------------

CREATE POLICY "transaction_tags_select"
  ON public.transaction_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id = transaction_tags.transaction_id
      AND    am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_insert"
  ON public.transaction_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id = transaction_tags.transaction_id
      AND    am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_delete"
  ON public.transaction_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id = transaction_tags.transaction_id
      AND    am.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- account_invites
-- SELECT/UPDATE: any authenticated (token lookup + redemption)
-- INSERT: account member
-- DELETE: invite creator only
-- ---------------------------------------------------------------------------

CREATE POLICY "account_invites_select"
  ON public.account_invites FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "account_invites_insert"
  ON public.account_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_invites.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "account_invites_update"
  ON public.account_invites FOR UPDATE TO authenticated
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_invites_delete"
  ON public.account_invites FOR DELETE TO authenticated
  USING (invited_by = auth.uid());


-- ---------------------------------------------------------------------------
-- user_preferences — own row only
-- ---------------------------------------------------------------------------

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- account_settings (account-scoped)
-- EXISTS → account_members terminal
-- ---------------------------------------------------------------------------

CREATE POLICY "account_settings_select"
  ON public.account_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "account_settings_insert"
  ON public.account_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "account_settings_update"
  ON public.account_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "account_settings_delete"
  ON public.account_settings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id AND user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- user_profiles — readable by all authenticated; writes own row only
-- ---------------------------------------------------------------------------

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_insert"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_update"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_delete"
  ON public.user_profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- friends — direct column checks only
-- ---------------------------------------------------------------------------

CREATE POLICY "friends_select"
  ON public.friends FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (friend_user_id = auth.uid() AND status <> 'blocked')
  );

CREATE POLICY "friends_insert"
  ON public.friends FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "friends_update"
  ON public.friends FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR friend_user_id = auth.uid());

CREATE POLICY "friends_delete"
  ON public.friends FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- user_hidden_categories — own row only
-- ---------------------------------------------------------------------------

CREATE POLICY "user_hidden_categories_all"
  ON public.user_hidden_categories FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- pool_participants  *** TERMINAL ***
-- SELECT: user_id = auth.uid() ONLY. No subqueries.
-- INSERT/DELETE: pool owner (EXISTS → pools, no cycle back since pools
--   SELECT references pool_participants which is terminal).
-- ---------------------------------------------------------------------------

CREATE POLICY "pp_select"
  ON public.pool_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pp_insert"
  ON public.pool_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_participants.pool_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "pp_delete"
  ON public.pool_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_participants.pool_id AND created_by = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- pools
-- SELECT: owner OR participant (EXISTS → pool_participants terminal)
-- INSERT: owner only
-- UPDATE/DELETE: owner only (pool lifecycle control)
-- ---------------------------------------------------------------------------

CREATE POLICY "pools_select"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pools.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pools_insert"
  ON public.pools FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_update"
  ON public.pools FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pools.id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pools.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pools_delete"
  ON public.pools FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- pool_transactions  *** FULL TRUST MODEL ***
-- ALL pool members have equal permissions: SELECT, INSERT, UPDATE, DELETE.
-- Membership verified via EXISTS → pool_participants (terminal).
-- ---------------------------------------------------------------------------

CREATE POLICY "ptx_select"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_insert"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_update"
  ON public.pool_transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_delete"
  ON public.pool_transactions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- debts
-- SELECT/UPDATE: from or to user (direct column checks)
-- INSERT: own debt OR pool participant (EXISTS → pool_participants terminal)
-- ---------------------------------------------------------------------------

CREATE POLICY "debts_select"
  ON public.debts FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "debts_insert"
  ON public.debts FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    OR (
      pool_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pool_participants
        WHERE  pool_id = debts.pool_id AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "debts_update"
  ON public.debts FOR UPDATE TO authenticated
  USING     (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());


-- =============================================================================
-- PART 5: BACKFILL + TRIGGER (creator auto-membership)
-- =============================================================================

-- Backfill: ensure every account creator has a membership row
INSERT INTO public.account_members (account_id, user_id, role)
SELECT a.id, a.created_by, 'owner'
FROM   public.accounts a
WHERE  NOT EXISTS (
  SELECT 1 FROM public.account_members am
  WHERE  am.account_id = a.id AND am.user_id = a.created_by
)
ON CONFLICT (account_id, user_id) DO NOTHING;

-- Trigger: auto-insert creator as member on account creation
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
-- PART 6: DEBTS PARTICIPANT COLUMNS (additive, safe)
-- =============================================================================

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_participant_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_participant_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_participant_name TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_participant_name TEXT;

CREATE INDEX IF NOT EXISTS idx_debts_from_participant ON public.debts(from_participant_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_participant ON public.debts(to_participant_id);


-- =============================================================================
-- PART 7: DROP STALE SECURITY DEFINER FUNCTIONS (no longer used in any policy)
-- =============================================================================

-- These were used by prior RLS iterations but are now replaced by flat EXISTS.
DROP FUNCTION IF EXISTS public.get_my_account_ids();
DROP FUNCTION IF EXISTS public.get_my_member_account_ids();
DROP FUNCTION IF EXISTS public.is_account_creator(UUID);


-- =============================================================================
-- Force PostgREST to reload schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
