-- =============================================================================
-- FINAL RLS ARCHITECTURE — zero recursive cycles
-- Generated 2026-03-30 — supersedes all prior RLS migrations
-- (0000_baseline, 20260330a, 20260330b, 20260330c)
--
-- DEPENDENCY GRAPH ANALYSIS PERFORMED BEFORE WRITING ANY POLICY
-- ───────────────────────────────────────────────────────────────
-- For each SECURITY DEFINER function F, verified:
--   "Does any table F reads have an RLS policy that calls F (or F's callers)?"
-- If YES → redesign required (BAD PATTERN 2).
--
-- THE REMAINING CYCLE IN 20260330c
-- ──────────────────────────────────
-- get_my_account_ids() reads: [account_members, accounts]
-- accounts SELECT RLS called: get_my_account_ids()
--   → get_my_account_ids() reads accounts
--     → accounts SELECT RLS calls get_my_account_ids()   ← infinite
--
-- This is BAD PATTERN 2:
--   Function A reads table X
--   X RLS calls function A    (back-reference)
--
-- THE ARCHITECTURAL RULE THAT ELIMINATES ALL CYCLES
-- ─────────────────────────────────────────────────
-- accounts and account_members must each use a dedicated function.
-- Those functions must read ONLY account_members (never accounts).
-- get_my_account_ids() (which reads both tables) is ONLY called by
-- downstream tables (tags, transactions, etc.) whose own RLS policies
-- are never called back by get_my_account_ids().
--
-- FINAL FUNCTION ↔ TABLE DEPENDENCY GRAPH
-- ─────────────────────────────────────────
-- Function                    Reads               Called by RLS of
-- ─────────────────────────── ──────────────────  ──────────────────────────
-- get_my_member_account_ids   account_members     accounts
-- get_my_account_ids          account_members     tags, transactions,
--                             accounts            transaction_tags,
--                                                 account_invites,
--                                                 account_settings
-- is_account_creator          accounts            account_members
-- get_connected_user_ids      account_members     categories
--
-- BAD PATTERN 2 CHECK (function reads X, X RLS calls back to function?)
-- ─────────────────────────────────────────────────────────────────────
-- get_my_member_account_ids → account_members
--   account_members RLS: TERMINAL (user_id = auth.uid(), no function calls)  ✓
--
-- get_my_account_ids → account_members
--   account_members RLS: TERMINAL                                             ✓
-- get_my_account_ids → accounts
--   accounts RLS calls: get_my_member_account_ids (NOT get_my_account_ids)   ✓
--                       NO path back to get_my_account_ids                   ✓
--
-- is_account_creator → accounts
--   accounts RLS calls: get_my_member_account_ids (NOT is_account_creator)   ✓
--                       NO path back to is_account_creator                   ✓
--
-- get_connected_user_ids → account_members
--   account_members RLS: TERMINAL                                             ✓
--
-- BAD PATTERN 1 CHECK (direct cross-reference between accounts/account_members)
-- ───────────────────────────────────────────────────────────────────────────────
-- accounts policies: call get_my_member_account_ids() only, or check
--                    created_by = auth.uid() (no table reference at all)      ✓
-- account_members policies: TERMINAL, or call is_account_creator()
--   is_account_creator reads accounts via SECURITY DEFINER (RLS bypassed)    ✓
--   accounts RLS does NOT reference account_members directly                  ✓
--
-- RESULT: ZERO CYCLES. ZERO RECURSION.
-- =============================================================================


-- =============================================================================
-- PART 1 — SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- get_my_member_account_ids()
-- Reads account_members ONLY.
-- Returns account_ids where the current user has a membership row.
-- Used EXCLUSIVELY by: accounts SELECT, accounts UPDATE.
-- Must never read `accounts` — that would create a cycle because accounts RLS
-- calls this function.
CREATE OR REPLACE FUNCTION public.get_my_member_account_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT account_id
  FROM   public.account_members
  WHERE  user_id = auth.uid();
$$;

