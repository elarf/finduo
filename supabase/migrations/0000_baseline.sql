-- =============================================================================
-- BASELINE MIGRATION — Finduo + FinGo complete schema
-- Generated 2026-05-13. Consolidates all prior migrations.
-- Includes explicit role GRANTs required from Supabase October 30 2026.
--
-- Sections:
--   1. Tables (dependency order)
--   2. Indexes
--   3. Enable RLS
--   4. Security Definer Functions + Triggers
--   5. RLS Policies
--   6. Grants
--   7. Seed Data
-- =============================================================================

BEGIN;

-- ===================================================================
-- 1. TABLES
-- ===================================================================

-- 1a. accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  currency   TEXT        NOT NULL,
  created_by UUID        NOT NULL,  -- auth UID as plain value (no FK — auth.users not in transactional graph)
  tag_ids    JSONB       NOT NULL DEFAULT '[]',
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. account_members
CREATE TABLE IF NOT EXISTS public.account_members (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (account_id, user_id)
);

-- 1c. categories
--   user_id is nullable: global system categories (is_default = true) have no owner.
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID    REFERENCES public.accounts(id),  -- legacy, nullable, unused
  name       TEXT    NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  color      TEXT,
  icon       TEXT,
  tag_ids    JSONB   NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  temp_for   JSONB   NOT NULL DEFAULT '[]'
);

-- 1d. tags
CREATE TABLE IF NOT EXISTS public.tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  icon       TEXT
);

-- 1e. transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES public.accounts(id)   ON DELETE CASCADE,
  category_id UUID        REFERENCES public.categories(id)          ON DELETE SET NULL,
  amount      NUMERIC     NOT NULL,
  note        TEXT,
  type        TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
  date        DATE        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1f. transaction_tags
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id         UUID NOT NULL REFERENCES public.tags(id)         ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- 1g. account_invites
CREATE TABLE IF NOT EXISTS public.account_invites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  name       TEXT,
  invited_by UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

-- 1h. user_preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id              UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_order        JSONB   NOT NULL DEFAULT '[]',
  primary_account_id   UUID,
  excluded_account_ids TEXT[]  NOT NULL DEFAULT '{}',
  updated_at           TIMESTAMPTZ
);

-- 1i. account_settings
CREATE TABLE IF NOT EXISTS public.account_settings (
  account_id           UUID        PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  included_in_balance  BOOLEAN     NOT NULL DEFAULT TRUE,
  carry_over_balance   BOOLEAN     NOT NULL DEFAULT TRUE,
  initial_balance      NUMERIC     NOT NULL DEFAULT 0,
  initial_balance_date DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1j. user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT,
  email             TEXT        UNIQUE,
  avatar_url        TEXT,
  avatar_source_url TEXT,  -- OAuth avatar URL for change-detection
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 1k. friends
CREATE TABLE IF NOT EXISTS public.friends (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_user_id)
);

-- 1l. user_hidden_categories
CREATE TABLE IF NOT EXISTS public.user_hidden_categories (
  user_id     UUID NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);

-- 1m. contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name         TEXT        NOT NULL,
  email                TEXT,
  phone                TEXT,
  avatar_url           TEXT,
  source               TEXT        NOT NULL DEFAULT 'manual'
                                   CHECK (source IN ('manual', 'app_user', 'google_sync')),
  google_resource_name TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1n. pools
--   created_by is a plain UUID (no FK to auth.users).
--   Pools are group entities; they must survive user account deletion.
CREATE TABLE IF NOT EXISTS public.pools (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('event', 'continuous')),
  created_by UUID        NOT NULL DEFAULT auth.uid(),
  start_date DATE,
  end_date   DATE,
  status     TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1o. pool_members
--   user_id is nullable for external (non-app) participants.
CREATE TABLE IF NOT EXISTS public.pool_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id       UUID        NOT NULL REFERENCES public.pools(id)    ON DELETE CASCADE,
  user_id       UUID        REFERENCES auth.users(id)               ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'auth',
  external_name TEXT,
  display_name  TEXT,
  contact_id    UUID        REFERENCES public.contacts(id)          ON DELETE SET NULL,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_member_type CHECK (
    (type = 'auth'     AND user_id IS NOT NULL)
    OR
    (type = 'external' AND external_name IS NOT NULL)
  )
);

