-- =============================================================================
-- CONTACTS SYSTEM — Replace "external users" with a proper Contacts entity
-- Generated 2026-04-02
--
-- This migration:
--   1. Creates the contacts table (per-user address book)
--   2. Adds contact_id to pool_participants
--   3. Adds from_contact_id / to_contact_id to debts
--   4. Fixes debts_select RLS (pool membership fallback for mixed debts)
--   5. Backfills contacts from existing external pool_participants
--   6. Updates SECURITY DEFINER RPCs to join contacts
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: contacts table
-- =============================================================================

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

-- One contact per known auth user per owner (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_linked_user
  ON public.contacts(owner_id, linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS: simple owner-only (no cycles, no subqueries needed)
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


-- =============================================================================
-- STEP 2: Add contact_id to pool_participants
-- =============================================================================

ALTER TABLE public.pool_members
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pp_contact ON public.pool_members(contact_id);


-- =============================================================================
-- STEP 3: Add contact columns to debts
-- =============================================================================

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS from_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS to_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debts_from_contact ON public.debts(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_contact ON public.debts(to_contact_id);


-- =============================================================================
-- STEP 4: Fix debts_select RLS — add pool membership fallback
--
-- The current policy (from_user = auth.uid() OR to_user = auth.uid()) makes
-- mixed debts (auth ↔ external) invisible because the external party's
-- from_user/to_user stores a participant UUID, not an auth UUID.
-- Adding a pool membership fallback is consistent with the full-trust model.
-- =============================================================================

DROP POLICY IF EXISTS "debts_select" ON public.debts;
CREATE POLICY "debts_select"
  ON public.debts FOR SELECT TO authenticated
  USING (
    from_user = auth.uid()
    OR to_user = auth.uid()
    OR (
      pool_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pool_members
        WHERE pool_id = debts.pool_id AND user_id = auth.uid()
      )
    )
  );


-- =============================================================================
-- STEP 5: Backfill contacts from existing data
-- =============================================================================

-- 5a: Create contacts from existing external pool_participants
-- Owned by the pool creator. Uses pool_participants.id as contacts.id
-- to enable simple backfill of pool_participants.contact_id.
INSERT INTO public.contacts (id, owner_id, display_name, source)
SELECT pp.id, p.created_by,
       COALESCE(pp.display_name, 'Unknown'),
       'manual'
FROM public.pool_members pp
JOIN public.pools p ON p.id = pp.pool_id
WHERE pp.type = 'external'
  AND pp.contact_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5b: Backfill contact_id on external pool_participants
UPDATE public.pool_members pp
SET contact_id = pp.id
WHERE pp.type = 'external'
  AND pp.contact_id IS NULL
  AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = pp.id);

-- 5c: Create contacts for auth pool members (from pool creator's perspective)
-- Each auth member the pool creator has invited gets a contact record
INSERT INTO public.contacts (owner_id, linked_user_id, display_name, source)
SELECT DISTINCT p.created_by, pp.user_id,
  COALESCE(up.display_name, up.email, pp.user_id::text),
  'app_user'
FROM public.pool_members pp
JOIN public.pools p ON p.id = pp.pool_id
LEFT JOIN public.user_profiles up ON up.user_id = pp.user_id
WHERE pp.type = 'auth'
  AND pp.user_id IS NOT NULL
  AND pp.user_id != p.created_by  -- skip self
  AND pp.contact_id IS NULL
ON CONFLICT DO NOTHING;

-- 5d: Backfill contact_id on auth pool_participants
UPDATE public.pool_members pp
SET contact_id = c.id
FROM public.contacts c
JOIN public.pools p ON p.id = pp.pool_id
WHERE pp.type = 'auth'
  AND pp.contact_id IS NULL
  AND c.owner_id = p.created_by
  AND c.linked_user_id = pp.user_id;

-- 5e: Backfill from_contact_id / to_contact_id on debts
UPDATE public.debts d
SET from_contact_id = pp.contact_id
FROM public.pool_members pp
WHERE d.from_participant_id = pp.id
  AND d.from_contact_id IS NULL
  AND pp.contact_id IS NOT NULL;

UPDATE public.debts d
SET to_contact_id = pp.contact_id
FROM public.pool_members pp
WHERE d.to_participant_id = pp.id
  AND d.to_contact_id IS NULL
  AND pp.contact_id IS NOT NULL;


-- =============================================================================
-- STEP 6: Replace SECURITY DEFINER RPCs
-- =============================================================================

-- get_pool_members: now joins contacts to return contact display info
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS TABLE (
  id UUID,
  pool_id UUID,
  type TEXT,
  user_id UUID,
  external_name TEXT,
  display_name TEXT,
  contact_id UUID,
  contact_display_name TEXT,
  contact_avatar_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_source TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.pool_members pp2
      WHERE pp2.pool_id = p_pool_id AND pp2.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools p
      WHERE p.id = p_pool_id AND p.created_by = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT pp.id, pp.pool_id, pp.type,
           pp.user_id, pp.external_name, pp.display_name,
           pp.contact_id,
           c.display_name   AS contact_display_name,
           c.avatar_url     AS contact_avatar_url,
           c.email          AS contact_email,
           c.phone          AS contact_phone,
           c.source         AS contact_source,
           pp.created_at
    FROM public.pool_members pp
    LEFT JOIN public.contacts c ON c.id = pp.contact_id
    WHERE pp.pool_id = p_pool_id
    ORDER BY pp.created_at ASC;
END;
$$;


-- add_pool_member: now accepts optional p_contact_id
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
  result          json;
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


-- remove_pool_member: unchanged (contact_id handled by ON DELETE SET NULL on FK)
-- No need to touch this function.


-- =============================================================================
-- Force PostgREST to reload schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
