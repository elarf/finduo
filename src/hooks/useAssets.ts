import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';
import type { FinGoAsset, AssetMember, AssetType } from '../types/fingo';

export function useAssets(user: User | null) {
  const [assets, setAssets] = useState<FinGoAsset[]>([]);
  const [members, setMembers] = useState<Record<string, AssetMember[]>>({});
  const [loading, setLoading] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      logAPI('supabase://assets', { source: 'fingo.asset_list.scroll_view', action: 'loadAssets' });
      // RLS ensures we only see assets we're a member of
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssets((data ?? []) as FinGoAsset[]);
    } catch (err) {
      if (!isMissingTableError(err)) {
        webAlert('Error', err instanceof Error ? err.message : 'Failed to load assets');
      }
      // missing table → just stay empty until migration is run
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadAssetMembers = useCallback(async (assetId: string) => {
    try {
      logAPI('supabase://asset_members', { source: 'fingo.asset_accordion.members', action: 'loadAssetMembers' });
      const { data, error } = await supabase
        .from('asset_members')
        .select('*')
        .eq('asset_id', assetId);
      if (error) throw error;
      setMembers((prev) => ({ ...prev, [assetId]: (data ?? []) as AssetMember[] }));
    } catch {
      // non-fatal
    }
  }, []);

  const createAsset = useCallback(async (
    name: string,
    type: AssetType,
    icon?: string | null,
    notes?: string | null,
  ): Promise<FinGoAsset | null> => {
    if (!user) return null;
    try {
      logAPI('supabase://assets', { source: 'fingo.asset_list.add_button', action: 'createAsset' });
      const usageUnit = type === 'shoe' ? 'steps' : type === 'other' ? 'units' : 'km';
      const { data, error } = await supabase
        .from('assets')
        .insert({ name, type, usage_unit: usageUnit, current_usage: 0, created_by: user.id, icon: icon ?? null, notes: notes ?? null })
        .select()
        .single();
      if (error) throw error;
      await loadAssets();
      return (data ?? null) as FinGoAsset | null;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create asset');
      return null;
    }
  }, [user, loadAssets]);

  const updateAsset = useCallback(async (
    assetId: string,
    patch: Partial<Pick<FinGoAsset, 'name' | 'type' | 'usage_unit' | 'icon' | 'notes' | 'current_usage' | 'is_active'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://assets', { source: 'fingo.asset_accordion.edit', action: 'updateAsset' });
      const { error } = await supabase
        .from('assets')
        .update(patch)
        .eq('id', assetId);
      if (error) throw error;
      await loadAssets();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update asset');
      return false;
    }
  }, [loadAssets]);

  const setActiveAsset = useCallback(async (assetId: string, assetType: AssetType): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://assets', { source: 'fingo.asset_modal.set_active', action: 'setActiveAsset' });
      // Deactivate all other assets of the same type for this user
      await supabase
        .from('assets')
        .update({ is_active: false })
        .eq('created_by', user.id)
        .eq('type', assetType)
        .neq('id', assetId);
      const { error } = await supabase
        .from('assets')
        .update({ is_active: true })
        .eq('id', assetId);
      if (error) throw error;
      await loadAssets();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to set active asset');
      return false;
    }
  }, [user, loadAssets]);

  const deleteAsset = useCallback(async (assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://assets', { source: 'fingo.asset_accordion.delete_button', action: 'deleteAsset' });
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);
      if (error) throw error;
      await loadAssets();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete asset');
      return false;
    }
  }, [loadAssets]);

  const addMember = useCallback(async (assetId: string, userId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://asset_members', { source: 'fingo.asset_accordion.add_member', action: 'addMember' });
      const { error } = await supabase
        .from('asset_members')
        .insert({ asset_id: assetId, user_id: userId, role: 'member', invited_by: user.id });
      if (error) throw error;
      await loadAssetMembers(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to add member');
      return false;
    }
  }, [user, loadAssetMembers]);

  const removeMember = useCallback(async (assetId: string, userId: string): Promise<boolean> => {
    try {
      logAPI('supabase://asset_members', { source: 'fingo.asset_accordion.remove_member', action: 'removeMember' });
      const { error } = await supabase
        .from('asset_members')
        .delete()
        .eq('asset_id', assetId)
        .eq('user_id', userId);
      if (error) throw error;
      await loadAssetMembers(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to remove member');
      return false;
    }
  }, [loadAssetMembers]);

  return {
    assets,
    members,
    loading,
    loadAssets,
    loadAssetMembers,
    createAsset,
    updateAsset,
    setActiveAsset,
    deleteAsset,
    addMember,
    removeMember,
  };
}
