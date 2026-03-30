import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Pool, PoolType, PoolParticipant } from '../types/pools';

export function usePools(user: User | null) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [members, setMembers] = useState<Record<string, PoolParticipant[]>>({});
  const [loading, setLoading] = useState(false);

  const getUserPools = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPools((data ?? []) as Pool[]);
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
      const { data, error } = await supabase
        .rpc('get_pool_members', { p_pool_id: poolId });
      if (error) throw error;
      setMembers((prev) => ({ ...prev, [poolId]: (data ?? []) as PoolParticipant[] }));
    } catch (err) {
      // non-fatal
    }
  }, []);

  const addPoolMember = useCallback(async (
    poolId: string,
    userId: string | null,
    displayName: string,
  ) => {
    try {
      const { error } = await supabase.rpc('add_pool_member', {
        p_pool_id: poolId,
        p_user_id: userId,
        p_display_name: displayName,
      });
      if (error) throw error;
      await loadPoolMembers(poolId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add member');
    }
  }, [loadPoolMembers]);

  const closePool = useCallback(async (poolId: string) => {
    try {
      const { error } = await supabase
        .from('pools')
        .update({ status: 'closed' })
        .eq('id', poolId);
      if (error) throw error;
      await getUserPools();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to close pool');
    }
  }, [getUserPools]);

  return {
    pools,
    members,
    loading,
    getUserPools,
    createPool,
    addPoolMember,
    loadPoolMembers,
    closePool,
  };
}
