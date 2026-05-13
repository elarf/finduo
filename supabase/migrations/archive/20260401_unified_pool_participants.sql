-- =============================================================================
-- MIGRATION: Unified Pool Participant System (CORRECTED)
-- =============================================================================
-- ORIGINAL PROBLEMS:
--   pool_transactions.paid_by  →  auth.users(id)   BROKEN for external payers
--   pool_members.user_id       →  nullable hack     no integrity
--
-- THIS MIGRATION:
--   1.  Creates pool_participants (unified auth + external entity)
--   2.  Migrates pool_members data (preserving UUIDs)
--   3.  Remaps pool_transactions.paid_by → pool_participants(id)
--   4.  Drops old RLS policies
--   5.  Enables RLS + new policies on pool_participants
--   6.  New policies on pools, pool_transactions, debts
--   7.  Replaces RPC functions
--   8.  Drops pool_members
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CORRECTIONS APPLIED OVER THE ORIGINAL DRAFT
-- ─────────────────────────────────────────────────────────────────────────────
--
-- FIX 1 — CASCADE/RESTRICT conflict (critical)
--   ORIGINAL: pool_participants.user_id REFERENCES auth.users ON DELETE CASCADE
--   PROBLEM:  auth.users DELETE cascades → tries to delete pool_participants →
--             pool_transactions.paid_by RESTRICT blocks → user deletion fails.
--             The original pool_members schema had no conflict because
--             pool_members.user_id and pool_transactions.paid_by were both
--             direct children of auth.users at the same level. After this
--             migration, paid_by is a grandchild — forming a multi-level
--             chain that RESTRICT breaks.
--   FIX:      ON DELETE RESTRICT on pool_participants.user_id.
--             A user who has financial history cannot delete their account
--             without first leaving all pools. Semantically correct for a
--             financial app. Prevents implicit data loss.
--
-- FIX 2 — Missing FK support index on pool_transactions.paid_by (important)
--   PROBLEM:  The old paid_by → auth.users targeted a PK (always indexed).
--             The new paid_by → pool_participants(id) also targets a PK, so
--             lookups FROM pool_transactions TO pool_participants are indexed.
--             But the REVERSE direction — Postgres scanning pool_transactions
--             to enforce RESTRICT when deleting a pool_participants row — needs
--             an index ON pool_transactions(paid_by). Without it: O(n) scan
--             on every participant removal and every RLS EXISTS check.
--   FIX:      CREATE INDEX idx_pool_transactions_paid_by.
--
-- FIX 3 — debts.from_user / to_user FK to auth.users (rule violation)
--   RULE:     "auth.users is ONLY used for authentication, never as a FK
--             target in transactional tables."
--   PROBLEM:  debts.from_user and debts.to_user REFERENCES auth.users ON DELETE
--             CASCADE. This (a) violates the rule, (b) inserts auth.users into
--             the financial FK graph, (c) silently destroys debt records on
--             account deletion — wrong for a financial audit trail.
--   FIX:      DROP the FK constraints. Columns remain UUID storage (values are
--             auth UIDs, used in RLS via auth.uid() comparisons which do not
--             require a FK). Debt records now survive user deletion — correct.
--
-- FIX 4 — pools.created_by FK to auth.users (same rule violation)
--   PROBLEM:  pools.created_by REFERENCES auth.users ON DELETE CASCADE.
--             Pools are shared group entities; deleting a user should not
--             silently cascade-delete all pools those users created (and all
--             participants and transactions within them). This CASCADE also
--             creates a secondary path by which pool_participants rows get
--             deleted (via pool_id CASCADE), which can race with the
--             pool_transactions RESTRICT in Postgres's cascade resolution
--             order. Removing this FK from the graph eliminates the ambiguity.
--   FIX:      DROP the FK constraint. created_by stores the auth UID as plain
--             data. RLS policies comparing created_by = auth.uid() are
--             unaffected (they are value comparisons, not FK traversals).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FINAL FK GRAPH (strictly DAG — no cycles)
-- ─────────────────────────────────────────────────────────────────────────────
--
--   auth.users (id)
--     ← pool_participants.user_id   RESTRICT   [authentication identity only]
--
--   pools (id)
--     ← pool_participants.pool_id   CASCADE
--     ← pool_transactions.pool_id  CASCADE
--     ← debts.pool_id              SET NULL
--
--   pool_participants (id)
--     ← pool_transactions.paid_by  RESTRICT
--
--   pools.created_by     → plain UUID  (no FK)
--   debts.from_user      → plain UUID  (no FK)
--   debts.to_user        → plain UUID  (no FK)
--
-- DAG proof: no table appears in both the source and target of any cycle.
-- Longest path: auth.users → pool_participants → pool_transactions (depth 3).
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Create pool_participants
-- =============================================================================

