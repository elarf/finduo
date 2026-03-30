-- =============================================================================
-- COMPLETE RLS RESET & RECREATION
-- Generated 2026-03-30 — supersedes 20260330a_fix_rls_recursion.sql
--
-- DESIGN PRINCIPLES
-- -----------------
-- 1. TERMINAL tables (account_members, pool_members)
--    SELECT policy = ONLY `user_id = auth.uid()` — no subqueries, no joins.
--
-- 2. Downstream tables use SECURITY DEFINER helper functions to avoid ANY
--    RLS chain through terminal tables in policy expressions.
--
-- 3. Maximum policy chain depth after this migration:
--      • account_members / pool_members  → depth 0 (terminal)
--      • accounts                        → depth 1 (queries account_members)
--      • categories                      → depth 0 (calls SECURITY DEFINER fn)
--      • tags, transactions,
--        account_invites, account_settings→ depth 0 (calls get_my_account_ids)
--      • transaction_tags                → depth 1 (queries transactions → fn)
--      • pools, pool_transactions, debts → depth 1 (queries pool_members)
--      • all others                      → depth 0 (direct column checks)
--
--    No table's policy references itself. No cycle exists.
-- =============================================================================


-- =============================================================================
-- PART 1 — SECURITY DEFINER HELPER FUNCTIONS
-- (created/replaced BEFORE policies that reference them)
-- =============================================================================

-- get_my_account_ids()
-- Returns the set of account IDs the current user can access
-- (member rows + created-by ownership). Runs as function owner, bypasses RLS.
-- Used by tags, transactions, account_invites, account_settings policies
-- to avoid triggering RLS on accounts or account_members inside a policy.
CREATE OR REPLACE FUNCTION public.get_my_account_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT account_id
  FROM   public.account_members
  WHERE  user_id = auth.uid()
  UNION
  SELECT id
  FROM   public.accounts
  WHERE  created_by = auth.uid();
$$;

-- get_connected_user_ids()
-- Returns user_ids that share at least one account with the current user
-- (excluding the user themselves). Runs as function owner, bypasses RLS.
-- Used by the categories SELECT policy for co-member category visibility.
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

-- get_account_members(UUID)
-- Returns all rows in account_members for the given account, but only if the
-- caller is already a member or the account creator. Bypasses RLS so the app
-- can list co-members without querying account_members directly (which would
-- only return the caller's own row under the terminal SELECT policy).
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
    RETURN;  -- unauthorised — return empty, not an error
  END IF;

  RETURN QUERY
    SELECT * FROM public.account_members WHERE account_id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_account_ids()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connected_user_ids()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)     TO authenticated;


-- =============================================================================
-- PART 2 — DROP ALL EXISTING POLICIES (IF EXISTS — idempotent)
-- =============================================================================

-- accounts
DROP POLICY IF EXISTS "Users can view accounts they own or belong to" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts"                      ON public.accounts;
DROP POLICY IF EXISTS "Members can update their accounts"              ON public.accounts;
DROP POLICY IF EXISTS "Owner can delete account"                       ON public.accounts;
DROP POLICY IF EXISTS "accounts_select"                                ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert"                                ON public.accounts;
DROP POLICY IF EXISTS "accounts_update"                                ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete"                                ON public.accounts;

-- account_members
DROP POLICY IF EXISTS "Members can view co-members"           ON public.account_members;
DROP POLICY IF EXISTS "Members can view own membership"       ON public.account_members;
DROP POLICY IF EXISTS "Authenticated users can join accounts" ON public.account_members;
DROP POLICY IF EXISTS "Members can leave or owner can remove" ON public.account_members;
DROP POLICY IF EXISTS "account_members_select"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_insert"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_delete"                ON public.account_members;

-- categories
DROP POLICY IF EXISTS "Users see own and connected categories" ON public.categories;
DROP POLICY IF EXISTS "Users insert own categories"            ON public.categories;
DROP POLICY IF EXISTS "Users update own categories"            ON public.categories;
DROP POLICY IF EXISTS "Users delete own categories"            ON public.categories;
DROP POLICY IF EXISTS "categories_select"                      ON public.categories;
DROP POLICY IF EXISTS "categories_insert"                      ON public.categories;
DROP POLICY IF EXISTS "categories_update"                      ON public.categories;
DROP POLICY IF EXISTS "categories_delete"                      ON public.categories;

-- tags
DROP POLICY IF EXISTS "Users can view tags for their accounts or global"   ON public.tags;
DROP POLICY IF EXISTS "Users can insert tags for their accounts or global"  ON public.tags;
DROP POLICY IF EXISTS "Users can update tags for their accounts or global"  ON public.tags;
DROP POLICY IF EXISTS "Users can delete tags for their accounts or global"  ON public.tags;
DROP POLICY IF EXISTS "tags_select"                                         ON public.tags;
DROP POLICY IF EXISTS "tags_insert"                                         ON public.tags;
DROP POLICY IF EXISTS "tags_update"                                         ON public.tags;
DROP POLICY IF EXISTS "tags_delete"                                         ON public.tags;

