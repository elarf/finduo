-- =============================================================================
-- BASELINE MIGRATION -- Finduo complete schema
-- Generated 2026-03-30 from analysis of all prior migrations.
-- This single file recreates the entire database from scratch.
-- =============================================================================

-- ===================================================================
-- 1. TABLES (dependency order)
-- ===================================================================

-- 1a. accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  currency   TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_ids    JSONB DEFAULT '[]',
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. account_members
CREATE TABLE IF NOT EXISTS public.account_members (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (account_id, user_id)
);

-- 1c. categories
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id),  -- legacy, nullable, unused
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color      TEXT,
  icon       TEXT,
  tag_ids    JSONB DEFAULT '[]'
);

-- 1d. tags
CREATE TABLE IF NOT EXISTS public.tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,  -- nullable = global tag
  name       TEXT NOT NULL,
  color      TEXT,
  icon       TEXT
);

-- 1e. transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  amount      NUMERIC NOT NULL,
  note        TEXT,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  date        DATE NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1f. transaction_tags
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id         UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- 1g. account_invites
CREATE TABLE IF NOT EXISTS public.account_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  name       TEXT,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

-- 1h. user_preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_order        JSONB DEFAULT '[]',
  primary_account_id   UUID,
  excluded_account_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at           TIMESTAMPTZ
);

-- 1i. account_settings
CREATE TABLE IF NOT EXISTS public.account_settings (
  account_id           UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  included_in_balance  BOOLEAN NOT NULL DEFAULT TRUE,
  carry_over_balance   BOOLEAN NOT NULL DEFAULT TRUE,
  initial_balance      NUMERIC NOT NULL DEFAULT 0,
  initial_balance_date DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1j. user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT UNIQUE,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 1k. friends
CREATE TABLE IF NOT EXISTS public.friends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_user_id)
);

-- 1l. user_hidden_categories
CREATE TABLE IF NOT EXISTS public.user_hidden_categories (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);

-- 1m. pools
CREATE TABLE IF NOT EXISTS public.pools (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('event', 'continuous')),
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE,
  end_date   DATE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1n. pool_members
CREATE TABLE IF NOT EXISTS public.pool_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id      UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- nullable for guest members
  display_name TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1o. pool_transactions
CREATE TABLE IF NOT EXISTS public.pool_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1p. debts
CREATE TABLE IF NOT EXISTS public.debts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  pool_id        UUID REFERENCES public.pools(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid')),
  from_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  to_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 2. INDEXES
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_categories_user_id        ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_user_id   ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS friends_user_id_idx           ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS friends_friend_user_id_idx    ON public.friends(friend_user_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_user_id      ON public.pool_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_transactions_pool_id ON public.pool_transactions(pool_id);
CREATE INDEX IF NOT EXISTS idx_debts_from_user           ON public.debts(from_user);
CREATE INDEX IF NOT EXISTS idx_debts_to_user             ON public.debts(to_user);
CREATE INDEX IF NOT EXISTS idx_debts_pool_id             ON public.debts(pool_id);

-- Partial unique: at most one row per (pool, user) for real users
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_members_pool_user
  ON public.pool_members (pool_id, user_id)
  WHERE user_id IS NOT NULL;

-- ===================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE public.accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                 ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 4. RLS POLICIES
-- ===================================================================

-- ----- accounts -----
CREATE POLICY "Users can view accounts they own or belong to"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Members can update their accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner can delete account"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ----- account_members -----
CREATE POLICY "Members can view co-members"
  ON public.account_members FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can join accounts"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Members can leave or owner can remove"
  ON public.account_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );

-- ----- categories -----
CREATE POLICY "Users see own and connected categories"
  ON public.categories FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT DISTINCT am2.user_id
      FROM public.account_members am1
      JOIN public.account_members am2 ON am1.account_id = am2.account_id
      WHERE am1.user_id = auth.uid() AND am2.user_id <> auth.uid()
    )
  );

CREATE POLICY "Users insert own categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own categories"
  ON public.categories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ----- tags -----
CREATE POLICY "Users can view tags for their accounts or global"
  ON public.tags FOR SELECT TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert tags for their accounts or global"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update tags for their accounts or global"
  ON public.tags FOR UPDATE TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete tags for their accounts or global"
  ON public.tags FOR DELETE TO authenticated
  USING (
    account_id IS NULL
    OR account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
  );

-- ----- transactions -----
CREATE POLICY "Users can view transactions for their accounts"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can insert transactions for their accounts"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update transactions for their accounts"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can delete transactions for their accounts"
  ON public.transactions FOR DELETE TO authenticated
  USING (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );

-- ----- transaction_tags -----
CREATE POLICY "Users can view transaction_tags for their accounts"
  ON public.transaction_tags FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
         OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
    )
  );