CREATE TABLE public.pool_participants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id       UUID        NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('auth', 'external')),

  -- auth members: user_id required, external_name must be null.
  -- RESTRICT (not CASCADE): a user with financial history cannot be deleted
  -- without first leaving all pools (which itself requires no paid transactions).
  user_id       UUID        REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- external members: external_name required, user_id must be null
  external_name TEXT,

  -- denormalized display name for UI (snapshot for auth; equals external_name for external)
  display_name  TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_participant_type CHECK (
    (type = 'auth'     AND user_id IS NOT NULL AND external_name IS NULL)
    OR
    (type = 'external' AND external_name IS NOT NULL AND user_id IS NULL)
  )
);

-- One app-user per pool; multiple external participants allowed
CREATE UNIQUE INDEX idx_pool_participants_pool_user
  ON public.pool_participants (pool_id, user_id)
  WHERE user_id IS NOT NULL;

-- Settlement and membership queries filter by type
CREATE INDEX idx_pool_participants_pool_id_type
  ON public.pool_participants (pool_id, type);

-- =============================================================================
-- STEP 2: Migrate pool_members → pool_participants
--         Preserve existing row UUIDs so the paid_by remap in step 3 works.
-- =============================================================================

INSERT INTO public.pool_participants
  (id, pool_id, type, user_id, display_name, external_name, created_at)
SELECT
  id,
  pool_id,
  CASE WHEN user_id IS NOT NULL THEN 'auth'::TEXT ELSE 'external'::TEXT END,
  user_id,
  display_name,
  CASE WHEN user_id IS NULL THEN COALESCE(NULLIF(TRIM(display_name), ''), 'Unknown') ELSE NULL END,
  joined_at
FROM public.pool_members;

-- =============================================================================
-- STEP 3: Remap pool_transactions.paid_by
--
-- Before: paid_by UUID → auth.users(id)   (stores user UUID)
-- After:  paid_by UUID → pool_participants(id)   (stores participant UUID)
--
-- Map: find the pool_participants row with type='auth', pool_id matches,
--      user_id = old paid_by value.
-- =============================================================================

-- 3a. Drop the old FK (references auth.users — no longer valid target)
ALTER TABLE public.pool_transactions
  DROP CONSTRAINT IF EXISTS pool_transactions_paid_by_fkey;

-- 3b. Remap: replace each user UUID with the corresponding participant UUID
UPDATE public.pool_transactions AS pt
SET    paid_by = pp.id
FROM   public.pool_participants AS pp
WHERE  pp.pool_id = pt.pool_id
  AND  pp.user_id = pt.paid_by   -- paid_by still holds old user UUID at this point
  AND  pp.type    = 'auth';