-- get_my_account_ids()
-- Reads account_members + accounts.
-- Returns ALL account IDs accessible to the current user (member OR creator).
-- Used by: tags, transactions, transaction_tags, account_invites, account_settings.
-- NOT used by accounts or account_members RLS — doing so would create a cycle
-- because this function reads `accounts` and `accounts` RLS would call it back.
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
-- Reads `accounts` (SECURITY DEFINER — bypasses accounts RLS).
-- Returns TRUE if the current user is the creator of the given account.
-- Used EXCLUSIVELY by: account_members DELETE.
-- accounts RLS does NOT call this function, so no cycle exists.
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
-- Reads account_members ONLY (self-join).
-- Returns user_ids that share at least one account with the current user.
-- Used EXCLUSIVELY by: categories SELECT.
-- account_members RLS is terminal — no cycle possible.
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
-- Reads account_members + accounts (both via SECURITY DEFINER, RLS bypassed).
-- Returns all member rows for an account if caller is a member or creator.
-- Used by the APPLICATION LAYER ONLY — never referenced in any RLS policy.
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
    RETURN;  -- unauthorised — empty set, not an error
  END IF;
  RETURN QUERY
    SELECT * FROM public.account_members WHERE account_id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_member_account_ids()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_account_ids()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_creator(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connected_user_ids()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)     TO authenticated;


-- =============================================================================
-- PART 2 — DROP ALL EXISTING POLICIES (idempotent IF EXISTS)
-- Covers all names from: 0000_baseline, 20260330a, 20260330b, 20260330c
-- =============================================================================

DROP POLICY IF EXISTS "Users can view accounts they own or belong to" ON public.accounts;
DROP POLICY IF EXISTS "Users can create accounts"                      ON public.accounts;
DROP POLICY IF EXISTS "Members can update their accounts"              ON public.accounts;
DROP POLICY IF EXISTS "Owner can delete account"                       ON public.accounts;
DROP POLICY IF EXISTS "accounts_select"                                ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert"                                ON public.accounts;
DROP POLICY IF EXISTS "accounts_update"                                ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete"                                ON public.accounts;

DROP POLICY IF EXISTS "Members can view co-members"           ON public.account_members;
DROP POLICY IF EXISTS "Members can view own membership"       ON public.account_members;
DROP POLICY IF EXISTS "Authenticated users can join accounts" ON public.account_members;
DROP POLICY IF EXISTS "Members can leave or owner can remove" ON public.account_members;
DROP POLICY IF EXISTS "account_members_select"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_insert"                ON public.account_members;
DROP POLICY IF EXISTS "account_members_delete"                ON public.account_members;

DROP POLICY IF EXISTS "Users see own and connected categories" ON public.categories;
DROP POLICY IF EXISTS "Users insert own categories"            ON public.categories;
DROP POLICY IF EXISTS "Users update own categories"            ON public.categories;
DROP POLICY IF EXISTS "Users delete own categories"            ON public.categories;
DROP POLICY IF EXISTS "categories_select"                      ON public.categories;
DROP POLICY IF EXISTS "categories_insert"                      ON public.categories;
DROP POLICY IF EXISTS "categories_update"                      ON public.categories;
DROP POLICY IF EXISTS "categories_delete"                      ON public.categories;

DROP POLICY IF EXISTS "Users can view tags for their accounts or global"   ON public.tags;
DROP POLICY IF EXISTS "Users can insert tags for their accounts or global"  ON public.tags;
DROP POLICY IF EXISTS "Users can update tags for their accounts or global"  ON public.tags;
DROP POLICY IF EXISTS "Users can delete tags for their accounts or global"  ON public.tags;
DROP POLICY IF EXISTS "tags_select"  ON public.tags;
DROP POLICY IF EXISTS "tags_insert"  ON public.tags;
DROP POLICY IF EXISTS "tags_update"  ON public.tags;
DROP POLICY IF EXISTS "tags_delete"  ON public.tags;

DROP POLICY IF EXISTS "Users can view transactions for their accounts"    ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions for their accounts"   ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions for their accounts"   ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions for their accounts"   ON public.transactions;
DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;

DROP POLICY IF EXISTS "Users can view transaction_tags for their accounts"   ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can insert transaction_tags for their accounts"  ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can delete transaction_tags for their accounts"  ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_select" ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_insert" ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_delete" ON public.transaction_tags;

DROP POLICY IF EXISTS "Allow token lookup by authenticated users"       ON public.account_invites;
DROP POLICY IF EXISTS "Account members can create invites"              ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite redemption by authenticated users"  ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite delete by creator"                  ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_select" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_insert" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_update" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_delete" ON public.account_invites;

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_all"         ON public.user_preferences;

DROP POLICY IF EXISTS "Users can view settings for their accounts"    ON public.account_settings;
DROP POLICY IF EXISTS "Users can insert settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "Users can update settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "Users can delete settings for their accounts"   ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_select" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_insert" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_update" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_delete" ON public.account_settings;

DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "Users manage own profile"           ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select"               ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_all"                  ON public.user_profiles;

DROP POLICY IF EXISTS "Participants see own friendships"   ON public.friends;
DROP POLICY IF EXISTS "Users can send friend requests"     ON public.friends;
DROP POLICY IF EXISTS "Participants can update friendship"  ON public.friends;
DROP POLICY IF EXISTS "Requester can delete friendship"    ON public.friends;
DROP POLICY IF EXISTS "friends_select" ON public.friends;
DROP POLICY IF EXISTS "friends_insert" ON public.friends;
DROP POLICY IF EXISTS "friends_update" ON public.friends;
DROP POLICY IF EXISTS "friends_delete" ON public.friends;

DROP POLICY IF EXISTS "Users manage own hidden categories" ON public.user_hidden_categories;
DROP POLICY IF EXISTS "user_hidden_categories_all"         ON public.user_hidden_categories;

DROP POLICY IF EXISTS "pools_select" ON public.pools;
DROP POLICY IF EXISTS "pools_insert" ON public.pools;
DROP POLICY IF EXISTS "pools_update" ON public.pools;
DROP POLICY IF EXISTS "pools_delete" ON public.pools;

DROP POLICY IF EXISTS "pm_select" ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert" ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete" ON public.pool_members;

DROP POLICY IF EXISTS "ptx_select" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_insert" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_update" ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete" ON public.pool_transactions;

DROP POLICY IF EXISTS "debts_select" ON public.debts;
DROP POLICY IF EXISTS "debts_insert" ON public.debts;
DROP POLICY IF EXISTS "debts_update" ON public.debts;
DROP POLICY IF EXISTS "debts_delete" ON public.debts;


-- =============================================================================
-- PART 3 — ENSURE RLS IS ENABLED
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
-- PART 4 — POLICIES
-- =============================================================================


-- ---------------------------------------------------------------------------
-- accounts
--
-- KEY DESIGN: calls get_my_member_account_ids() — reads account_members ONLY.
-- accounts RLS must NEVER call get_my_account_ids() (which reads accounts,
-- creating the function↔table cycle).
--
-- SELECT/UPDATE: check created_by directly (no table lookup) plus membership
--               via get_my_member_account_ids() (reads account_members only).
-- ---------------------------------------------------------------------------

CREATE POLICY "accounts_select"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT public.get_my_member_account_ids())
  );

CREATE POLICY "accounts_insert"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accounts_update"
  ON public.accounts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT public.get_my_member_account_ids())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR id IN (SELECT public.get_my_member_account_ids())
  );

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- account_members  *** TERMINAL ***
--
-- SELECT: ONLY user_id = auth.uid() — no functions, no tables.
-- DELETE: own row OR is_account_creator() SECURITY DEFINER function.
--         is_account_creator reads `accounts` without triggering accounts RLS.
--         accounts RLS does NOT call is_account_creator — no cycle.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());  -- TERMINAL: zero table references

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
-- get_connected_user_ids() reads account_members only.
-- account_members RLS is terminal — no cycle.
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
-- get_my_account_ids() reads account_members + accounts (SECURITY DEFINER).
-- Neither account_members RLS nor accounts RLS calls get_my_account_ids.
-- No cycle.
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
-- get_my_account_ids() — same reasoning as tags.
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
-- Subquery against transactions triggers transactions SELECT RLS.
-- transactions RLS calls get_my_account_ids() (SECURITY DEFINER).
-- Evaluation stack during this: [transaction_tags, transactions].
-- account_members and accounts never enter the RLS eval stack. No cycle.
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
-- INSERT: get_my_account_ids() — same reasoning as tags.
-- SELECT/UPDATE: role check (token redemption by any authenticated user).
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
-- user_preferences  — own row only, no table refs
-- ---------------------------------------------------------------------------

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- account_settings
-- get_my_account_ids() — same reasoning as tags.
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
-- friends  — direct column checks, no table refs, no functions
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
-- Queries pool_members directly. pool_members SELECT is TERMINAL and does
-- not reference pools back. No cycle.
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
-- Own rows only. App uses get_pool_members() SECURITY DEFINER for full lists.
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
-- Queries pool_members (TERMINAL). pool_members SELECT is terminal — no cycle.
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
-- SELECT/UPDATE: direct column checks, no table refs.
-- INSERT: own record OR pool membership (pool_members TERMINAL).
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
