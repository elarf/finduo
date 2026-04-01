-- =============================================================================
-- FINAL RLS FIX — Eliminate hidden accounts ↔ account_members cycle
-- Generated 2026-03-30 — supersedes 20260330b_reset_rls_complete.sql
--
-- THE HIDDEN CYCLE IN 20260330b
-- ──────────────────────────────
-- account_members DELETE policy queried `accounts` directly:
--   OR account_id IN (SELECT id FROM accounts WHERE created_by = auth.uid())
--
-- PostgreSQL evaluates that subquery by applying accounts SELECT RLS:
--   USING ( created_by = auth.uid()
--           OR id IN (SELECT account_id FROM account_members WHERE ...) )
--
-- That RLS expression queries account_members — but account_members is
-- ALREADY in the evaluation stack (we're processing an account_members policy).
-- PostgreSQL detects the re-entry and raises:
--   "infinite recursion detected in policy for relation account_members"
--
-- WHY IT TRIGGERS EVEN THOUGH account_members SELECT IS "TERMINAL"
-- ─────────────────────────────────────────────────────────────────
-- PostgreSQL's recursion guard is per-table, not per-operation.
-- When it sees account_members re-appear in the stack mid-evaluation,
-- it raises the error immediately — before even executing the SELECT policy.
-- The SELECT policy being simple (`user_id = auth.uid()`) is irrelevant;
-- the re-entry itself is the error.
--
-- THE FIX
-- ───────
-- Rule: accounts and account_members MUST NEVER appear in each other's
--       RLS policy expressions — directly or via any chain.
--
-- 1. accounts SELECT/UPDATE  → use get_my_account_ids() (SECURITY DEFINER)
--    Old: id IN (SELECT account_id FROM account_members WHERE user_id = uid())
--    New: id IN (SELECT get_my_account_ids())
--    → function runs as owner, bypasses RLS on both tables. No RLS triggered.
--
-- 2. account_members DELETE  → use is_account_creator() (SECURITY DEFINER)
--    Old: account_id IN (SELECT id FROM accounts WHERE created_by = uid())
--    New: public.is_account_creator(account_id)
--    → function bypasses accounts RLS. No chain back to account_members.
--
-- FINAL AUTHORIZATION GRAPH (zero cycles)
-- ────────────────────────────────────────
--   account_members  (any) → [nothing / auth.uid() / SECURITY DEFINER fn]
--   accounts         (any) → [auth.uid() / get_my_account_ids() fn]
--   all other tables       → [auth.uid() / get_my_account_ids() fn
--                                        / get_connected_user_ids() fn
--                                        / pool_members (terminal)]
-- =============================================================================


-- =============================================================================
-- PART 1 — SECURITY DEFINER FUNCTIONS
-- All functions run as function owner — bypass RLS on every table they touch.
-- =============================================================================

-- get_my_account_ids()
-- Returns all account IDs accessible to the current user (member + creator).
-- Used by: accounts, tags, transactions, account_invites, account_settings,
--          transaction_tags (indirectly via transactions RLS)
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

-- is_account_creator(UUID)
-- Returns TRUE if the current user created the given account.
-- Used by: account_members DELETE — replaces the direct accounts subquery
--          that previously caused the hidden accounts ↔ account_members cycle.
CREATE OR REPLACE FUNCTION public.is_account_creator(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE  id = p_account_id AND created_by = auth.uid()
  );
$$;

-- get_connected_user_ids()
-- Returns user_ids that share at least one account with the current user.
-- Used by: categories SELECT (co-member category visibility)
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
-- Returns all account_members rows for an account the caller belongs to.
-- Used by: app client — replaces direct SELECT on account_members (which only
--          returns the caller's own row under the terminal SELECT policy).
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
    RETURN;  -- unauthorised — return empty set
  END IF;

  RETURN QUERY
    SELECT * FROM public.account_members WHERE account_id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_account_ids()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_creator(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connected_user_ids()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)     TO authenticated;


-- =============================================================================
-- PART 2 — DROP ALL EXISTING POLICIES (idempotent)
-- Covers names from: 0000_baseline, 20260330a, 20260330b
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
DROP POLICY IF EXISTS "Users manage own hidden categories" ON public.user_hidden_categories;
DROP POLICY IF EXISTS "user_hidden_categories_all"         ON public.user_hidden_categories;

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
-- *** CHANGED FROM 20260330b ***
-- SELECT/UPDATE previously queried account_members directly, which meant:
--   (accounts → account_members) was live inside RLS evaluation.
-- Any code path that entered account_members RLS first would then hit
-- accounts → account_members and cause the in-stack recursion error.
-- FIX: use get_my_account_ids() for SELECT and UPDATE.
--      The SECURITY DEFINER function bypasses RLS on both tables.
--      accounts policies now contain ZERO direct table references.
-- ---------------------------------------------------------------------------

CREATE POLICY "accounts_select"
  ON public.accounts FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "accounts_insert"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accounts_update"
  ON public.accounts FOR UPDATE TO authenticated
  USING     (id IN (SELECT public.get_my_account_ids()))
  WITH CHECK (id IN (SELECT public.get_my_account_ids()));

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- account_members  *** TERMINAL ***
-- *** CHANGED FROM 20260330b ***
-- DELETE previously queried accounts directly:
--   OR account_id IN (SELECT id FROM accounts WHERE created_by = auth.uid())
-- That triggered accounts SELECT RLS, which queries account_members,
-- which was already in the evaluation stack → recursion error.
-- FIX: replace with is_account_creator() SECURITY DEFINER function.
--      The function reads accounts without triggering its RLS.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());  -- TERMINAL: zero subqueries, zero table refs

CREATE POLICY "account_members_insert"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_members_delete"
  ON public.account_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_account_creator(account_id)
  );


-- ---------------------------------------------------------------------------
-- categories
-- SELECT: get_connected_user_ids() (SECURITY DEFINER) — zero RLS chains.
-- Writes: own user_id only.
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
-- get_my_account_ids() — SECURITY DEFINER, zero RLS chain.
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
-- get_my_account_ids() — SECURITY DEFINER, zero RLS chain.
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
-- Subquery against transactions applies transactions RLS (which calls
-- get_my_account_ids — SECURITY DEFINER). Chain depth: 1. No cycle.
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
-- INSERT: get_my_account_ids() — SECURITY DEFINER.
-- SELECT/UPDATE: role check (invite token redemption flow).
-- DELETE: own invited_by.
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
-- user_preferences  — own row only
-- ---------------------------------------------------------------------------

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- account_settings
-- get_my_account_ids() — SECURITY DEFINER, zero RLS chain.
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
-- user_profiles  — readable by all authenticated; writes own row only
-- ---------------------------------------------------------------------------

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_all"
  ON public.user_profiles FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- friends  — direct column checks only
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
-- user_hidden_categories  — own row only
-- ---------------------------------------------------------------------------

CREATE POLICY "user_hidden_categories_all"
  ON public.user_hidden_categories FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- pools
-- Queries pool_members (TERMINAL — SELECT is user_id = auth.uid()).
-- pool_members SELECT never queries pools back. No cycle.
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
-- SELECT/INSERT/DELETE: own rows only — no subqueries, no table references.
-- Full member lists via get_pool_members() SECURITY DEFINER function.
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
-- Queries pool_members (TERMINAL). pool_members SELECT never queries back.
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
-- SELECT/UPDATE: direct column checks.
-- INSERT: own record OR pool membership (pool_members is TERMINAL).
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