-- 3c. Safety guard: abort if any rows could not be remapped
--     (indicates the old schema already had a broken FK reference)
DO $$
DECLARE
  orphan_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM   public.pool_transactions pt
  WHERE  NOT EXISTS (
    SELECT 1 FROM public.pool_participants pp WHERE pp.id = pt.paid_by
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % pool_transaction row(s) have a paid_by value that does '
      'not match any pool_participants.id. Fix the orphaned rows and re-run.',
      orphan_count;
  END IF;
END;
$$;

-- 3d. Add new FK: paid_by → pool_participants(id)
--     RESTRICT: a participant who is recorded as a payer cannot be deleted.
--     The remove_pool_member RPC enforces this at the application level too.
ALTER TABLE public.pool_transactions
  ADD CONSTRAINT pool_transactions_paid_by_fkey
  FOREIGN KEY (paid_by)
  REFERENCES public.pool_participants(id)
  ON DELETE RESTRICT;

-- 3e. Index for FK enforcement (Postgres scans pool_transactions.paid_by
--     when checking RESTRICT on participant deletion — needs to be fast)
CREATE INDEX idx_pool_transactions_paid_by
  ON public.pool_transactions (paid_by);

-- =============================================================================
-- STEP 4: Remove auth.users from the transactional FK graph
--
-- pools.created_by and debts.from_user / to_user currently hold FK references
-- to auth.users. These violate the rule: auth.users is for authentication only.
-- Drop the FK constraints; the columns remain as plain UUID storage.
--
-- pools.created_by:   RLS policies use created_by = auth.uid() (value compare,
--                     no FK required). Pools survive user account deletion.
-- debts.from_user /
-- debts.to_user:      RLS policies use from_user = auth.uid() / to_user = auth.uid()
--                     (value compare). Debt records survive user deletion —
--                     correct for a financial audit trail.
-- =============================================================================

ALTER TABLE public.pools
  DROP CONSTRAINT IF EXISTS pools_created_by_fkey;

-- Postgres auto-names inline FK constraints as <table>_<column>_fkey
ALTER TABLE public.debts
  DROP CONSTRAINT IF EXISTS debts_from_user_fkey;

ALTER TABLE public.debts
  DROP CONSTRAINT IF EXISTS debts_to_user_fkey;

-- =============================================================================
-- STEP 5: Drop all old RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "pools_select"  ON public.pools;
DROP POLICY IF EXISTS "pools_insert"  ON public.pools;
DROP POLICY IF EXISTS "pools_update"  ON public.pools;
DROP POLICY IF EXISTS "pools_delete"  ON public.pools;

DROP POLICY IF EXISTS "pm_select"     ON public.pool_members;
DROP POLICY IF EXISTS "pm_insert"     ON public.pool_members;
DROP POLICY IF EXISTS "pm_delete"     ON public.pool_members;

DROP POLICY IF EXISTS "ptx_select"    ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_insert"    ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_update"    ON public.pool_transactions;
DROP POLICY IF EXISTS "ptx_delete"    ON public.pool_transactions;

DROP POLICY IF EXISTS "debts_select"  ON public.debts;
DROP POLICY IF EXISTS "debts_insert"  ON public.debts;
DROP POLICY IF EXISTS "debts_update"  ON public.debts;

-- =============================================================================
-- STEP 6: Enable RLS on pool_participants
-- =============================================================================

ALTER TABLE public.pool_participants ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 7: New RLS policies
--
-- CYCLE SAFETY PROOF
-- ─────────────────────────────────────────────────────────────────────────────
-- Every RLS policy either:
--   (a) terminates at a direct column comparison against auth.uid(), or
--   (b) references a table whose own policy terminates at (a).
-- No policy re-enters the same table that triggered its evaluation.
--
-- pp_select    USING   user_id = auth.uid()
--              ← TERMINAL: no cross-table refs.
--
-- pools_select USING   created_by = auth.uid()           [direct, terminal]
--                   OR EXISTS pool_participants(pp_select → TERMINAL)
--                                                         [one hop, terminal]
--
-- ptx_select   USING   EXISTS pool_participants(pp_select → TERMINAL)
-- ptx_insert   CHECK   EXISTS pool_participants(pp_select → TERMINAL)
--
-- ptx_update   USING   EXISTS pool_participants WHERE id=paid_by
--                                          (pp_select → TERMINAL)
--                   OR EXISTS pools(pools_select → pp_select → TERMINAL)
--              CHECK   EXISTS pool_participants(pp_select → TERMINAL)
--
-- ptx_delete   USING   same as ptx_update — TERMINAL
--
-- debts_insert CHECK   EXISTS pool_participants(pp_select → TERMINAL)
--
-- pp_insert    CHECK   EXISTS pools(pools_select → pp_select → TERMINAL)
--                      Path: pp_insert → pools → pool_participants(pp_select)
--                      No table appears twice in this chain. No cycle.
--
-- pp_delete    USING   same path as pp_insert — no cycle.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── pool_participants ─────────────────────────────────────────────────────────
--
-- SELECT is TERMINAL: only the caller's own auth row is visible via direct
-- table access. All full participant list reads go through get_pool_members()
-- which is SECURITY DEFINER (bypasses RLS). The EXISTS checks in other
-- policies only test user_id = auth.uid() — the terminal policy is exactly
-- sufficient for that purpose without exposing other participants.
CREATE POLICY "pp_select"
  ON public.pool_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only the pool owner may add participants (direct insert path; RPCs use
-- SECURITY DEFINER and bypass this, but the guard is correct for direct access)
CREATE POLICY "pp_insert"
  ON public.pool_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id         = pool_participants.pool_id
        AND  created_by = auth.uid()
    )
  );

CREATE POLICY "pp_delete"
  ON public.pool_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id         = pool_participants.pool_id
        AND  created_by = auth.uid()
    )
  );