-- 1p. pool_transactions
CREATE TABLE IF NOT EXISTS public.pool_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID        NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  paid_by     UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  amount      NUMERIC     NOT NULL CHECK (amount > 0),
  description TEXT        NOT NULL DEFAULT '',
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1q. debts
--   from_user / to_user store auth UIDs as plain values (no FK).
--   Debt records must survive user deletion for financial audit trail.
CREATE TABLE IF NOT EXISTS public.debts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user             UUID        NOT NULL,
  to_user               UUID        NOT NULL,
  amount                NUMERIC     NOT NULL CHECK (amount > 0),
  pool_id               UUID        REFERENCES public.pools(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'confirmed', 'paid')),
  from_confirmed        BOOLEAN     NOT NULL DEFAULT FALSE,
  to_confirmed          BOOLEAN     NOT NULL DEFAULT FALSE,
  from_participant_id   UUID,
  to_participant_id     UUID,
  from_participant_name TEXT,
  to_participant_name   TEXT,
  from_contact_id       UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  to_contact_id         UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── FinGo domain ─────────────────────────────────────────────────────────────

-- 1r. assets
CREATE TABLE IF NOT EXISTS public.assets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  type              TEXT        NOT NULL DEFAULT 'vehicle',  -- 'vehicle' | 'bike' | 'shoe' | 'other'
  usage_unit        TEXT        NOT NULL DEFAULT 'km',
  current_usage     NUMERIC     NOT NULL DEFAULT 0,
  total_distance    NUMERIC     NOT NULL DEFAULT 0,
  total_moving_time INTEGER     NOT NULL DEFAULT 0,  -- minutes
  total_elevation   NUMERIC     NOT NULL DEFAULT 0,
  total_rides       INTEGER     NOT NULL DEFAULT 0,
  total_steps       INTEGER     NOT NULL DEFAULT 0,
  icon              TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1s. asset_members
CREATE TABLE IF NOT EXISTS public.asset_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  invited_by UUID        REFERENCES auth.users(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, user_id)
);

-- 1t. asset_parts
CREATE TABLE IF NOT EXISTS public.asset_parts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  usage_unit          TEXT        NOT NULL DEFAULT 'km',
  reset_interval      NUMERIC     NOT NULL,
  usage_at_last_reset NUMERIC     NOT NULL DEFAULT 0,
  priority            INT         NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  warn_at_pct         NUMERIC     NOT NULL DEFAULT 0.8,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1u. asset_categories
CREATE TABLE IF NOT EXISTS public.asset_categories (
  asset_id    UUID NOT NULL REFERENCES public.assets(id)     ON DELETE CASCADE,
  category_id UUID NOT NULL,  -- FK to categories (not enforced — survives category deletion)
  PRIMARY KEY (asset_id, category_id)
);

-- 1v. usage_logs
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  recorded_by       UUID        NOT NULL REFERENCES auth.users(id),
  usage_delta       NUMERIC     NOT NULL,
  usage_after       NUMERIC     NOT NULL,
  moving_time_delta INTEGER,    -- minutes, optional
  elevation_delta   NUMERIC,    -- meters, optional
  source            TEXT        NOT NULL DEFAULT 'odometer',  -- 'odometer' | 'health_connect' | 'gps'
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_expense_id UUID,
  external_id       TEXT,       -- deduplication ID from source system
  notes             TEXT
);

-- 1w. part_service_logs
CREATE TABLE IF NOT EXISTS public.part_service_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id           UUID        NOT NULL REFERENCES public.asset_parts(id) ON DELETE CASCADE,
  usage_at_service  NUMERIC     NOT NULL,
  serviced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_expense_id UUID,
  notes             TEXT
);

