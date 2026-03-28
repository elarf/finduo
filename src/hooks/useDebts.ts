import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { settlePool as calcSettlement } from '../utils/settlePool';
import type { User } from '@supabase/supabase-js';
import type { AppDebt } from '../types/pools';

export function useDebts(user: User | null) {
  const [debts, setDebts] = useState<AppDebt[]>([]);
  const [loading, setLoading] = useState(false);

  /** Fetch all debts where the current user is either party. */
  const getUserDebts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDebts((data ?? []) as AppDebt[]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load debts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Settle a pool: fetch members + transactions, run settlement algorithm,
   * insert resulting debts as 'pending'.
   */
  const settlePoolDebts = useCallback(async (poolId: string) => {
    if (!user) return;
    try {
      // Fetch participants
      const { data: memberData, error: memberError } = await supabase
        .from('pool_members')
        .select('user_id')
        .eq('pool_id', poolId);
      if (memberError) throw memberError;
      const participants = (memberData ?? []).map((m: any) => m.user_id as string);

      if (participants.length < 2) {
        Alert.alert('Cannot settle', 'Pool needs at least 2 members.');
        return;
      }

      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from('pool_transactions')
        .select('pool_id,paid_by,amount')
        .eq('pool_id', poolId);
      if (txError) throw txError;
      const transactions = (txData ?? []).map((tx: any) => ({
        pool_id: tx.pool_id as string,
        paid_by: tx.paid_by as string,
        amount: Number(tx.amount),
      }));

      if (transactions.length === 0) {
        Alert.alert('Cannot settle', 'No transactions in this pool.');
        return;
      }

      // Run pure settlement
      const settlements = calcSettlement(participants, transactions);

      if (settlements.length === 0) {
        Alert.alert('All settled', 'Everyone paid their fair share.');
        return;
      }

      // Insert debts
      const rows = settlements.map((s) => ({
        from_user: s.from,
        to_user: s.to,
        amount: s.amount,
        pool_id: poolId,
        status: 'pending' as const,
        from_confirmed: false,
        to_confirmed: false,
      }));

      const { error: insertError } = await supabase.from('debts').insert(rows);
      if (insertError) throw insertError;

      // Close the pool
      await supabase.from('pools').update({ status: 'closed' }).eq('id', poolId);

      await getUserDebts();
      Alert.alert('Pool settled', `${settlements.length} debt(s) created.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to settle pool');
    }
  }, [getUserDebts, user]);

  /**
   * Confirm a debt from the current user's side.
   * When both from_confirmed and to_confirmed are true, status becomes 'confirmed'.
   */
  const confirmDebt = useCallback(async (debtId: string) => {
    if (!user) return;
    try {
      // Fetch current state
      const { data: debt, error: fetchError } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single();
      if (fetchError) throw fetchError;

      const isFrom = debt.from_user === user.id;
      const isTo = debt.to_user === user.id;
      if (!isFrom && !isTo) throw new Error('Not involved in this debt');

      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (isFrom) update.from_confirmed = true;
      if (isTo) update.to_confirmed = true;

      // Check if both sides will be confirmed after this update
      const bothConfirmed =
        (isFrom || debt.from_confirmed) && (isTo || debt.to_confirmed);
      if (bothConfirmed) update.status = 'confirmed';

      const { error: updateError } = await supabase
        .from('debts')
        .update(update)
        .eq('id', debtId);
      if (updateError) throw updateError;

      await getUserDebts();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to confirm debt');
    }
  }, [getUserDebts, user]);

  /** Mark a confirmed debt as paid. */
  const markPaid = useCallback(async (debtId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('debts')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', debtId);
      if (error) throw error;
      await getUserDebts();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mark as paid');
    }
  }, [getUserDebts, user]);

  return {
    debts,
    loading,
    getUserDebts,
    settlePoolDebts,
    confirmDebt,
    markPaid,
  };
}
