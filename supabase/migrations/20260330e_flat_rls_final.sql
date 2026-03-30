-- =============================================================================
-- FLAT RLS ARCHITECTURE — Final, production-safe
-- Generated 2026-03-30 — supersedes all prior RLS migrations
-- (0000_baseline, 20260330a, 20260330b, 20260330c, 20260330d)
--
-- ─── DESIGN PRINCIPLES ───────────────────────────────────────────────────────
--
-- RULE 1 — TERMINAL TABLES
--   account_members: SELECT policy is user_id = auth.uid() ONLY.
--   pool_members:    SELECT policy is user_id = auth.uid() ONLY.
--   These tables have no subqueries, no function calls, no cross-table refs.
--   They are the final authority for membership checks.
--
-- RULE 2 — FLAT POLICIES, NO FUNCTIONS
--   Every RLS policy uses ONLY:
--     • direct column comparisons against auth.uid()
--     • a single EXISTS against account_members or pool_members (terminal)
--   NO security-definer function calls inside policy expressions.
--   Exception: categories SELECT (see rule 3).
--
-- RULE 3 — ONE PERMITTED FUNCTION (get_connected_user_ids)
--   Co-member category visibility is architecturally impossible as flat SQL
--   because account_members terminal RLS hides other users' rows.
--   get_connected_user_ids() reads account_members via SECURITY DEFINER
--   (bypasses RLS). Safety proof below. It is the ONLY function in any policy.
--
-- ─── FULL CYCLE ANALYSIS ─────────────────────────────────────────────────────
--
-- For each policy, trace the complete evaluation path:
--
--   [accounts SELECT]
--     EXISTS → account_members (terminal: user_id = auth.uid())
--     Stack at deepest: [accounts, account_members]
--     account_members SELECT: terminal — no further refs.             ✓ SAFE
--
--   [account_members SELECT] → nothing                                ✓ TERMINAL
--   [account_members INSERT] → nothing                                ✓ TERMINAL
--   [account_members DELETE] → user_id = auth.uid() — nothing        ✓ TERMINAL
--
--   [categories SELECT]
--     → get_connected_user_ids() [SECURITY DEFINER — RLS bypassed]
--       · reads account_members raw (no RLS applied inside fn)
--       · account_members SELECT RLS NOT evaluated inside fn
--       · account_members_select calls: [nothing]
--       · no path back to categories or to get_connected_user_ids()  ✓ SAFE
--
--   [tags SELECT/etc.]
--     EXISTS → account_members (terminal)                            ✓ SAFE
--
--   [transactions SELECT/etc.]
--     EXISTS → account_members (terminal)                            ✓ SAFE
--
--   [transaction_tags SELECT/etc.]
--     EXISTS → transactions JOIN account_members
--     transactions SELECT RLS fires: EXISTS → account_members (terminal)
--     account_members SELECT: terminal — no further refs.
--     Stack at deepest: [transaction_tags, transactions, account_members]
--     account_members terminal: no re-entry of any table in stack.   ✓ SAFE
--
--   [account_invites INSERT]
--     EXISTS → account_members (terminal)                            ✓ SAFE
--
--   [account_settings SELECT/etc.]
--     EXISTS → account_members (terminal)                            ✓ SAFE
--
--   [pools SELECT]
--     EXISTS → pool_members (terminal: user_id = auth.uid())
--     pool_members SELECT: terminal — no refs back to pools.         ✓ SAFE
--
--   [pool_members SELECT/etc.] → nothing                             ✓ TERMINAL
--
--   [pool_transactions SELECT/etc.]
--     EXISTS → pool_members (terminal)                               ✓ SAFE
--
--   [debts INSERT]
--     EXISTS → pool_members (terminal)                               ✓ SAFE
--
-- NO CYCLES DETECTED.
-- NO FUNCTION READS AN RLS-ENABLED TABLE WHOSE POLICIES CALL BACK TO IT.
-- =============================================================================


-- =============================================================================
-- PART 1 — SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- ─── USED IN ONE RLS POLICY ──────────────────────────────────────────────────

-- get_connected_user_ids()
-- PURPOSE: categories SELECT — show co-member categories.
-- READS:   account_members ONLY (raw, RLS bypassed via SECURITY DEFINER).
-- SAFE BECAUSE:
--   · account_members SELECT is terminal (user_id = auth.uid(), no fn calls).
--   · account_members policies do NOT reference categories.
--   · No path from account_members back to this function or to categories.
--   · The function owner (postgres/superuser) bypasses RLS; account_members
--     SELECT RLS is never evaluated inside this function.
--
-- BAD PATTERN 2 CHECK:
--   F reads account_members. Does account_members RLS call F back?
--   → account_members SELECT: user_id = auth.uid() — calls nothing.  ✓ NO CYCLE.
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

-- ─── USED BY APP ONLY (not in any RLS policy) ────────────────────────────────

-- get_account_members(UUID)
-- App-level call to list all members of a shared account.
-- Replaces direct SELECT on account_members (which is terminal — returns own row only).
-- NOT called from any RLS policy → no RLS cycle risk.
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

-- remove_account_member(UUID, UUID)
-- Allows account creator to remove another member.
-- account_members DELETE is now user_id = auth.uid() only (avoids accounts↔account_members
-- chain), so owner-removes-member must go through this function instead of RLS.
-- NOT called from any RLS policy.
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

GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_account_member(UUID, UUID)       TO authenticated;


-- =============================================================================
-- PART 2 — DROP ALL EXISTING POLICIES (idempotent)
-- Covers every name from: 0000_baseline, 20260330a, b, c, d
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
-- Each policy's evalution path annotated. "account_members ✓" means the
-- subquery hits the terminal table and stops there.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- accounts
-- Path: accounts → EXISTS(account_members [terminal]) ✓
-- ---------------------------------------------------------------------------

