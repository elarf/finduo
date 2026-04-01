-- =============================================================================
-- PRODUCTION FULL FIX — 2026-04-01
--
-- Root cause: Multiple migrations were never applied to production. The DB is
-- essentially at baseline + some manually added "_all" catch-all policies.
--
-- This migration is IDEMPOTENT and SAFE to re-run.
--
-- FIXES:
--   A. Missing RLS policies on 6 tables (friends, user_profiles, etc.)
--   B. Missing columns on pool_members (type, external_name, contact_id)
--   C. Missing columns on debts (participant + contact columns)
--   D. Missing contacts table
--   E. Outdated RPCs (get_pool_members, add_pool_member)
--
-- DOES NOT TOUCH:
--   - Existing "_all" catch-all policies on working tables
--   - pool_debts, pool_expenses, pool_settlements, recurring (unknown tables)
--   - Any FK changes (pools.created_by, debts FK — left as baseline)
-- =============================================================================

BEGIN;

-- =============================================================================
-- PHASE 1: SCHEMA ADDITIONS (safe, idempotent)
-- =============================================================================

-- ── 1a. pool_members: add missing columns ──────────────────────────────────
-- Baseline only has: id, pool_id, user_id, display_name, joined_at
-- App expects: type, external_name, contact_id, created_at

ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'auth';

ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS external_name TEXT;

ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS contact_id UUID;

ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Backfill created_at from joined_at for existing rows
UPDATE public.pool_members
SET created_at = COALESCE(joined_at, NOW())
WHERE created_at IS NULL;

-- Set type for existing rows (all with user_id are 'auth', without are 'external')
UPDATE public.pool_members
SET type = CASE
  WHEN user_id IS NOT NULL THEN 'auth'
  ELSE 'external'
END
WHERE type = 'auth' AND user_id IS NULL;

-- ── 1b. debts: add missing participant/contact columns ──────────────────────
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_participant_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_participant_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_participant_name TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_participant_name TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_contact_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_contact_id UUID;

CREATE INDEX IF NOT EXISTS idx_debts_from_participant ON public.debts(from_participant_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_participant ON public.debts(to_participant_id);
CREATE INDEX IF NOT EXISTS idx_debts_from_contact ON public.debts(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_contact ON public.debts(to_contact_id);

-- ── 1c. contacts table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name          TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  avatar_url            TEXT,
  source                TEXT NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('manual', 'app_user', 'google_sync')),
  google_resource_name  TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_linked_user
  ON public.contacts(owner_id, linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Add FK from pool_members.contact_id → contacts now that table exists
-- (ADD CONSTRAINT IF NOT EXISTS not available; use DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pool_members_contact_id_fkey'
      AND table_name = 'pool_members'
  ) THEN
    ALTER TABLE public.pool_members
      ADD CONSTRAINT pool_members_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pm_contact ON public.pool_members(contact_id);

-- Add FK from debts contact columns → contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'debts_from_contact_id_fkey'
      AND table_name = 'debts'
  ) THEN
    ALTER TABLE public.debts
      ADD CONSTRAINT debts_from_contact_id_fkey
      FOREIGN KEY (from_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'debts_to_contact_id_fkey'
      AND table_name = 'debts'
  ) THEN
    ALTER TABLE public.debts
      ADD CONSTRAINT debts_to_contact_id_fkey
      FOREIGN KEY (to_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END;
$$;


-- =============================================================================
-- PHASE 2: MISSING RLS POLICIES
-- Only creates policies on tables that currently have ZERO policies.
-- Uses DROP IF EXISTS first so this is safe to re-run.
-- =============================================================================

-- ── 2a. friends (0 policies → 4) ───────────────────────────────────────────
DROP POLICY IF EXISTS "friends_select" ON public.friends;
DROP POLICY IF EXISTS "friends_insert" ON public.friends;
DROP POLICY IF EXISTS "friends_update" ON public.friends;
DROP POLICY IF EXISTS "friends_delete" ON public.friends;
-- Also drop old baseline names in case they survive
DROP POLICY IF EXISTS "Participants see own friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friends;
DROP POLICY IF EXISTS "Participants can update friendship" ON public.friends;
DROP POLICY IF EXISTS "Requester can delete friendship" ON public.friends;

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


-- ── 2b. user_profiles (0 policies → 3) ─────────────────────────────────────
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_all" ON public.user_profiles;
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;

CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_profiles_insert"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_update"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── 2c. user_preferences (0 policies → 1) ──────────────────────────────────
DROP POLICY IF EXISTS "user_preferences_all" ON public.user_preferences;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;

CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── 2d. user_hidden_categories (0 policies → 1) ────────────────────────────
DROP POLICY IF EXISTS "user_hidden_categories_all" ON public.user_hidden_categories;
DROP POLICY IF EXISTS "Users manage own hidden categories" ON public.user_hidden_categories;

CREATE POLICY "user_hidden_categories_all"
  ON public.user_hidden_categories FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── 2e. account_invites (0 policies → 4) ───────────────────────────────────
DROP POLICY IF EXISTS "account_invites_select" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_insert" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_update" ON public.account_invites;
DROP POLICY IF EXISTS "account_invites_delete" ON public.account_invites;
DROP POLICY IF EXISTS "Allow token lookup by authenticated users" ON public.account_invites;
DROP POLICY IF EXISTS "Account members can create invites" ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite redemption by authenticated users" ON public.account_invites;
DROP POLICY IF EXISTS "Allow invite delete by creator" ON public.account_invites;

CREATE POLICY "account_invites_select"
  ON public.account_invites FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "account_invites_insert"
  ON public.account_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_id = account_invites.account_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_invites.account_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "account_invites_update"
  ON public.account_invites FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "account_invites_delete"
  ON public.account_invites FOR DELETE TO authenticated
  USING (invited_by = auth.uid());


-- ── 2f. transaction_tags (0 policies → 3) ──────────────────────────────────
DROP POLICY IF EXISTS "transaction_tags_select" ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_insert" ON public.transaction_tags;
DROP POLICY IF EXISTS "transaction_tags_delete" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can view transaction_tags for their accounts" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can insert transaction_tags for their accounts" ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can delete transaction_tags for their accounts" ON public.transaction_tags;

CREATE POLICY "transaction_tags_select"
  ON public.transaction_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.account_members am ON am.account_id = t.account_id
      WHERE t.id = transaction_tags.transaction_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_insert"
  ON public.transaction_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.account_members am ON am.account_id = t.account_id
      WHERE t.id = transaction_tags.transaction_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_tags_delete"
  ON public.transaction_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.account_members am ON am.account_id = t.account_id
      WHERE t.id = transaction_tags.transaction_id
        AND am.user_id = auth.uid()
    )
  );


