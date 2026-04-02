import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import type { User } from '@supabase/supabase-js';
import type { Pool, PoolType, PoolParticipant } from '../types/pools';

type CreatorProfile = { display_name: string | null; avatar_url: string | null };

export function usePools(user: User | null) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [members, setMembers] = useState<Record<string, PoolParticipant[]>>({});
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, CreatorProfile>>({});
  const [loading, setLoading] = useState(false);

  const getUserPools = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      logAPI('supabase://pools', { source: 'pool_list.scroll_view.root', action: 'getUserPools' });
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const poolList = (data ?? []) as Pool[];
      setPools(poolList);

      // Fetch profile data for all pool creators in one query
      const creatorIds = [...new Set(poolList.map((p) => p.created_by))];
      if (creatorIds.length > 0) {
        logAPI('supabase://user_profiles', { source: 'pool_list.pool_card.creator_avatar', action: 'getCreatorProfiles' });
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', creatorIds);
        const map: Record<string, CreatorProfile> = {};
        (profiles ?? []).forEach((p) => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
        setCreatorProfiles(map);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pools');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createPool = useCallback(async (
    name: string,
    type: PoolType,
    startDate?: string,
    endDate?: string,
  ) => {
    if (!user) return null;
    try {
      logAPI('supabase://pools', { source: 'pool_list.scroll_view.root', action: 'createPool' });
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name,
          type,
          created_by: user.id,
          start_date: startDate ?? null,
          end_date: endDate ?? null,
        })
        .select('*')
        .single();
      if (poolError) throw poolError;

      // Auto-add creator as a participant via RPC (keeps ownership check + type='auth' consistent)
      logAPI('supabase://rpc/add_pool_member', { source: 'pool_list.scroll_view.root', action: 'createPool.addCreator' });
      const { error: memberError } = await supabase.rpc('add_pool_member', {
        p_pool_id: pool.id,
        p_user_id: user.id,
        p_display_name: null,
      });
      if (memberError) throw memberError;

      await getUserPools();
      return pool as Pool;
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create pool');
      return null;
    }
  }, [getUserPools, user]);

  const loadPoolMembers = useCallback(async (poolId: string) => {
    try {
      logAPI('supabase://rpc/get_pool_members', { source: 'pool.member_chips.scroll_view', action: 'loadPoolMembers' });
      const { data, error } = await supabase
        .rpc('get_pool_members', { p_pool_id: poolId });
      if (error) throw error;

      const raw = (data ?? []) as any[];

      // Map RPC return (which now includes joined contact data) to PoolParticipant
      const mapped: PoolParticipant[] = raw.map((m) => ({
        id: m.id,
        pool_id: m.pool_id,
        type: m.type,
        user_id: m.user_id,
        external_name: m.external_name,
        // Prefer contact display_name > participant display_name > external_name
        display_name: m.contact_display_name ?? m.display_name ?? m.external_name,
        // Contact avatar takes priority
        avatar_url: m.contact_avatar_url ?? null,
        contact_id: m.contact_id,
        created_at: m.created_at,
      }));

      // Enrich auth members with avatar_url from user_profiles (if contact doesn't have one)
      const authNeedingAvatar = mapped.filter((m) => m.user_id && !m.avatar_url);
      if (authNeedingAvatar.length > 0) {
        const authIds = authNeedingAvatar.map((m) => m.user_id as string);
        logAPI('supabase://user_profiles', { source: 'pool.member_chips.avatar', action: 'loadMemberProfiles' });
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', authIds);
        const profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
        (profiles ?? []).forEach((p) => { profileMap[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
        const enriched = mapped.map((m) => {
          if (!m.user_id || m.avatar_url) return m;
          const profile = profileMap[m.user_id];
          if (!profile) return m;
          return {
            ...m,
            display_name: m.display_name ?? profile.display_name,
            avatar_url: profile.avatar_url ?? null,
          };
        });
        setMembers((prev) => ({ ...prev, [poolId]: enriched }));
      } else {
        setMembers((prev) => ({ ...prev, [poolId]: mapped }));
      }
    } catch (err) {
      // non-fatal
    }
  }, []);

  const addPoolMember = useCallback(async (
    poolId: string,
    userId: string | null,
    displayName: string,
    contactId?: string | null,
  ) => {
    try {
      logAPI('supabase://rpc/add_pool_member', { source: 'pool.member_chips.scroll_view', action: 'addPoolMember' });
      const { error } = await supabase.rpc('add_pool_member', {
        p_pool_id: poolId,
        p_user_id: userId,
        p_display_name: displayName,
        p_contact_id: contactId ?? null,
      });
      if (error) throw error;
      await loadPoolMembers(poolId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add member');
    }
  }, [loadPoolMembers]);

  const closePool = useCallback(async (poolId: string): Promise<boolean> => {
    try {
      logAPI('supabase://pools', { source: 'pool.summary_card.card', action: 'closePool' });
      const { error } = await supabase
        .from('pools')
        .update({ status: 'closed', end_date: new Date().toISOString().slice(0, 10) })
        .eq('id', poolId);
      if (error) throw error;
      await getUserPools();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to close pool');
      return false;
    }
  }, [getUserPools]);

  const deletePool = useCallback(async (poolId: string) => {
    try {
      logAPI('supabase://pools', { source: 'pool.header.delete_button', action: 'deletePool' });
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('id', poolId);
      if (error) throw error;
      await getUserPools();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete pool');
    }
  }, [getUserPools]);

  return {
    pools,
    members,
    creatorProfiles,
    loading,
    getUserPools,
    createPool,
    addPoolMember,
    loadPoolMembers,
    closePool,
    deletePool,
  };
}
