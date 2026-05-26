-- FinGo RLS policies + supporting functions were only in the baseline migration
-- and were never applied to production via a timestamped migration.
-- This migration applies them idempotently.

-- ─── Helper: is_asset_member ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_asset_member(p_asset_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asset_members
    WHERE  asset_id = p_asset_id AND user_id = auth.uid()
  );
$$;

-- ─── Trigger: auto_add_asset_owner ───────────────────────────────────────────

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

-- ─── RLS: assets ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "asset_select"  ON public.assets;
DROP POLICY IF EXISTS "asset_insert"  ON public.assets;
DROP POLICY IF EXISTS "asset_update"  ON public.assets;
DROP POLICY IF EXISTS "asset_delete"  ON public.assets;

CREATE POLICY "asset_select"  ON public.assets FOR SELECT USING (public.is_asset_member(id));
CREATE POLICY "asset_insert"  ON public.assets FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "asset_update"  ON public.assets FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "asset_delete"  ON public.assets FOR DELETE USING (created_by = auth.uid());

-- ─── RLS: asset_members ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "asset_members_select" ON public.asset_members;
DROP POLICY IF EXISTS "asset_members_insert" ON public.asset_members;
DROP POLICY IF EXISTS "asset_members_delete" ON public.asset_members;

CREATE POLICY "asset_members_select"
  ON public.asset_members FOR SELECT
  USING (public.is_asset_member(asset_id));

CREATE POLICY "asset_members_insert"
  ON public.asset_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assets WHERE id = asset_id AND created_by = auth.uid())
  );

CREATE POLICY "asset_members_delete"
  ON public.asset_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assets WHERE id = asset_id AND created_by = auth.uid())
  );

-- ─── RLS: asset_parts ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "asset_parts_select" ON public.asset_parts;
DROP POLICY IF EXISTS "asset_parts_insert" ON public.asset_parts;
DROP POLICY IF EXISTS "asset_parts_update" ON public.asset_parts;
DROP POLICY IF EXISTS "asset_parts_delete" ON public.asset_parts;

CREATE POLICY "asset_parts_select" ON public.asset_parts FOR SELECT USING (public.is_asset_member(asset_id));
CREATE POLICY "asset_parts_insert" ON public.asset_parts FOR INSERT WITH CHECK (public.is_asset_member(asset_id));
CREATE POLICY "asset_parts_update" ON public.asset_parts FOR UPDATE USING (public.is_asset_member(asset_id));
CREATE POLICY "asset_parts_delete" ON public.asset_parts FOR DELETE USING (public.is_asset_member(asset_id));

-- ─── RLS: asset_categories ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "asset_categories_select" ON public.asset_categories;
DROP POLICY IF EXISTS "asset_categories_insert" ON public.asset_categories;
DROP POLICY IF EXISTS "asset_categories_delete" ON public.asset_categories;

CREATE POLICY "asset_categories_select" ON public.asset_categories FOR SELECT USING (public.is_asset_member(asset_id));
CREATE POLICY "asset_categories_insert" ON public.asset_categories FOR INSERT WITH CHECK (public.is_asset_member(asset_id));
CREATE POLICY "asset_categories_delete" ON public.asset_categories FOR DELETE USING (public.is_asset_member(asset_id));

-- ─── RLS: usage_logs ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "usage_logs_select" ON public.usage_logs;
DROP POLICY IF EXISTS "usage_logs_insert" ON public.usage_logs;
DROP POLICY IF EXISTS "usage_logs_update" ON public.usage_logs;
DROP POLICY IF EXISTS "usage_logs_delete" ON public.usage_logs;

CREATE POLICY "usage_logs_select" ON public.usage_logs FOR SELECT USING (public.is_asset_member(asset_id));
CREATE POLICY "usage_logs_insert" ON public.usage_logs FOR INSERT WITH CHECK (public.is_asset_member(asset_id) AND recorded_by = auth.uid());
CREATE POLICY "usage_logs_update" ON public.usage_logs FOR UPDATE USING (recorded_by = auth.uid());
CREATE POLICY "usage_logs_delete" ON public.usage_logs FOR DELETE USING (recorded_by = auth.uid());