-- ── 2g. contacts (new table → 4 policies) ──────────────────────────────────
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;

CREATE POLICY "contacts_select"
  ON public.contacts FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "contacts_insert"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_update"
  ON public.contacts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_delete"
  ON public.contacts FOR DELETE TO authenticated
  USING (owner_id = auth.uid());


-- ── 2h. account_settings: add missing insert/delete ────────────────────────
-- Production has select + update only
DROP POLICY IF EXISTS "account_settings_insert" ON public.account_settings;
DROP POLICY IF EXISTS "account_settings_delete" ON public.account_settings;

CREATE POLICY "account_settings_insert"
  ON public.account_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_id = account_settings.account_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_settings.account_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "account_settings_delete"
  ON public.account_settings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_id = account_settings.account_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_settings.account_id AND created_by = auth.uid()
    )
  );


-- =============================================================================
-- PHASE 3: UPDATE RPCs
-- The production RPCs are baseline versions that don't support contacts or
-- the type/external_name columns. Replace them.
-- =============================================================================

-- ── 3a. get_pool_members ────────────────────────────────────────────────────
-- Must DROP first because return type changes (SETOF pool_members → TABLE)
DROP FUNCTION IF EXISTS public.get_pool_members(UUID);

CREATE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS TABLE (
  id                     UUID,
  pool_id                UUID,
  type                   TEXT,
  user_id                UUID,
  external_name          TEXT,
  display_name           TEXT,
  contact_id             UUID,
  contact_display_name   TEXT,
  contact_avatar_url     TEXT,
  contact_email          TEXT,
  contact_phone          TEXT,
  contact_source         TEXT,
  created_at             TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Authorization: must be pool member or pool owner
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE pm.pool_id = p_pool_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools p
      WHERE p.id = p_pool_id AND p.created_by = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      pm.id,
      pm.pool_id,
      pm.type,
      pm.user_id,
      pm.external_name,
      pm.display_name,
      pm.contact_id,
      c.display_name   AS contact_display_name,
      c.avatar_url     AS contact_avatar_url,
      c.email          AS contact_email,
      c.phone          AS contact_phone,
      c.source         AS contact_source,
      COALESCE(pm.created_at, pm.joined_at) AS created_at
    FROM public.pool_members pm
    LEFT JOIN public.contacts c ON c.id = pm.contact_id
    WHERE pm.pool_id = p_pool_id
    ORDER BY COALESCE(pm.created_at, pm.joined_at) ASC;
END;
$$;


-- ── 3b. add_pool_member ─────────────────────────────────────────────────────
-- Must DROP first because param signature changes (3 → 4 params)
DROP FUNCTION IF EXISTS public.add_pool_member(UUID, UUID, TEXT);
-- Also drop the 4-param version in case this runs twice
DROP FUNCTION IF EXISTS public.add_pool_member(UUID, UUID, TEXT, UUID);

CREATE FUNCTION public.add_pool_member(
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
    SELECT 1 FROM public.pools
    WHERE id = p_pool_id AND created_by = auth.uid()
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

  INSERT INTO public.pool_members
    (pool_id, type, user_id, display_name, external_name, contact_id)
  VALUES
    (p_pool_id, v_type, p_user_id, p_display_name, v_external_name, p_contact_id)
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;


-- ── 3c. remove_pool_member (update to reference pool_members correctly) ─────
DROP FUNCTION IF EXISTS public.remove_pool_member(UUID);

CREATE FUNCTION public.remove_pool_member(p_member_id UUID)
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
    SELECT 1 FROM public.pools
    WHERE id = v_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can remove members';
  END IF;

  DELETE FROM public.pool_members WHERE id = p_member_id;
END;
$$;


-- ── 3d. Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_pool_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pool_member(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pool_member(UUID) TO authenticated;


-- =============================================================================
-- PHASE 4: Force PostgREST to reload schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
