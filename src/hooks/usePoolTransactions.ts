import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { PoolTransaction } from '../types/pools';

export function usePoolTransactions(user: User | null) {
  const [transactions, setTransactions] = useState<PoolTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const getPoolTransactions = useCallback(async (poolId: string) => {
    setLoading(true);
    try {
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