-- 1x. components
CREATE TABLE IF NOT EXISTS public.components (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key          TEXT,
  name                  TEXT        NOT NULL,
  asset_type            TEXT        NOT NULL DEFAULT 'other',
  installed_on_asset_id UUID        REFERENCES public.assets(id)     ON DELETE SET NULL,
  parent_component_id   UUID        REFERENCES public.components(id)  ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'installed'
                                    CHECK (status IN ('installed', 'storage', 'retired')),
  installed_at          TIMESTAMPTZ,
  track_distance        NUMERIC     NOT NULL DEFAULT 0,
  track_moving_time     NUMERIC     NOT NULL DEFAULT 0,  -- hours
  track_elapsed_time    NUMERIC     NOT NULL DEFAULT 0,  -- hours
  track_rides           INT         NOT NULL DEFAULT 0,
  track_elevation_gain  NUMERIC     NOT NULL DEFAULT 0,  -- metres
  picture_url           TEXT,
  notes                 TEXT,
  position              INT         NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1y. component_service_intervals
CREATE TABLE IF NOT EXISTS public.component_service_intervals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id        UUID        NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  tracking_method     TEXT        NOT NULL
                                  CHECK (tracking_method IN (
                                    'distance', 'moving_time', 'elapsed_time',
                                    'rides', 'elevation_gain'
                                  )),
  interval_value      NUMERIC     NOT NULL,
  last_serviced_value NUMERIC     NOT NULL DEFAULT 0,
  service_type        TEXT        NOT NULL DEFAULT 'general'
                                  CHECK (service_type IN ('general', 'replace', 'cleaning', 'charge')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1z. component_service_records
CREATE TABLE IF NOT EXISTS public.component_service_records (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID        REFERENCES public.components(id) ON DELETE SET NULL,  -- survives component deletion
  asset_id     UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  serviced_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT,
  cost         NUMERIC,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1aa. component_swaps
CREATE TABLE IF NOT EXISTS public.component_swaps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID        NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  asset_id     UUID        REFERENCES public.assets(id)              ON DELETE SET NULL,
  installed_at TIMESTAMPTZ NOT NULL,
  removed_at   TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===================================================================
-- 2. INDEXES
-- ===================================================================

-- FinDuo domain
CREATE INDEX IF NOT EXISTS idx_categories_user_id          ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_temp_for         ON public.categories USING GIN (temp_for);
CREATE INDEX IF NOT EXISTS idx_account_members_user_id     ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS friends_user_id_idx             ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS friends_friend_user_id_idx      ON public.friends(friend_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_linked_user
  ON public.contacts(owner_id, linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_owner              ON public.contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id                ON public.tags(user_id);

-- Pool domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_members_pool_user
  ON public.pool_members(pool_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pool_members_user_id        ON public.pool_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_contact        ON public.pool_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_pool_transactions_pool_id   ON public.pool_transactions(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_transactions_paid_by   ON public.pool_transactions(paid_by);
CREATE INDEX IF NOT EXISTS idx_debts_from_user             ON public.debts(from_user);
CREATE INDEX IF NOT EXISTS idx_debts_to_user               ON public.debts(to_user);
CREATE INDEX IF NOT EXISTS idx_debts_pool_id               ON public.debts(pool_id);
CREATE INDEX IF NOT EXISTS idx_debts_from_participant      ON public.debts(from_participant_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_participant        ON public.debts(to_participant_id);
CREATE INDEX IF NOT EXISTS idx_debts_from_contact          ON public.debts(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_contact            ON public.debts(to_contact_id);

-- FinGo domain
CREATE INDEX IF NOT EXISTS idx_asset_members_user          ON public.asset_members(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_members_asset         ON public.asset_members(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_parts_asset           ON public.asset_parts(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_categories_asset      ON public.asset_categories(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_categories_category   ON public.asset_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_asset            ON public.usage_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_part_service_logs_part      ON public.part_service_logs(part_id);
CREATE INDEX IF NOT EXISTS idx_components_asset            ON public.components(installed_on_asset_id);
CREATE INDEX IF NOT EXISTS idx_components_parent           ON public.components(parent_component_id);
CREATE INDEX IF NOT EXISTS idx_components_owner            ON public.components(created_by);
CREATE INDEX IF NOT EXISTS idx_csi_component               ON public.component_service_intervals(component_id);
CREATE INDEX IF NOT EXISTS idx_csr_asset                   ON public.component_service_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_csr_component               ON public.component_service_records(component_id);
CREATE INDEX IF NOT EXISTS idx_component_swaps_component   ON public.component_swaps(component_id);


-- ===================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ===================================================================

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
ALTER TABLE public.contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_parts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_service_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_service_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_service_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_swaps        ENABLE ROW LEVEL SECURITY;


-- ===================================================================
-- 4. SECURITY DEFINER FUNCTIONS + TRIGGERS
-- ===================================================================

-- ─── FinDuo helpers ───────────────────────────────────────────────────────────

-- get_connected_user_ids: co-members of all accounts the caller belongs to.
-- Used in categories SELECT policy.
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

-- is_accepted_friend: checks if p_user_id has an accepted friendship with the caller.
-- Used in tags SELECT policy.
CREATE OR REPLACE FUNCTION public.is_accepted_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE  status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_user_id = p_user_id)
        OR (friend_user_id = auth.uid() AND user_id = p_user_id)
      )
  );
$$;

-- auto_add_creator_as_member: trigger function — inserts account creator as owner member.
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
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_creator_as_member();

-- ─── FinDuo RPCs ──────────────────────────────────────────────────────────────

-- get_account_members: returns all members of an account (bypass RLS).
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
  RETURN QUERY SELECT * FROM public.account_members WHERE account_id = p_account_id;
END;
$$;

-- remove_account_member: account owner removes another member.
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

-- delete_own_account: cascade-delete an account and all its children.
CREATE OR REPLACE FUNCTION public.delete_own_account(p_account_id UUID)
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
    RAISE EXCEPTION 'Not the account owner';
  END IF;
  DELETE FROM public.transaction_tags
  WHERE  transaction_id IN (
    SELECT id FROM public.transactions WHERE account_id = p_account_id
  );
  DELETE FROM public.transactions     WHERE account_id = p_account_id;
  DELETE FROM public.tags             WHERE account_id = p_account_id;
  DELETE FROM public.account_invites  WHERE account_id = p_account_id;
  DELETE FROM public.account_members  WHERE account_id = p_account_id;
  DELETE FROM public.account_settings WHERE account_id = p_account_id;
  DELETE FROM public.accounts         WHERE id = p_account_id;
END;
$$;

-- share_account: account owner adds a user as member.
CREATE OR REPLACE FUNCTION public.share_account(
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
    RAISE EXCEPTION 'Only the account owner can share';
  END IF;
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (p_account_id, p_user_id, 'member')
  ON CONFLICT (account_id, user_id) DO NOTHING;
END;
$$;

-- unshare_account: account owner removes a member and marks temp_for on
-- orphaned categories that are still referenced in the removed user's transactions.
CREATE OR REPLACE FUNCTION public.unshare_account(
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
    RAISE EXCEPTION 'Only the account owner can revoke access';
  END IF;
  -- Mark categories that will become orphaned for p_user_id
  UPDATE public.categories c
  SET    temp_for = c.temp_for || jsonb_build_array(p_user_id)
  WHERE
    c.user_id IN (
      SELECT am.user_id
      FROM   public.account_members am
      WHERE  am.account_id = p_account_id
        AND  am.user_id <> p_user_id
        AND  NOT EXISTS (
          SELECT 1
          FROM   public.account_members am1
          JOIN   public.account_members am2 ON am1.account_id = am2.account_id
          WHERE  am1.user_id = am.user_id
            AND  am2.user_id = p_user_id
            AND  am1.account_id <> p_account_id
        )
    )
    AND EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.category_id = c.id
        AND  am.user_id = p_user_id
        AND  t.account_id <> p_account_id
    )
    AND NOT (c.temp_for @> jsonb_build_array(p_user_id));
  DELETE FROM public.account_members
  WHERE  account_id = p_account_id AND user_id = p_user_id;
END;
$$;

-- clone_temp_category: creates an owned copy of a temp category for the caller.
CREATE OR REPLACE FUNCTION public.clone_temp_category(p_category_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat    public.categories%ROWTYPE;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_cat FROM public.categories WHERE id = p_category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;
  IF NOT (v_cat.temp_for @> jsonb_build_array(auth.uid())) THEN
    RAISE EXCEPTION 'You do not have a temp reference to this category';
  END IF;
  INSERT INTO public.categories (name, icon, color, type, is_default, tag_ids, user_id)
  VALUES (v_cat.name, v_cat.icon, v_cat.color, v_cat.type, FALSE, v_cat.tag_ids, auth.uid())
  RETURNING id INTO v_new_id;
  UPDATE public.transactions t
  SET    category_id = v_new_id
  WHERE  t.category_id = p_category_id
    AND  EXISTS (
      SELECT 1 FROM public.account_members am
      WHERE  am.account_id = t.account_id AND am.user_id = auth.uid()
    );
  UPDATE public.categories
  SET    temp_for = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM   jsonb_array_elements(temp_for) AS elem
    WHERE  elem <> to_jsonb(auth.uid())
  )
  WHERE  id = p_category_id;
  RETURN v_new_id;
END;
$$;

-- ─── Pool RPCs ────────────────────────────────────────────────────────────────

-- get_pool_members: returns all members of a pool with contact details.
-- Bypasses RLS (pool_members SELECT is terminal — own rows only).
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS TABLE (
  id                   UUID,
  pool_id              UUID,
  type                 TEXT,
  user_id              UUID,
  external_name        TEXT,
  display_name         TEXT,
  contact_id           UUID,
  contact_display_name TEXT,
  contact_avatar_url   TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  contact_source       TEXT,
  created_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE  pm.pool_id = p_pool_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools p
      WHERE  p.id = p_pool_id AND p.created_by = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT pm.id, pm.pool_id, pm.type, pm.user_id, pm.external_name, pm.display_name,
           pm.contact_id,
           c.display_name AS contact_display_name,
           c.avatar_url   AS contact_avatar_url,
           c.email        AS contact_email,
           c.phone        AS contact_phone,
           c.source       AS contact_source,
           pm.created_at
    FROM   public.pool_members pm
    LEFT   JOIN public.contacts c ON c.id = pm.contact_id
    WHERE  pm.pool_id = p_pool_id
    ORDER  BY pm.created_at ASC;
END;
$$;

-- add_pool_member: pool owner adds an auth user or external participant.
CREATE OR REPLACE FUNCTION public.add_pool_member(
  p_pool_id      UUID,
  p_user_id      UUID   DEFAULT NULL,
  p_display_name TEXT   DEFAULT NULL,
  p_contact_id   UUID   DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type          TEXT;
  v_external_name TEXT;
  v_row           public.pool_members;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pools WHERE id = p_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can add members';
  END IF;
  IF p_user_id IS NOT NULL THEN
    v_type          := 'auth';
    v_external_name := NULL;
  ELSE
    IF TRIM(COALESCE(p_display_name, '')) = '' THEN
      RAISE EXCEPTION 'External participants require a display name';
    END IF;
    v_type          := 'external';
    v_external_name := TRIM(p_display_name);
  END IF;
  INSERT INTO public.pool_members (pool_id, type, user_id, display_name, external_name, contact_id)
  VALUES (p_pool_id, v_type, p_user_id, p_display_name, v_external_name, p_contact_id)
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END;
$$;

-- remove_pool_member: pool owner removes a participant by row id.
CREATE OR REPLACE FUNCTION public.remove_pool_member(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
BEGIN
  SELECT pool_id INTO v_pool_id FROM public.pool_members WHERE id = p_member_id;
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

-- ─── FinGo helpers + RPCs ────────────────────────────────────────────────────

-- is_asset_member: checks if the caller is a member of the given asset.
-- Used in FinGo RLS policies.
CREATE OR REPLACE FUNCTION public.is_asset_member(p_asset_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asset_members
    WHERE  asset_id = p_asset_id AND user_id = auth.uid()
  );
$$;

-- auto_add_asset_owner: trigger function — inserts asset creator as owner member.
CREATE OR REPLACE FUNCTION public.auto_add_asset_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.asset_members (asset_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT (asset_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_asset_owner ON public.assets;
CREATE TRIGGER trg_auto_add_asset_owner
  AFTER INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_asset_owner();

-- update_components_on_usage: propagates usage_log metrics to installed components.
-- moving_time_delta is in minutes; track_moving_time is stored in hours.
CREATE OR REPLACE FUNCTION public.update_components_on_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.components
  SET
    track_distance       = track_distance       + NEW.usage_delta,
    track_rides          = track_rides          + 1,
    track_moving_time    = track_moving_time    + COALESCE(NEW.moving_time_delta, 0) / 60.0,
    track_elevation_gain = track_elevation_gain + COALESCE(NEW.elevation_delta,   0)
  WHERE
    installed_on_asset_id = NEW.asset_id
    AND status = 'installed';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_components_on_usage ON public.usage_logs;
CREATE TRIGGER trg_update_components_on_usage
  AFTER INSERT ON public.usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_components_on_usage();


-- ===================================================================
-- 5. RLS POLICIES
-- ===================================================================

-- ─── account_members (TERMINAL) ──────────────────────────────────────────────
-- SELECT is terminal: only the caller's own row. No subqueries.
-- Other policies that check membership use EXISTS → this table (one hop, no cycle).

CREATE POLICY "account_members_select"
  ON public.account_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "account_members_insert"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "account_members_delete"
  ON public.account_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ─── accounts ────────────────────────────────────────────────────────────────

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
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "accounts_delete"
  ON public.accounts FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ─── categories ──────────────────────────────────────────────────────────────

CREATE POLICY "categories_select"
  ON public.categories FOR SELECT TO authenticated
  USING (
    is_default = TRUE
    OR user_id = auth.uid()
    OR user_id IN (SELECT public.get_connected_user_ids())
    OR temp_for @> jsonb_build_array(auth.uid())
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


-- ─── tags ────────────────────────────────────────────────────────────────────

CREATE POLICY "tags_select"
  ON public.tags FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_accepted_friend(user_id)
  );

CREATE POLICY "tags_insert"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tags_update"
  ON public.tags FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tags_delete"
  ON public.tags FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ─── transactions ─────────────────────────────────────────────────────────────

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


-- ─── transaction_tags ────────────────────────────────────────────────────────

CREATE POLICY "transaction_tags_select"
  ON public.transaction_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id = transaction_tags.transaction_id AND am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_insert"
  ON public.transaction_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id = transaction_tags.transaction_id AND am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_delete"
  ON public.transaction_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.transactions t
      JOIN   public.account_members am ON am.account_id = t.account_id
      WHERE  t.id = transaction_tags.transaction_id AND am.user_id = auth.uid()
    )
  );


-- ─── account_invites ─────────────────────────────────────────────────────────

CREATE POLICY "account_invites_select"
  ON public.account_invites FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "account_invites_insert"
  ON public.account_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE  account_id = account_invites.account_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE  id = account_invites.account_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "account_invites_update"
  ON public.account_invites FOR UPDATE TO authenticated
  USING     (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "account_invites_delete"
  ON public.account_invites FOR DELETE TO authenticated
  USING (invited_by = auth.uid());


-- ─── user_preferences ────────────────────────────────────────────────────────

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─── account_settings ────────────────────────────────────────────────────────

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
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE  id = account_settings.account_id AND created_by = auth.uid()
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
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE  id = account_settings.account_id AND created_by = auth.uid()
    )
  );


-- ─── user_profiles ───────────────────────────────────────────────────────────

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "user_profiles_insert"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_update"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─── friends ─────────────────────────────────────────────────────────────────

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


-- ─── user_hidden_categories ──────────────────────────────────────────────────

CREATE POLICY "user_hidden_categories_all"
  ON public.user_hidden_categories FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─── contacts ────────────────────────────────────────────────────────────────

CREATE POLICY "contacts_select"
  ON public.contacts FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "contacts_insert"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_update"
  ON public.contacts FOR UPDATE TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_delete"
  ON public.contacts FOR DELETE TO authenticated
  USING (owner_id = auth.uid());


-- ─── pool_members (pool-domain TERMINAL) ─────────────────────────────────────
-- SELECT is terminal: only own membership row is visible via direct access.
-- get_pool_members() SECURITY DEFINER is the app path for full lists.

CREATE POLICY "pm_select"
  ON public.pool_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pm_insert"
  ON public.pool_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_members.pool_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "pm_delete"
  ON public.pool_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = pool_members.pool_id AND created_by = auth.uid()
    )
  );


-- ─── pools ───────────────────────────────────────────────────────────────────

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


-- ─── pool_transactions (full-trust: all pool members equal) ──────────────────

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
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
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
      WHERE  pool_id = pool_transactions.pool_id AND user_id = auth.uid()
    )
  );


-- ─── debts ───────────────────────────────────────────────────────────────────

CREATE POLICY "debts_select"
  ON public.debts FOR SELECT TO authenticated
  USING (
    from_user = auth.uid()
    OR to_user = auth.uid()
    OR (
      pool_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pool_members
        WHERE  pool_id = debts.pool_id AND user_id = auth.uid()
      )
    )
  );

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


-- ─── FinGo: assets ───────────────────────────────────────────────────────────

CREATE POLICY "asset_select"
  ON public.assets FOR SELECT
  USING (public.is_asset_member(id));

CREATE POLICY "asset_insert"
  ON public.assets FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "asset_update"
  ON public.assets FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "asset_delete"
  ON public.assets FOR DELETE
  USING (created_by = auth.uid());


-- ─── FinGo: asset_members ────────────────────────────────────────────────────

CREATE POLICY "asset_members_select"
  ON public.asset_members FOR SELECT
  USING (public.is_asset_member(asset_id));

CREATE POLICY "asset_members_insert"
  ON public.asset_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assets
      WHERE  id = asset_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "asset_members_delete"
  ON public.asset_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assets
      WHERE  id = asset_id AND created_by = auth.uid()
    )
  );


-- ─── FinGo: asset_parts ──────────────────────────────────────────────────────

CREATE POLICY "asset_parts_select"
  ON public.asset_parts FOR SELECT
  USING (public.is_asset_member(asset_id));

CREATE POLICY "asset_parts_insert"
  ON public.asset_parts FOR INSERT
  WITH CHECK (public.is_asset_member(asset_id));

CREATE POLICY "asset_parts_update"
  ON public.asset_parts FOR UPDATE
  USING (public.is_asset_member(asset_id));

CREATE POLICY "asset_parts_delete"
  ON public.asset_parts FOR DELETE
  USING (public.is_asset_member(asset_id));


-- ─── FinGo: asset_categories ─────────────────────────────────────────────────

CREATE POLICY "asset_categories_select"
  ON public.asset_categories FOR SELECT
  USING (public.is_asset_member(asset_id));

CREATE POLICY "asset_categories_insert"
  ON public.asset_categories FOR INSERT
  WITH CHECK (public.is_asset_member(asset_id));

CREATE POLICY "asset_categories_delete"
  ON public.asset_categories FOR DELETE
  USING (public.is_asset_member(asset_id));


-- ─── FinGo: usage_logs ───────────────────────────────────────────────────────

CREATE POLICY "usage_logs_select"
  ON public.usage_logs FOR SELECT
  USING (public.is_asset_member(asset_id));

CREATE POLICY "usage_logs_insert"
  ON public.usage_logs FOR INSERT
  WITH CHECK (public.is_asset_member(asset_id) AND recorded_by = auth.uid());

CREATE POLICY "usage_logs_delete"
  ON public.usage_logs FOR DELETE
  USING (recorded_by = auth.uid());


-- ─── FinGo: part_service_logs ────────────────────────────────────────────────

CREATE POLICY "part_service_logs_select"
  ON public.part_service_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_parts p
      WHERE  p.id = part_id AND public.is_asset_member(p.asset_id)
    )
  );

CREATE POLICY "part_service_logs_insert"
  ON public.part_service_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.asset_parts p
      WHERE  p.id = part_id AND public.is_asset_member(p.asset_id)
    )
  );

CREATE POLICY "part_service_logs_delete"
  ON public.part_service_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.asset_parts p
      JOIN   public.assets a ON a.id = p.asset_id
      WHERE  p.id = part_id AND a.created_by = auth.uid()
    )
  );


