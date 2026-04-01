import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { logAPI } from '../lib/devtools';
import type { User } from '@supabase/supabase-js';
import type { PoolTransaction } from '../types/pools';

export function usePoolTransactions(user: User | null) {
  const [transactions, setTransactions] = useState<PoolTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const getPoolTransactions = useCallback(async (poolId: string) => {
    setLoading(true);
    try {
      logAPI('supabase://pool_transactions', { source: 'pool.tx_list.scroll_view', action: 'getPoolTransactions' });
      const { data, error } = await supabase
        .from('pool_transactions')
        .select('*')
        .eq('pool_id', poolId)
        .order('date', { ascending: false });
      if (error) throw error;
      setTransactions((data ?? []) as PoolTransaction[]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  const addPoolTransaction = useCallback(async (
    poolId: string,
    amount: number,
    description: string,
    date: string,
    paidBy?: string,
  ) => {
    if (!user) return null;
    try {
      logAPI('supabase://pool_transactions', { source: 'tx_modal.submit_button', action: 'addPoolTransaction' });
      const { data, error } = await supabase
        .from('pool_transactions')
        .insert({
          pool_id: poolId,
          paid_by: paidBy ?? user.id,
          amount,
          description,
          date,
        })
        .select('*')
        .single();
      if (error) throw error;
      await getPoolTransactions(poolId);
      return data as PoolTransaction;
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add transaction');
      return null;
    }
  }, [getPoolTransactions, user]);

  const updatePoolTransaction = useCallback(async (
    txId: string,
    poolId: string,
    amount: number,
    description: string,
    paidBy?: string,
  ) => {
    if (!user) return null;
    try {
      logAPI('supabase://pool_transactions', { source: 'tx_modal.submit_button', action: 'updatePoolTransaction' });
      const { data, error } = await supabase
        .from('pool_transactions')
        .update({
          amount,
          description,
          paid_by: paidBy ?? user.id,
        })
        .eq('id', txId)
        .select('*')
        .single();
      if (error) throw error;
      await getPoolTransactions(poolId);
      return data as PoolTransaction;
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update transaction');
      return null;
    }
  }, [getPoolTransactions, user]);

  const deletePoolTransaction = useCallback(async (txId: string, poolId: string) => {
    try {
      logAPI('supabase://pool_transactions', { source: 'pool.tx_list.delete_button', action: 'deletePoolTransaction' });
      const { error } = await supabase
        .from('pool_transactions')
        .delete()
        .eq('id', txId);
      if (error) throw error;
      await getPoolTransactions(poolId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  }, [getPoolTransactions]);

  return {
    transactions,
    loading,
    getPoolTransactions,
    addPoolTransaction,
    updatePoolTransaction,
    deletePoolTransaction,
  };
}