-- ── pools ─────────────────────────────────────────────────────────────────────
CREATE POLICY "pools_select"
  ON public.pools FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pools.id
        AND  user_id = auth.uid()
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

-- ── pool_transactions ─────────────────────────────────────────────────────────
CREATE POLICY "ptx_select"
  ON public.pool_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id
        AND  user_id = auth.uid()
    )
  );

CREATE POLICY "ptx_insert"
  ON public.pool_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id
        AND  user_id = auth.uid()
    )
  );

-- UPDATE: allowed if the caller is the recorded payer OR the pool owner.
-- paid_by now references pool_participants.id; resolve to user_id via join.
CREATE POLICY "ptx_update"
  ON public.pool_transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  id      = pool_transactions.paid_by
        AND  user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id         = pool_transactions.pool_id
        AND  created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = pool_transactions.pool_id
        AND  user_id = auth.uid()
    )
  );

-- DELETE: same ownership check as UPDATE
CREATE POLICY "ptx_delete"
  ON public.pool_transactions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  id      = pool_transactions.paid_by
        AND  user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id         = pool_transactions.pool_id
        AND  created_by = auth.uid()
    )
  );

-- ── debts ─────────────────────────────────────────────────────────────────────
-- Debts remain between auth users only. from_user / to_user store auth UIDs
-- as plain UUID values (no FK). RLS value-compares against auth.uid() — this
-- does not require a FK and is unaffected by dropping the FK constraints.
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
        WHERE  pool_id = debts.pool_id
          AND  user_id = auth.uid()
      )
    )
  );

CREATE POLICY "debts_update"
  ON public.debts FOR UPDATE TO authenticated
  USING     (from_user = auth.uid() OR to_user = auth.uid())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid());

-- =============================================================================
-- STEP 8: Replace RPC functions
--
-- All three functions are SECURITY DEFINER: they bypass RLS and operate
-- directly on pool_participants. This is intentional and necessary —
-- pp_select is terminal (only own rows) so non-owner members would not be
-- able to read other participants without a SECURITY DEFINER path.
-- =============================================================================

-- get_pool_members: returns all pool_participants for a given pool.
-- Authorization: caller must be an auth participant in the pool OR the pool owner.
CREATE OR REPLACE FUNCTION public.get_pool_members(p_pool_id UUID)
RETURNS SETOF public.pool_participants
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.pool_participants
      WHERE  pool_id = p_pool_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pools
      WHERE  id = p_pool_id AND created_by = auth.uid()
    )
  ) THEN
    RETURN;  -- not authorised: silently return empty set
  END IF;

  RETURN QUERY
    SELECT * FROM public.pool_participants
    WHERE  pool_id = p_pool_id
    ORDER  BY created_at ASC;
END;
$$;


-- add_pool_member: adds an auth user or external participant to a pool.
-- Only the pool owner may call this.
CREATE OR REPLACE FUNCTION public.add_pool_member(
  p_pool_id      UUID,
  p_user_id      UUID   DEFAULT NULL,
  p_display_name TEXT   DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result          public.pool_participants;
  v_type          TEXT;
  v_external_name TEXT;
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

  INSERT INTO public.pool_participants
    (pool_id, type, user_id, display_name, external_name)
  VALUES
    (p_pool_id, v_type, p_user_id, p_display_name, v_external_name)
  RETURNING * INTO result;

  RETURN row_to_json(result);
END;
$$;


-- remove_pool_member: removes a participant from a pool.
-- Guards: only pool owner may remove; participant must have no paid transactions.
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
  FROM   public.pool_participants
  WHERE  id = p_member_id;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pools
    WHERE id = v_pool_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the pool owner can remove participants';
  END IF;

  -- Application-level guard mirrors the DB-level RESTRICT on paid_by.
  -- Raising a clear error here is better UX than letting the FK violation surface.
  IF EXISTS (
    SELECT 1 FROM public.pool_transactions
    WHERE paid_by = p_member_id
  ) THEN
    RAISE EXCEPTION
      'Cannot remove participant: they are the payer on one or more transactions. '
      'Delete or reassign those transactions first.';
  END IF;

  DELETE FROM public.pool_participants WHERE id = p_member_id;
END;
$$;

-- =============================================================================
-- STEP 9: Drop pool_members
--         All data has been migrated. No remaining FK references to this table.
-- =============================================================================

DROP TABLE public.pool_members;

COMMIT;