-- ─── FinGo: components ───────────────────────────────────────────────────────

CREATE POLICY "components_select"
  ON public.components FOR SELECT
  USING (
    (installed_on_asset_id IS NOT NULL AND public.is_asset_member(installed_on_asset_id))
    OR (installed_on_asset_id IS NULL  AND created_by = auth.uid())
  );

CREATE POLICY "components_insert"
  ON public.components FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "components_update"
  ON public.components FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "components_delete"
  ON public.components FOR DELETE
  USING (created_by = auth.uid());


-- ─── FinGo: component_service_intervals ─────────────────────────────────────

CREATE POLICY "csi_select"
  ON public.component_service_intervals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.components c
      WHERE  c.id = component_id
        AND (
          (c.installed_on_asset_id IS NOT NULL AND public.is_asset_member(c.installed_on_asset_id))
          OR (c.installed_on_asset_id IS NULL  AND c.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "csi_insert"
  ON public.component_service_intervals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.components c
      WHERE  c.id = component_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "csi_update"
  ON public.component_service_intervals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.components c
      WHERE  c.id = component_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "csi_delete"
  ON public.component_service_intervals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.components c
      WHERE  c.id = component_id AND c.created_by = auth.uid()
    )
  );


-- ─── FinGo: component_service_records ────────────────────────────────────────

