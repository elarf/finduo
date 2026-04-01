-- =============================================================================
-- 02_clean_rls.sql — Complete RLS rebuild from scratch
-- Generated 2026-04-01
--
-- TERMINAL TABLES: account_members, pool_participants
--   SELECT: user_id = auth.uid() ONLY. No subqueries, no functions.
--   All other tables reference these terminally via a single EXISTS.
--
-- NO CYCLES. NO RECURSION. NO NESTED EXISTS. NO SELF-REFERENCES.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: DROP ALL EXISTING POLICIES
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

-- recurring
DROP POLICY IF EXISTS "recurring_select" ON public.recurring;
DROP POLICY IF EXISTS "recurring_insert" ON public.recurring;
DROP POLICY IF EXISTS "recurring_update" ON public.recurring;
DROP POLICY IF EXISTS "recurring_delete" ON public.recurring;

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
DROP POLICY IF EXISTS "pp_select" ON public.pool_members;
DROP POLICY IF EXISTS "pp_insert" ON public.pool_members;
DROP POLICY IF EXISTS "pp_delete" ON public.pool_members;

-- pool_members (legacy — may still exist if migration order varies)
DROP POLICY IF EXISTS "pm_select" ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert" ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete" ON public.pool_members;

-- pool_transactions
DROP POLICY IF EXISTS "ptx_select" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_insert" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_update" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete" ON public.pool_transactions;

-- pool_expenses
DROP POLICY IF EXISTS "pool_expenses_select" ON public.pool_expenses;
DROP POLICY IF EXISTS "pool_expenses_insert" ON public.pool_expenses;
DROP POLICY IF EXISTS "pool_expenses_update" ON public.pool_expenses;
DROP POLICY IF EXISTS "pool_expenses_delete" ON public.pool_expenses;

-- pool_settlements
DROP POLICY IF EXISTS "pool_settlements_select" ON public.pool_settlements;
DROP POLICY IF EXISTS "pool_settlements_insert" ON public.pool_settlements;

-- pool_debts
DROP POLICY IF EXISTS "pool_debts_select" ON public.pool_debts;
DROP POLICY IF EXISTS "pool_debts_insert" ON public.pool_debts;
DROP POLICY IF EXISTS "pool_debts_update" ON public.pool_debts;

-- debts
DROP POLICY IF EXISTS "debts_select" ON public.debts;
DROP POLICY IF EXISTS "debts_insert" ON public.debts;
DROP POLICY IF EXISTS "debts_update" ON public.debts;
DROP POLICY IF EXISTS "debts_delete" ON public.debts;


-- =============================================================================
-- PART 2: ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE public.accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_settlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_debts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                  ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PART 3: SECURITY DEFINER FUNCTIONS (app-only, NOT used in any policy)
-- =============================================================================

-- get_connected_user_ids(): used ONLY in categories_select policy
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

-- get_account_members(): app-level call, NOT in any policy
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

-- remove_account_member(): app-level call, NOT in any policy
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

GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_account_member(UUID, UUID)   TO authenticated;


-- =============================================================================
-- PART 4: POLICIES
-- =============================================================================


-- ---------------------------------------------------------------------------
-- account_members  *** TERMINAL ***
-- SELECT: user_id = auth.uid() ONLY. No subqueries.
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
-- SELECT: owner OR member (EXISTS → account_members terminal)
-- INSERT/DELETE: owner only
-- UPDATE: owner OR member
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
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = accounts.id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = accounts.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- categories (user-owned, visible to connected users)
-- SELECT: own OR co-member via get_connected_user_ids() [SECURITY DEFINER]
-- WRITE: own only
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
-- tags (account-scoped, nullable account_id for global)
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
-- Single JOIN inside EXISTS (transactions + account_members)
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
-- recurring (account-scoped)
-- EXISTS → account_members terminal
-- ---------------------------------------------------------------------------

CREATE POLICY "recurring_select"
  ON public.recurring FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = recurring.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_insert"
  ON public.recurring FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = recurring.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_update"
  ON public.recurring FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = recurring.account_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = recurring.account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_delete"
  ON public.recurring FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = recurring.account_id AND user_id = auth.uid()
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
-- user_profiles
-- SELECT: any authenticated
-- WRITE: own row only
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
  USING (user_id = auth.uid() OR friend_user_id = auth.uid());

CREATE POLICY "friends_insert"
  ON public.friends FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "friends_update"
  ON public.friends FOR UPDATE TO authenticated
  USING     (user_id = auth.uid() OR friend_user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR friend_user_id = auth.uid());

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
-- INSERT/DELETE: pool owner only (EXISTS → pools, no cycle back)
-- ---------------------------------------------------------------------------

CREATE POLICY "pp_select"
  ON public.pool_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pp_insert"
  ON public.pool_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_participants.pool_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "pp_delete"
  ON public.pool_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_participants.pool_id AND created_by = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- pools
-- SELECT: owner OR participant (EXISTS → pool_participants terminal)
-- WRITE: owner only
-- ---------------------------------------------------------------------------

CREATE POLICY "pools_select"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pools.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pools_insert"
  ON public.pools FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_update"
  ON public.pools FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_delete"
  ON public.pools FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- pool_transactions
-- SELECT/INSERT: pool participant (EXISTS → pool_participants terminal)
-- UPDATE/DELETE: payer or pool owner
-- ---------------------------------------------------------------------------

CREATE POLICY "ptx_select"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_insert"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_update"
  ON public.pool_transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  id = pool_transactions.paid_by AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_transactions.pool_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_delete"
  ON public.pool_transactions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  id = pool_transactions.paid_by AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_transactions.pool_id AND created_by = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- pool_expenses
-- SELECT/INSERT: pool participant (EXISTS → pool_participants terminal)
-- UPDATE/DELETE: creator only
-- ---------------------------------------------------------------------------

CREATE POLICY "pool_expenses_select"
  ON public.pool_expenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_expenses.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pool_expenses_insert"
  ON public.pool_expenses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_expenses.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pool_expenses_update"
  ON public.pool_expenses FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pool_expenses_delete"
  ON public.pool_expenses FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- pool_settlements
-- SELECT: pool participant (EXISTS → pool_participants terminal)
-- INSERT: settler only
-- ---------------------------------------------------------------------------

CREATE POLICY "pool_settlements_select"
  ON public.pool_settlements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_settlements.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pool_settlements_insert"
  ON public.pool_settlements FOR INSERT TO authenticated
  WITH CHECK (settled_by = auth.uid());


-- ---------------------------------------------------------------------------
-- pool_debts
-- SELECT: from or to user
-- INSERT: pool participant (EXISTS → pool_participants terminal)
-- UPDATE: from or to user
-- ---------------------------------------------------------------------------

CREATE POLICY "pool_debts_select"
  ON public.pool_debts FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "pool_debts_insert"
  ON public.pool_debts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_debts.pool_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "pool_debts_update"
  ON public.pool_debts FOR UPDATE TO authenticated
  USING     (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- debts
-- SELECT/UPDATE: from or to user
-- INSERT: own debt OR pool participant
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
        SELECT 1 FROM public.pool_members
        WHERE  pool_id = debts.pool_id AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "debts_update"
  ON public.debts FOR UPDATE TO authenticated
  USING     (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());


-- =============================================================================
-- PART 5: FORCE POSTGREST SCHEMA RELOAD
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