-- ─── RLS: part_service_logs ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "part_service_logs_select" ON public.part_service_logs;
DROP POLICY IF EXISTS "part_service_logs_insert" ON public.part_service_logs;
DROP POLICY IF EXISTS "part_service_logs_delete" ON public.part_service_logs;

CREATE POLICY "part_service_logs_select"
  ON public.part_service_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.asset_parts p
    WHERE p.id = part_id AND public.is_asset_member(p.asset_id)
  ));

CREATE POLICY "part_service_logs_insert"
  ON public.part_service_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.asset_parts p
    WHERE p.id = part_id AND public.is_asset_member(p.asset_id)
  ));

CREATE POLICY "part_service_logs_delete"
  ON public.part_service_logs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.asset_parts p
    JOIN public.assets a ON a.id = p.asset_id
    WHERE p.id = part_id AND a.created_by = auth.uid()
  ));

-- ─── RLS: components ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "components_select" ON public.components;
DROP POLICY IF EXISTS "components_insert" ON public.components;
DROP POLICY IF EXISTS "components_update" ON public.components;
DROP POLICY IF EXISTS "components_delete" ON public.components;

CREATE POLICY "components_select"
  ON public.components FOR SELECT
  USING (
    (installed_on_asset_id IS NOT NULL AND public.is_asset_member(installed_on_asset_id))
    OR (installed_on_asset_id IS NULL  AND created_by = auth.uid())
  );
CREATE POLICY "components_insert" ON public.components FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "components_update" ON public.components FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "components_delete" ON public.components FOR DELETE USING (created_by = auth.uid());

-- ─── RLS: component_service_intervals ────────────────────────────────────────

DROP POLICY IF EXISTS "csi_select" ON public.component_service_intervals;
DROP POLICY IF EXISTS "csi_insert" ON public.component_service_intervals;
DROP POLICY IF EXISTS "csi_update" ON public.component_service_intervals;
DROP POLICY IF EXISTS "csi_delete" ON public.component_service_intervals;

CREATE POLICY "csi_select"
  ON public.component_service_intervals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.components c WHERE c.id = component_id
      AND ((c.installed_on_asset_id IS NOT NULL AND public.is_asset_member(c.installed_on_asset_id))
        OR (c.installed_on_asset_id IS NULL AND c.created_by = auth.uid()))
  ));

CREATE POLICY "csi_insert"
  ON public.component_service_intervals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.components c WHERE c.id = component_id AND c.created_by = auth.uid()));

CREATE POLICY "csi_update"
  ON public.component_service_intervals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.components c WHERE c.id = component_id AND c.created_by = auth.uid()));

CREATE POLICY "csi_delete"
  ON public.component_service_intervals FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.components c WHERE c.id = component_id AND c.created_by = auth.uid()));

-- ─── RLS: component_service_records ──────────────────────────────────────────

DROP POLICY IF EXISTS "csr_select" ON public.component_service_records;
DROP POLICY IF EXISTS "csr_insert" ON public.component_service_records;
DROP POLICY IF EXISTS "csr_update" ON public.component_service_records;
DROP POLICY IF EXISTS "csr_delete" ON public.component_service_records;

CREATE POLICY "csr_select" ON public.component_service_records FOR SELECT USING (public.is_asset_member(asset_id));
CREATE POLICY "csr_insert" ON public.component_service_records FOR INSERT WITH CHECK (public.is_asset_member(asset_id) AND created_by = auth.uid());
CREATE POLICY "csr_update" ON public.component_service_records FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "csr_delete" ON public.component_service_records FOR DELETE USING (created_by = auth.uid());

-- ─── RLS: component_swaps ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "component_swaps_all" ON public.component_swaps;

CREATE POLICY "component_swaps_all"
  ON public.component_swaps FOR ALL
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