CREATE POLICY "csr_select"
  ON public.component_service_records FOR SELECT
  USING (public.is_asset_member(asset_id));

CREATE POLICY "csr_insert"
  ON public.component_service_records FOR INSERT
  WITH CHECK (public.is_asset_member(asset_id) AND created_by = auth.uid());

CREATE POLICY "csr_delete"
  ON public.component_service_records FOR DELETE
  USING (created_by = auth.uid());


-- ─── FinGo: component_swaps ──────────────────────────────────────────────────

CREATE POLICY "component_swaps_all"
  ON public.component_swaps FOR ALL
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());


-- ===================================================================
-- 6. GRANTS
-- Explicit grants required by Supabase Data API (PostgREST).
-- RLS policies above control per-row access.
-- ===================================================================

-- FinDuo domain
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

-- Pool domain
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pools                  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_members           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_transactions      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts                  TO authenticated, service_role;

-- FinGo domain
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

-- Function execute grants
GRANT EXECUTE ON FUNCTION public.get_connected_user_ids()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accepted_friend(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_asset_member(UUID)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_members(UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_account_member(UUID, UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_account(UUID, UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unshare_account(UUID, UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_temp_category(UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_members(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pool_member(UUID, UUID, TEXT, UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pool_member(UUID)                    TO authenticated;


-- ===================================================================
-- 7. SEED DATA
-- ===================================================================

-- Global Transfer categories — shared by all users, stable UUIDs.
INSERT INTO public.categories (id, name, type, icon, color, is_default, user_id, tag_ids)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'Transfer', 'expense', 'Replace', '#a855f7', TRUE, NULL, '[]'),
  ('00000000-0000-0000-0000-000000000011', 'Transfer', 'income',  'Replace', '#a855f7', TRUE, NULL, '[]')
ON CONFLICT (id) DO NOTHING;


-- ===================================================================
-- Force PostgREST to reload schema cache
-- ===================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