CREATE POLICY "accounts_select"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = accounts.id
      AND    user_id    = auth.uid()
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
      WHERE  account_id = accounts.id
      AND    user_id    = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = accounts.id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- account_members  *** TERMINAL ***
--
-- SELECT: user_id = auth.uid() only. Zero cross-table references.
--
-- DELETE: user_id = auth.uid() only.
--   The "owner removes a member" operation is handled by the app via:
--   remove_account_member(account_id, user_id) — SECURITY DEFINER procedure,
--   NOT called from RLS. This sidesteps the accounts↔account_members chain
--   that caused recursion in all prior iterations.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());  -- TERMINAL: no subqueries, no functions

CREATE POLICY "account_members_insert"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_members_delete"
  ON public.account_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());  -- Own row only; owner uses remove_account_member()


-- ---------------------------------------------------------------------------
-- categories
-- Path (own): user_id = auth.uid() — direct                              ✓
-- Path (co-member): get_connected_user_ids() [SECURITY DEFINER]
--   → reads account_members raw (RLS bypassed, no chain)
--   → account_members SELECT: terminal, calls nothing, no ref to categories ✓
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
-- Path: tags → EXISTS(account_members [terminal]) ✓
-- ---------------------------------------------------------------------------

CREATE POLICY "tags_select"
  ON public.tags FOR SELECT TO authenticated
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "tags_insert"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "tags_update"
  ON public.tags FOR UPDATE TO authenticated
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id
      AND    user_id    = auth.uid()
    )
  )
  WITH CHECK (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "tags_delete"
  ON public.tags FOR DELETE TO authenticated
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = tags.account_id
      AND    user_id    = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- transactions
-- Path: transactions → EXISTS(account_members [terminal]) ✓
-- ---------------------------------------------------------------------------

CREATE POLICY "transactions_select"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "transactions_insert"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "transactions_update"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id
      AND    user_id    = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "transactions_delete"
  ON public.transactions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = transactions.account_id
      AND    user_id    = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- transaction_tags
-- transaction_tags has no account_id column; must join through transactions.
-- Path: transaction_tags → EXISTS(transactions JOIN account_members)
--   transactions SELECT RLS also fires (EXISTS → account_members [terminal])
--   Stack at deepest: [transaction_tags, transactions]
--   account_members accessed terminally at both levels.
--   No table in the stack is re-entered.                                   ✓
-- ---------------------------------------------------------------------------

CREATE POLICY "transaction_tags_select"
  ON public.transaction_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.transactions  t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id       = transaction_tags.transaction_id
      AND    am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_insert"
  ON public.transaction_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.transactions  t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id       = transaction_tags.transaction_id
      AND    am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_delete"
  ON public.transaction_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.transactions  t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id       = transaction_tags.transaction_id
      AND    am.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- account_invites
-- SELECT/UPDATE: role check — any authenticated user may look up / redeem tokens.
-- INSERT: EXISTS(account_members [terminal]) ✓
-- DELETE: own invited_by column.
-- ---------------------------------------------------------------------------

CREATE POLICY "account_invites_select"
  ON public.account_invites FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "account_invites_insert"
  ON public.account_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_invites.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "account_invites_update"
  ON public.account_invites FOR UPDATE
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_invites_delete"
  ON public.account_invites FOR DELETE
  USING (invited_by = auth.uid());


-- ---------------------------------------------------------------------------
-- user_preferences  — own row only, no table references
-- ---------------------------------------------------------------------------

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- account_settings
-- Path: account_settings → EXISTS(account_members [terminal]) ✓
-- ---------------------------------------------------------------------------

CREATE POLICY "account_settings_select"
  ON public.account_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "account_settings_insert"
  ON public.account_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "account_settings_update"
  ON public.account_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id
      AND    user_id    = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id
      AND    user_id    = auth.uid()
    )
  );

CREATE POLICY "account_settings_delete"
  ON public.account_settings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_settings.account_id
      AND    user_id    = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- user_profiles  — no table references
-- ---------------------------------------------------------------------------

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_all"
  ON public.user_profiles FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- friends  — direct column comparisons only, no table references
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
-- Path: pools → EXISTS(pool_members [terminal]) ✓
-- pool_members SELECT: user_id = auth.uid() only — no ref back to pools.
-- ---------------------------------------------------------------------------

CREATE POLICY "pools_select"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pools.id
      AND    user_id = auth.uid()
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
-- pool_members  *** TERMINAL ***
-- Own rows only. Owner adds/removes via SECURITY DEFINER procedures
-- (add_pool_member, remove_pool_member) which are called by the app.
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
-- Path: pool_transactions → EXISTS(pool_members [terminal]) ✓
-- ---------------------------------------------------------------------------

CREATE POLICY "ptx_select"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_transactions.pool_id
      AND    user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_insert"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_transactions.pool_id
      AND    user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_update"
  ON public.pool_transactions FOR UPDATE TO authenticated
  USING     (paid_by = auth.uid())
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_members
      WHERE  pool_id = pool_transactions.pool_id
      AND    user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_delete"
  ON public.pool_transactions FOR DELETE TO authenticated
  USING (paid_by = auth.uid());


-- ---------------------------------------------------------------------------
-- debts
-- SELECT/UPDATE: direct column checks only.
-- INSERT: own debt OR pool membership — EXISTS(pool_members [terminal]) ✓
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
        WHERE  pool_id = debts.pool_id
        AND    user_id = auth.uid()
      )
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