-- transactions
DROP POLICY IF EXISTS "Users can view transactions for their accounts"    ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions for their accounts"   ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions for their accounts"   ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions for their accounts"   ON public.transactions;
DROP POLICY IF EXISTS "transactions_select"                                ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert"                                ON public.transactions;
DROP POLICY IF EXISTS "transactions_update"                                ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete"                                ON public.transactions;

-- transaction_tags
DROP POLICY IF EXISTS "Users can view transaction_tags for their accounts"   ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can insert transaction_tags for their accounts"  ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can delete transaction_tags for their accounts"  ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_select"                               ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_insert"                               ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_delete"                               ON public.transaction_tags;

-- account_invites
DROP POLICY IF EXISTS "Allow token lookup by authenticated users"       ON public.account_invites;
DROP POLICY IF EXISTS "Account members can create invites"              ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite redemption by authenticated users"  ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite delete by creator"                  ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_select"                          ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_insert"                          ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_update"                          ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_delete"                          ON public.account_invites;

-- user_preferences
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_all"         ON public.user_preferences;

-- account_settings
DROP POLICY IF EXISTS "Users can view settings for their accounts"    ON public.account_settings;
DROP POLICY IF EXISTS "Users can insert settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "Users can update settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "Users can delete settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_select"                        ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_insert"                        ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_update"                        ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_delete"                        ON public.account_settings;

-- user_profiles
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "Users manage own profile"           ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select"               ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_all"                  ON public.user_profiles;

-- friends
DROP POLICY IF EXISTS "Participants see own friendships"   ON public.friends;
DROP POLICY IF EXISTS "Users can send friend requests"     ON public.friends;
DROP POLICY IF EXISTS "Participants can update friendship"  ON public.friends;
DROP POLICY IF EXISTS "Requester can delete friendship"    ON public.friends;
DROP POLICY IF EXISTS "friends_select"                     ON public.friends;
DROP POLICY IF EXISTS "friends_insert"                     ON public.friends;
DROP POLICY IF EXISTS "friends_update"                     ON public.friends;
DROP POLICY IF EXISTS "friends_delete"                     ON public.friends;

-- user_hidden_categories
DROP POLICY IF EXISTS "Users manage own hidden categories"   ON public.user_hidden_categories;
DROP POLICY IF EXISTS "user_hidden_categories_all"           ON public.user_hidden_categories;

-- pools
DROP POLICY IF EXISTS "pools_select" ON public.pools;
DROP POLICY IF EXISTS "pools_insert" ON public.pools;
DROP POLICY IF EXISTS "pools_update" ON public.pools;
DROP POLICY IF EXISTS "pools_delete" ON public.pools;

-- pool_members
DROP POLICY IF EXISTS "pm_select" ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert" ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete" ON public.pool_members;

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


-- =============================================================================
-- PART 3 — ENSURE RLS IS ENABLED ON ALL TABLES
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
ALTER TABLE public.pool_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                  ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PART 4 — RECREATE ALL POLICIES
-- =============================================================================


-- ---------------------------------------------------------------------------
-- accounts
-- Queries account_members directly (terminal table, depth 1). Safe.
-- ---------------------------------------------------------------------------

CREATE POLICY "accounts_select"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "accounts_insert"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accounts_update"
  ON public.accounts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- account_members  *** TERMINAL ***
-- SELECT: ONLY own rows — zero subqueries, zero cross-table references.
-- INSERT: role-check only; actual validation lives in the invite SECURITY
--         DEFINER flow (not in RLS).
-- DELETE: own row OR account creator. The accounts sub-SELECT applies
--         accounts SELECT RLS → accounts queries account_members (terminal).
--         Chain: account_members DELETE → accounts → account_members SELECT.
--         Depth 2, no cycle.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());  -- TERMINAL: no subqueries

CREATE POLICY "account_members_insert"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_members_delete"
  ON public.account_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );


-- ---------------------------------------------------------------------------
-- categories
-- SELECT calls get_connected_user_ids() (SECURITY DEFINER) — depth 0.
-- Write policies: own rows only.
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
-- tags
-- All policies call get_my_account_ids() (SECURITY DEFINER) — depth 0.
-- ---------------------------------------------------------------------------

CREATE POLICY "tags_select"
  ON public.tags FOR SELECT TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT public.get_my_account_ids())
  );

CREATE POLICY "tags_insert"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (
    account_id IS NULL
    OR account_id IN (SELECT public.get_my_account_ids())
  );

CREATE POLICY "tags_update"
  ON public.tags FOR UPDATE TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT public.get_my_account_ids())
  )
  WITH CHECK (
    account_id IS NULL
    OR account_id IN (SELECT public.get_my_account_ids())
  );

CREATE POLICY "tags_delete"
  ON public.tags FOR DELETE TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT public.get_my_account_ids())
  );


