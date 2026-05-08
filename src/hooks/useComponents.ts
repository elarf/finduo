import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';
import type { AssetType, Component, ComponentNode, ComponentStatus } from '../types/fingo';

export function buildTree(flat: Component[]): ComponentNode[] {
  const map = new Map<string, ComponentNode>();
  for (const c of flat) map.set(c.id, { component: c, children: [] });

  const roots: ComponentNode[] = [];
  for (const node of map.values()) {
    const parentId = node.component.parent_component_id;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: ComponentNode[]) => {
    nodes.sort((a, b) => a.component.position - b.component.position);
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

export function useComponents(user: User | null) {
  // keyed by assetId
  const [componentsByAsset, setComponentsByAsset] = useState<Record<string, Component[]>>({});
  const [storageComponents, setStorageComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);

  const loadComponents = useCallback(async (assetId: string) => {
    setLoading(true);
    try {
      logAPI('supabase://components', { source: 'fingo.asset_accordion.parts', action: 'loadComponents' });
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .eq('installed_on_asset_id', assetId)
        .in('status', ['installed', 'storage'])
        .order('position', { ascending: true });
      if (error) throw error;
      setComponentsByAsset((prev) => ({ ...prev, [assetId]: (data ?? []) as Component[] }));
    } catch (err) {
      if (!isMissingTableError(err)) {
        webAlert('Error', err instanceof Error ? err.message : 'Failed to load components');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStorageComponents = useCallback(async (assetType: AssetType) => {
    if (!user) return;
    try {
      logAPI('supabase://components', { source: 'fingo.component_library', action: 'loadStorage' });
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .eq('created_by', user.id)
        .eq('asset_type', assetType)
        .eq('status', 'storage')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStorageComponents((data ?? []) as Component[]);
    } catch (err) {
      if (!isMissingTableError(err)) {
        webAlert('Error', err instanceof Error ? err.message : 'Failed to load storage');
      }
    }
  }, [user]);

  const createComponent = useCallback(async (
    assetId: string,
    assetType: AssetType,
    parentId: string | null,
    templateKey: string | null,
    name: string,
    notes?: string | null,
    installedAt?: string | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://components', { source: 'fingo.component_form', action: 'createComponent' });
      const { error } = await supabase
        .from('components')
        .insert({
          created_by: user.id,
          template_key: templateKey,
          name,
          asset_type: assetType,
          installed_on_asset_id: assetId,
          parent_component_id: parentId,
          status: 'installed' as ComponentStatus,
          installed_at: installedAt ?? new Date().toISOString(),
          notes: notes ?? null,
        });
      if (error) throw error;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create component');
      return false;
    }
  }, [user, loadComponents]);

  const updateComponent = useCallback(async (
    id: string,
    assetId: string,
    patch: Partial<Pick<Component, 'name' | 'notes' | 'picture_url' | 'position' | 'installed_at'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://components', { source: 'fingo.component_form', action: 'updateComponent' });
      const { error } = await supabase.from('components').update(patch).eq('id', id);
      if (error) throw error;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update component');
      return false;
    }
  }, [loadComponents]);

  const uninstallComponent = useCallback(async (id: string, assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://components', { source: 'fingo.component_action', action: 'uninstall' });
      const { error } = await supabase
        .from('components')
        .update({ status: 'storage', installed_on_asset_id: null, parent_component_id: null })
        .eq('id', id);
      if (error) throw error;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to uninstall component');
      return false;
    }
  }, [loadComponents]);

  const installComponent = useCallback(async (
    id: string,
    assetId: string,
    parentId: string | null,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://components', { source: 'fingo.component_library', action: 'install' });
      const { error } = await supabase
        .from('components')
        .update({
          status: 'installed',
          installed_on_asset_id: assetId,
          parent_component_id: parentId,
          installed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to install component');
      return false;
    }
  }, [loadComponents]);

  const retireComponent = useCallback(async (id: string, assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://components', { source: 'fingo.component_action', action: 'retire' });
      const { error } = await supabase
        .from('components')
        .update({ status: 'retired', installed_on_asset_id: null, parent_component_id: null })
        .eq('id', id);
      if (error) throw error;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to retire component');
      return false;
    }
  }, [loadComponents]);

  const deleteComponent = useCallback(async (id: string, assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://components', { source: 'fingo.component_action', action: 'delete' });
      const { error } = await supabase.from('components').delete().eq('id', id);
      if (error) throw error;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete component');
      return false;
    }
  }, [loadComponents]);

  const moveComponent = useCallback(async (
    componentId: string,
    oldAssetId: string,
    newAssetId: string,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://components', { source: 'fingo.component_form', action: 'moveComponent' });
      const allComps = componentsByAsset[oldAssetId] ?? [];

      // Collect the full subtree rooted at componentId
      const subtreeIds: string[] = [];
      const collect = (id: string) => {
        subtreeIds.push(id);
        allComps.filter((c) => c.parent_component_id === id).forEach((c) => collect(c.id));
      };
      collect(componentId);

      await Promise.all(
        subtreeIds.map((id) => {
          const patch: Record<string, string | null> = { installed_on_asset_id: newAssetId };
          if (id === componentId) patch.parent_component_id = null;
          return supabase.from('components').update(patch).eq('id', id);
        }),
      );

      await Promise.all([loadComponents(oldAssetId), loadComponents(newAssetId)]);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to move component');
      return false;
    }
  }, [componentsByAsset, loadComponents]);

  const replaceComponent = useCallback(async (
    oldComponent: Component,
    assetId: string,
    parentId: string | null,
    templateKey: string | null,
    name: string,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://components', { source: 'fingo.component_action', action: 'replace' });
      const { error: retireErr } = await supabase
        .from('components')
        .update({ status: 'retired', installed_on_asset_id: null, parent_component_id: null })
        .eq('id', oldComponent.id);
      if (retireErr) throw retireErr;
      const { error: createErr } = await supabase
        .from('components')
        .insert({
          created_by: user.id,
          template_key: templateKey,
          name,
          asset_type: oldComponent.asset_type,
          installed_on_asset_id: assetId,
          parent_component_id: parentId,
          status: 'installed',
          installed_at: new Date().toISOString(),
        });
      if (createErr) throw createErr;
      await loadComponents(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to replace component');
      return false;
    }
  }, [user, loadComponents]);

  const getTree = useCallback(
    (assetId: string): ComponentNode[] => buildTree(componentsByAsset[assetId] ?? []),
    [componentsByAsset],
  );

  const getAllComponents = useCallback(
    (assetId: string): Component[] => componentsByAsset[assetId] ?? [],
    [componentsByAsset],
  );

  return {
    componentsByAsset,
    storageComponents,
    loading,
    getTree,
    getAllComponents,
    loadComponents,
    loadStorageComponents,
    createComponent,
    updateComponent,
    installComponent,
    uninstallComponent,
    retireComponent,
    deleteComponent,
    moveComponent,
    replaceComponent,
  };
}