CREATE POLICY "Users can insert transaction_tags for their accounts"
  ON public.transaction_tags FOR INSERT TO authenticated
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
         OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
    )
  );

CREATE POLICY "Users can delete transaction_tags for their accounts"
  ON public.transaction_tags FOR DELETE TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
         OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
    )
  );

-- ----- account_invites -----
CREATE POLICY "Allow token lookup by authenticated users"
  ON public.account_invites FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Account members can create invites"
  ON public.account_invites FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid())
    OR account_id IN (SELECT id FROM public.accounts WHERE created_by = auth.uid())
  );

CREATE POLICY "Allow invite redemption by authenticated users"
  ON public.account_invites FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow invite delete by creator"
  ON public.account_invites FOR DELETE
  USING (invited_by = auth.uid());

-- ----- user_preferences -----
CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----- account_settings -----
CREATE POLICY "Users can view settings for their accounts"
  ON public.account_settings FOR SELECT TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert settings for their accounts"
  ON public.account_settings FOR INSERT TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update settings for their accounts"
  ON public.account_settings FOR UPDATE TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete settings for their accounts"
  ON public.account_settings FOR DELETE TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE created_by = auth.uid()
      UNION
      SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
    )
  );

-- ----- user_profiles -----
CREATE POLICY "Profiles readable by authenticated"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users manage own profile"
  ON public.user_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----- friends -----
CREATE POLICY "Participants see own friendships"
  ON public.friends FOR SELECT
  USING (
    user_id = auth.uid()
    OR (friend_user_id = auth.uid() AND status <> 'blocked')
  );

CREATE POLICY "Users can send friend requests"
  ON public.friends FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Participants can update friendship"
  ON public.friends FOR UPDATE
  USING (user_id = auth.uid() OR friend_user_id = auth.uid());

CREATE POLICY "Requester can delete friendship"
  ON public.friends FOR DELETE
  USING (user_id = auth.uid());

-- ----- user_hidden_categories -----
CREATE POLICY "Users manage own hidden categories"
  ON public.user_hidden_categories FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----- pools -----
-- DEPENDENCY NOTE: pool_members is a TERMINAL node (policies never cross-reference).
-- pools references pool_members (one-way, no cycle).

CREATE POLICY "pools_select" ON public.pools
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "pools_insert" ON public.pools
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_update" ON public.pools
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "pools_delete" ON public.pools
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ----- pool_members (TERMINAL -- zero cross-table references) -----
CREATE POLICY "pm_select" ON public.pool_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pm_insert" ON public.pool_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pm_delete" ON public.pool_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ----- pool_transactions -----
CREATE POLICY "ptx_select" ON public.pool_transactions
  FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_insert" ON public.pool_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_update" ON public.pool_transactions
  FOR UPDATE TO authenticated
  USING (paid_by = auth.uid())
  WITH CHECK (
    pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "ptx_delete" ON public.pool_transactions
  FOR DELETE TO authenticated
  USING (paid_by = auth.uid());

-- ----- debts -----
CREATE POLICY "debts_select" ON public.debts
  FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "debts_insert" ON public.debts
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    OR (
      pool_id IS NOT NULL
      AND pool_id IN (SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "debts_update" ON public.debts
  FOR UPDATE TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());

-- ===================================================================
-- 5. SECURITY DEFINER FUNCTIONS
-- ===================================================================

-- delete_own_account: cascade-delete an account and all children
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

-- get_pool_members: returns all members of a pool (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS SETOF public.pool_members
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.pools WHERE id = p_pool_id AND created_by = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.pool_members WHERE pool_id = p_pool_id;
END;
$$;

-- add_pool_member: pool owner adds a member (app user or guest)
CREATE OR REPLACE FUNCTION public.add_pool_member(
  p_pool_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.pool_members;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pools WHERE id = p_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can add members';
  END IF;

  INSERT INTO public.pool_members (pool_id, user_id, display_name)
  VALUES (p_pool_id, p_user_id, p_display_name)
  RETURNING * INTO result;

  RETURN row_to_json(result);
END;
$$;

-- remove_pool_member: pool owner removes a member by row id
CREATE OR REPLACE FUNCTION public.remove_pool_member(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
BEGIN
  SELECT pool_id INTO v_pool_id
  FROM public.pool_members WHERE id = p_member_id;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pools WHERE id = v_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can remove members';
  END IF;

  DELETE FROM public.pool_members WHERE id = p_member_id;
END;
$$;

-- ===================================================================
-- 6. GRANTS
-- ===================================================================

GRANT EXECUTE ON FUNCTION public.get_pool_members(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pool_member(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pool_member(UUID)     TO authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
