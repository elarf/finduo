import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { settlePool as calcSettlement } from '../utils/settlePool';
import type { User } from '@supabase/supabase-js';
import type { AppDebt, PreTransaction } from '../types/pools';

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
   * PURE DERIVATION — no DB writes.
   * Fetches pool members and transactions, runs the settlement algorithm, and
   * returns PreTransaction[] for the caller to preview before committing.
   * Throws on validation failures so the caller can show appropriate UI feedback.
   */
  const computePoolSettlement = useCallback(async (poolId: string): Promise<PreTransaction[]> => {
    if (!user) return [];

    // Fetch participants via RPC (direct query only returns own row due to terminal RLS)
    const { data: memberData, error: memberError } = await supabase
      .rpc('get_pool_members', { p_pool_id: poolId });
    if (memberError) throw memberError;

    // Build participant_id → user_id map (auth members only).
    // External participants can pay but are not in the debt graph.
    const participantIdToUserId = new Map<string, string>(
      (memberData ?? [])
        .filter((m: any) => m.user_id != null)
        .map((m: any) => [m.id as string, m.user_id as string]),
    );

    const participants = Array.from(participantIdToUserId.values());

    if (participants.length < 2) {
      throw new Error('Pool needs at least 2 members to settle.');
    }

    const { data: txData, error: txError } = await supabase
      .from('pool_transactions')
      .select('pool_id,paid_by,amount')
      .eq('pool_id', poolId);
    if (txError) throw txError;

    if (!txData || txData.length === 0) {
      throw new Error('No transactions in this pool.');
    }

    const transactions = (txData ?? []).map((tx: any) => ({
      pool_id: tx.pool_id as string,
      paid_by: participantIdToUserId.get(tx.paid_by as string) ?? tx.paid_by as string,
      amount: Number(tx.amount),
    }));

    const settlements = calcSettlement(participants, transactions);

    return settlements.map((s) => ({
      fromParticipantId: s.from,
      toParticipantId: s.to,
      amount: s.amount,
      metadata: { reason: 'settlement' as const, sourcePoolId: poolId },
    }));
  }, [user]);

  /**
   * WRITE — commits pre-transactions to the debts table and closes the pool.
   * Only called after the user explicitly confirms the settlement preview.
   */
  const commitPoolSettlement = useCallback(async (
    poolId: string,
    preTxs: PreTransaction[],
  ): Promise<void> => {
    if (!user || preTxs.length === 0) return;

    const rows = preTxs.map((p) => ({
      from_user: p.fromParticipantId,
      to_user: p.toParticipantId,
      amount: p.amount,
      pool_id: p.metadata.sourcePoolId,
      status: 'pending' as const,
      from_confirmed: false,
      to_confirmed: false,
    }));

    const { error: insertError } = await supabase.from('debts').insert(rows);
    if (insertError) throw insertError;

    await supabase.from('pools').update({ status: 'closed' }).eq('id', poolId);

    await getUserDebts();
  }, [getUserDebts, user]);

  /**
   * One-step settle used by PoolScreen's Settle button — preserves existing behaviour.
   * Internally delegates to the two-step compute → commit pathway.
   */
  const settlePoolDebts = useCallback(async (poolId: string) => {
    if (!user) return;
    try {
      const preTxs = await computePoolSettlement(poolId);
      if (preTxs.length === 0) {
        Alert.alert('All settled', 'Everyone paid their fair share.');
        return;
      }
      await commitPoolSettlement(poolId, preTxs);
      Alert.alert('Pool settled', `${preTxs.length} debt(s) created.`);
    } catch (err) {
      Alert.alert(
        err instanceof Error && err.message.includes('Pool needs') ? 'Cannot settle' :
        err instanceof Error && err.message.includes('No transactions') ? 'Cannot settle' : 'Error',
        err instanceof Error ? err.message : 'Failed to settle pool',
      );
    }
  }, [commitPoolSettlement, computePoolSettlement, user]);

  /**
   * Confirm a debt from the current user's side.
   * When both from_confirmed and to_confirmed are true, status becomes 'confirmed'.
   */
  const confirmDebt = useCallback(async (debtId: string) => {
    if (!user) return;
    try {
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
    computePoolSettlement,
    commitPoolSettlement,
    settlePoolDebts,
    confirmDebt,
    markPaid,
  };
}