-- ---------------------------------------------------------------------------
-- transactions
-- All policies call get_my_account_ids() (SECURITY DEFINER) — depth 0.
-- ---------------------------------------------------------------------------

CREATE POLICY "transactions_select"
  ON public.transactions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "transactions_insert"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "transactions_update"
  ON public.transactions FOR UPDATE TO authenticated
  USING     (account_id IN (SELECT public.get_my_account_ids()))
  WITH CHECK (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "transactions_delete"
  ON public.transactions FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.get_my_account_ids()));


-- ---------------------------------------------------------------------------
-- transaction_tags
-- Subquery reads transactions (which has its own RLS using get_my_account_ids).
-- Chain: transaction_tags → transactions RLS → get_my_account_ids() (fn).
-- Depth 1. No cycle.
-- ---------------------------------------------------------------------------

CREATE POLICY "transaction_tags_select"
  ON public.transaction_tags FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE  account_id IN (SELECT public.get_my_account_ids())
    )
  );

CREATE POLICY "transaction_tags_insert"
  ON public.transaction_tags FOR INSERT TO authenticated
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE  account_id IN (SELECT public.get_my_account_ids())
    )
  );

CREATE POLICY "transaction_tags_delete"
  ON public.transaction_tags FOR DELETE TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE  account_id IN (SELECT public.get_my_account_ids())
    )
  );


-- ---------------------------------------------------------------------------
-- account_invites
-- INSERT uses get_my_account_ids() — depth 0.
-- SELECT / UPDATE: role check only (token redemption uses a public SELECT).
-- DELETE: invited_by ownership.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_invites_select"
  ON public.account_invites FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "account_invites_insert"
  ON public.account_invites FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "account_invites_update"
  ON public.account_invites FOR UPDATE
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_invites_delete"
  ON public.account_invites FOR DELETE
  USING (invited_by = auth.uid());


-- ---------------------------------------------------------------------------
-- user_preferences
-- Own row only — depth 0.
-- ---------------------------------------------------------------------------

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- account_settings
-- All policies call get_my_account_ids() — depth 0.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_settings_select"
  ON public.account_settings FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "account_settings_insert"
  ON public.account_settings FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "account_settings_update"
  ON public.account_settings FOR UPDATE TO authenticated
  USING     (account_id IN (SELECT public.get_my_account_ids()))
  WITH CHECK (account_id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "account_settings_delete"
  ON public.account_settings FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.get_my_account_ids()));


-- ---------------------------------------------------------------------------
-- user_profiles
-- Readable by all authenticated users (public profile data).
-- Write: own row only.
-- ---------------------------------------------------------------------------

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_all"
  ON public.user_profiles FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- friends
-- Direct column checks only — depth 0.
-- ---------------------------------------------------------------------------

CREATE POLICY "friends_select"
  ON public.friends FOR SELECT
  USING (
    user_id = auth.uid()
    OR (friend_user_id = auth.uid() AND status <> 'blocked')
  );

CREATE POLICY "friends_insert"
  ON public.friends FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "friends_update"
  ON public.friends FOR UPDATE
  USING (user_id = auth.uid() OR friend_user_id = auth.uid());

CREATE POLICY "friends_delete"
  ON public.friends FOR DELETE
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- user_hidden_categories
-- Own row only — depth 0.
-- ---------------------------------------------------------------------------

CREATE POLICY "user_hidden_categories_all"
  ON public.user_hidden_categories FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- pools
-- Queries pool_members (TERMINAL) — depth 1. No cycle.
-- ---------------------------------------------------------------------------

CREATE POLICY "pools_select"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
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
-- pool_members  *** TERMINAL ***
-- SELECT/INSERT/DELETE: ONLY own rows — no subqueries, no joins.
-- App must use get_pool_members() SECURITY DEFINER fn for full member lists.
-- ---------------------------------------------------------------------------

CREATE POLICY "pm_select"
  ON public.pool_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());  -- TERMINAL

CREATE POLICY "pm_insert"
  ON public.pool_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pm_delete"
  ON public.pool_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- pool_transactions
-- Queries pool_members (TERMINAL) — depth 1. No cycle.
-- ---------------------------------------------------------------------------

CREATE POLICY "ptx_select"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_insert"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_update"
  ON public.pool_transactions FOR UPDATE TO authenticated
  USING     (paid_by = auth.uid())
  WITH CHECK (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_delete"
  ON public.pool_transactions FOR DELETE TO authenticated
  USING (paid_by = auth.uid());


-- ---------------------------------------------------------------------------
-- debts
-- SELECT/UPDATE: direct column checks — depth 0.
-- INSERT: own debt OR pool membership (queries pool_members, TERMINAL) — depth 1.
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
      AND pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "debts_update"
  ON public.debts FOR UPDATE TO authenticated
  USING     (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());


-- =============================================================================
-- Force PostgREST to reload schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';
