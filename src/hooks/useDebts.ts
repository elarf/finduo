import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { settlePool as calcSettlement } from '../utils/settlePool';
import type { User } from '@supabase/supabase-js';
import type { AppDebt, PreTransaction, SettleResult } from '../types/pools';

export function useDebts(user: User | null) {
  const [debts, setDebts] = useState<AppDebt[]>([]);
  const [loading, setLoading] = useState(false);

  /** Fetch all debts where the current user is either party. */
  const getUserDebts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      logAPI('supabase://debts', { source: 'lending.scroll_view.root', action: 'getUserDebts' });
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
   * Fetches pool members and transactions, runs the settlement algorithm across
   * ALL participants (auth + external), and returns tagged PreTransaction[]:
   *   kind='debt'  → both parties are auth users  → write to debts table
   *   kind='entry' → one party is external        → auth user records as a personal entry
   * Throws on validation failures so the caller can surface appropriate feedback.
   */
  const computePoolSettlement = useCallback(async (poolId: string): Promise<PreTransaction[]> => {
    if (!user) return [];

    // Fetch ALL participants (auth + external) via RPC
    logAPI('supabase://rpc/get_pool_members', { source: 'settlements.pool_card.settle_button', action: 'computePoolSettlement' });
    const { data: memberData, error: memberError } = await supabase
      .rpc('get_pool_members', { p_pool_id: poolId });
    if (memberError) throw memberError;

    const allMembers: any[] = memberData ?? [];
    const allParticipantIds = allMembers.map((m) => m.id as string);

    if (allParticipantIds.length === 0) throw new Error('Pool has no members.');

    // Map pool_participant.id → auth user_id (only for auth members)
    const participantToUserId = new Map<string, string>(
      allMembers
        .filter((m) => m.user_id != null)
        .map((m) => [m.id as string, m.user_id as string]),
    );

    // Reverse map: auth user_id → pool_participant.id
    // Backward-compat: existing rows may store user_id in paid_by (pre-migration)
    const userIdToParticipantId = new Map<string, string>(
      allMembers
        .filter((m) => m.user_id != null)
        .map((m) => [m.user_id as string, m.id as string]),
    );

    logAPI('supabase://pool_transactions', { source: 'settlements.pool_card.settle_button', action: 'computePoolSettlement' });
    const { data: txData, error: txError } = await supabase
      .from('pool_transactions')
      .select('pool_id,paid_by,amount')
      .eq('pool_id', poolId);
    if (txError) throw txError;

    if (!txData || txData.length === 0) throw new Error('No transactions in this pool.');

    // Run the algorithm with participant IDs (works for both auth and external members).
    // Guard against pre-migration rows that stored user_id in paid_by by converting
    // back to pool_participant.id via the reverse map.
    const transactions = (txData ?? []).map((tx: any) => ({
      pool_id: tx.pool_id as string,
      paid_by: userIdToParticipantId.get(tx.paid_by as string) ?? tx.paid_by as string,
      amount: Number(tx.amount),
    }));

    const debts = calcSettlement(allParticipantIds, transactions);

    const preTxs: PreTransaction[] = [];
    for (const debt of debts) {
      const fromUserId = participantToUserId.get(debt.from);
      const toUserId = participantToUserId.get(debt.to);

      if (fromUserId && toUserId) {
        // Auth ↔ Auth: create a proper debt record
        preTxs.push({
          fromParticipantId: fromUserId,
          toParticipantId: toUserId,
          amount: debt.amount,
          metadata: { reason: 'settlement', sourcePoolId: poolId, kind: 'debt' },
        });
      } else if (toUserId) {
        // External → Auth: auth user is owed → record as income
        preTxs.push({
          fromParticipantId: debt.from,
          toParticipantId: toUserId,
          amount: debt.amount,
          metadata: { reason: 'settlement', sourcePoolId: poolId, kind: 'entry', entryType: 'income' },
        });
      } else if (fromUserId) {
        // Auth → External: auth user owes → record as expense
        preTxs.push({
          fromParticipantId: fromUserId,
          toParticipantId: debt.to,
          amount: debt.amount,
          metadata: { reason: 'settlement', sourcePoolId: poolId, kind: 'entry', entryType: 'expense' },
        });
      }
      // External → External: no auth user involved, skip
    }

    return preTxs;
  }, [user]);

  /**
   * WRITE — commits debt-type pre-transactions to the debts table and closes the pool.
   * Only called after the user explicitly confirms the settlement preview.
   */
  const commitPoolSettlement = useCallback(async (
    poolId: string,
    preTxs: PreTransaction[],
  ): Promise<void> => {
    if (!user || preTxs.length === 0) return;

    // Only write debt-type entries to the debts table
    const debtRows = preTxs
      .filter((p) => p.metadata.kind === 'debt')
      .map((p) => ({
        from_user: p.fromParticipantId,
        to_user: p.toParticipantId,
        amount: p.amount,
        pool_id: p.metadata.sourcePoolId,
        status: 'pending' as const,
        from_confirmed: false,
        to_confirmed: false,
      }));

    if (debtRows.length > 0) {
      logAPI('supabase://debts', { source: 'settlements.pool_card.settle_button', action: 'commitPoolSettlement' });
      const { error: insertError } = await supabase.from('debts').insert(debtRows);
      if (insertError) throw insertError;
    }

    logAPI('supabase://pools', { source: 'settlements.pool_card.settle_button', action: 'commitPoolSettlement' });
    await supabase.from('pools').update({ status: 'closed' }).eq('id', poolId);

    await getUserDebts();
  }, [getUserDebts, user]);

  /**
   * One-step settle used by PoolScreen's Settle button.
   * Returns a SettleResult that drives what the UI does next:
   *   'settled' → debt records created, pool closed → navigate away
   *   'balanced' → no debts, pool left open
   *   'entry'   → at least one external member; pool closed; auth user should
   *               record a personal ledger entry for the net amount
   *   'error'   → something went wrong; error already surfaced via webAlert
   */
  const settlePoolDebts = useCallback(async (poolId: string): Promise<SettleResult> => {
    if (!user) return { kind: 'error' };
    try {
      const preTxs = await computePoolSettlement(poolId);

      if (preTxs.length === 0) {
        webAlert('All settled', 'Everyone paid their fair share.');
        return { kind: 'balanced' };
      }

      const debtPrTxs = preTxs.filter((p) => p.metadata.kind === 'debt');
      const entryPrTxs = preTxs.filter((p) => p.metadata.kind === 'entry');

      if (debtPrTxs.length > 0) {
        // commitPoolSettlement closes the pool and inserts debt rows
        await commitPoolSettlement(poolId, debtPrTxs);
      }

      if (entryPrTxs.length > 0) {
        if (debtPrTxs.length === 0) {
          // No debt-type settlements → pool not yet closed by commitPoolSettlement
          logAPI('supabase://pools', { source: 'pool.header.settle_button', action: 'closePoolForEntrySettle' });
          await supabase.from('pools').update({ status: 'closed' }).eq('id', poolId);
        }

        // Aggregate net amount for the auth user across all entry-type items
        let net = 0;
        for (const pt of entryPrTxs) {
          if (pt.metadata.entryType === 'income') net += pt.amount;
          else if (pt.metadata.entryType === 'expense') net -= pt.amount;
        }

        if (debtPrTxs.length > 0) {
          webAlert('Pool settled', `${debtPrTxs.length} debt(s) created. Record your share as a transaction.`);
        }
        return { kind: 'entry', amount: Math.round(Math.abs(net) * 100) / 100, entryType: net >= 0 ? 'income' : 'expense' };
      }

      webAlert('Pool settled', `${debtPrTxs.length} debt(s) created.`);
      return { kind: 'settled', debtCount: debtPrTxs.length };
    } catch (err) {
      webAlert(
        err instanceof Error && (err.message.includes('Pool needs') || err.message.includes('No transactions'))
          ? 'Cannot settle'
          : 'Error',
        err instanceof Error ? err.message : 'Failed to settle pool',
      );
      return { kind: 'error' };
    }
  }, [commitPoolSettlement, computePoolSettlement, user]);

  /**
   * Confirm a debt from the current user's side.
   * When both from_confirmed and to_confirmed are true, status becomes 'confirmed'.
   */
  const confirmDebt = useCallback(async (debtId: string) => {
    if (!user) return;
    try {
      logAPI('supabase://debts', { source: 'lending.debt_row.confirm_button', action: 'confirmDebt' });
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

      logAPI('supabase://debts', { source: 'lending.debt_row.confirm_button', action: 'confirmDebt' });
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
      logAPI('supabase://debts', { source: 'lending.debt_row.paid_button', action: 'markPaid' });
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
