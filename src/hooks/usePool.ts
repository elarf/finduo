import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type {
  Pool,
  PoolExpense,
  PoolSettlement,
  PoolDebt,
  ResolvedPool,
  ResolvedPoolMember,
  ResolvedDebt,
  SettlementPreview,
  SettlementTransfer,
  CreatePoolData,
  CreateExpenseData,
} from '../types/pool';
import type { UserProfile } from '../types/friends';

export function usePool(user: User | null) {
  const [pools, setPools] = useState<ResolvedPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<ResolvedPool | null>(null);
  const [poolExpenses, setPoolExpenses] = useState<PoolExpense[]>([]);
  const [poolSettlements, setPoolSettlements] = useState<PoolSettlement[]>([]);
  const [poolDebts, setPoolDebts] = useState<ResolvedDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── helpers ───────────────────────────────────────────────────────────

  const resolveProfiles = async (userIds: string[]): Promise<Record<string, UserProfile>> => {
    const map: Record<string, UserProfile> = {};
    if (userIds.length === 0) return map;
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, email, avatar_url')
      .in('user_id', userIds);
    for (const p of data ?? []) map[p.user_id] = p;
    return map;
  };

  // ── load pools ────────────────────────────────────────────────────────

  const loadPools = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: poolRows, error: poolErr } = await supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });
      if (poolErr) throw poolErr;

      const poolIds = (poolRows ?? []).map((p: Pool) => p.id);
      if (poolIds.length === 0) {
        setPools([]);
        setLoading(false);
        return;
      }

      const { data: memberRows, error: memErr } = await supabase
        .from('pool_members')
        .select('*')
        .in('pool_id', poolIds);
      if (memErr) throw memErr;

      const { data: expenseRows } = await supabase
        .from('pool_expenses')
        .select('id, pool_id, amount')
        .in('pool_id', poolIds);

      const { data: settlementRows } = await supabase
        .from('pool_settlements')
        .select('expense_ids, pool_id')
        .in('pool_id', poolIds);

      // Resolve profiles for all members
      const allUserIds = [...new Set((memberRows ?? []).map((m: any) => m.user_id))];
      const profileMap = await resolveProfiles(allUserIds);

      // Build settled expense ID sets per pool
      const settledExpenseIds: Record<string, Set<string>> = {};
      for (const s of settlementRows ?? []) {
        if (!settledExpenseIds[s.pool_id]) settledExpenseIds[s.pool_id] = new Set();
        for (const eid of s.expense_ids ?? []) settledExpenseIds[s.pool_id].add(eid);
      }

      const resolved: ResolvedPool[] = (poolRows ?? []).map((p: Pool) => {
        const members: ResolvedPoolMember[] = (memberRows ?? [])
          .filter((m: any) => m.pool_id === p.id)
          .map((m: any) => ({
            ...m,
            display_name: profileMap[m.user_id]?.display_name ?? null,
            email: profileMap[m.user_id]?.email ?? null,
            avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
          }));

        const poolExpenses = (expenseRows ?? []).filter((e: any) => e.pool_id === p.id);
        const settledSet = settledExpenseIds[p.id] ?? new Set();
        const unsettled = poolExpenses.filter((e: any) => !settledSet.has(e.id));

        const myMember = members.find((m) => m.user_id === user.id);

        return {
          ...p,
          members,
          myRole: (myMember?.role ?? 'member') as 'owner' | 'member',
          expenseCount: poolExpenses.length,
          totalSpent: poolExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0),
          unsettledExpenseCount: unsettled.length,
        };
      });

      setPools(resolved);
    } catch (err) {
      Alert.alert('Pools error', err instanceof Error ? err.message : 'Failed to load pools.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── select pool (load detail) ─────────────────────────────────────────

  const selectPool = useCallback(
    async (poolId: string) => {
      if (!user) return;
      const pool = pools.find((p) => p.id === poolId) ?? null;
      setSelectedPool(pool);

      if (!pool) return;

      try {
        const [expRes, settRes] = await Promise.all([
          supabase
            .from('pool_expenses')
            .select('*')
            .eq('pool_id', poolId)
            .order('date', { ascending: false }),
          supabase
            .from('pool_settlements')
            .select('*')
            .eq('pool_id', poolId)
            .order('settled_at', { ascending: false }),
        ]);

        if (expRes.error) throw expRes.error;
        if (settRes.error) throw settRes.error;

        setPoolExpenses(expRes.data ?? []);
        setPoolSettlements(settRes.data ?? []);
      } catch (err) {
        Alert.alert('Load error', err instanceof Error ? err.message : 'Failed to load pool details.');
      }
    },
    [pools, user],
  );

  // ── create pool ───────────────────────────────────────────────────────

  const createPool = useCallback(
    async (data: CreatePoolData): Promise<string | null> => {
      if (!user) return null;
      setSaving(true);
      try {
        const { data: row, error } = await supabase
          .from('pools')
          .insert({
            name: data.name,
            description: data.description ?? null,
            type: data.type,
            currency: data.currency,
            icon: data.icon ?? null,
            status: 'active',
            created_by: user.id,
            start_date: data.start_date ?? null,
            end_date: data.end_date ?? null,
          })
          .select('id')
          .single();
        if (error) throw error;

        // Add self as owner
        const { error: memErr } = await supabase.from('pool_members').insert({
          pool_id: row.id,
          user_id: user.id,
          role: 'owner',
        });
        if (memErr) throw memErr;

        await loadPools();
        return row.id;
      } catch (err) {
        Alert.alert('Create failed', err instanceof Error ? err.message : 'Failed to create pool.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadPools, user],
  );

  // ── update pool ───────────────────────────────────────────────────────

  const updatePool = useCallback(
    async (poolId: string, data: Partial<Pool>): Promise<boolean> => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('pools')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', poolId);
        if (error) throw error;
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Update failed', err instanceof Error ? err.message : 'Failed to update pool.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadPools],
  );

  // ── delete pool ───────────────────────────────────────────────────────

  const deletePool = useCallback(
    async (poolId: string): Promise<boolean> => {
      setSaving(true);
      try {
        const { error } = await supabase.from('pools').delete().eq('id', poolId);
        if (error) throw error;
        setSelectedPool(null);
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete pool.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadPools],
  );

  // ── add/remove pool members ───────────────────────────────────────────

  const addPoolMember = useCallback(
    async (poolId: string, userId: string): Promise<boolean> => {
      try {
        const { error } = await supabase.from('pool_members').insert({
          pool_id: poolId,
          user_id: userId,
          role: 'member',
        });
        if (error) throw error;
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Add member failed', err instanceof Error ? err.message : 'Failed to add member.');
        return false;
      }
    },
    [loadPools],
  );

  const removePoolMember = useCallback(
    async (poolId: string, userId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('pool_members')
          .delete()
          .eq('pool_id', poolId)
          .eq('user_id', userId);
        if (error) throw error;
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Remove member failed', err instanceof Error ? err.message : 'Failed to remove member.');
        return false;
      }
    },
    [loadPools],
  );

  // ── expense CRUD ──────────────────────────────────────────────────────

  const addExpense = useCallback(
    async (poolId: string, data: CreateExpenseData): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      try {
        const { error } = await supabase.from('pool_expenses').insert({
          pool_id: poolId,
          paid_by: data.paid_by,
          amount: data.amount,
          description: data.description,
          date: data.date,
          split_among: data.split_among ?? null,
          created_by: user.id,
        });
        if (error) throw error;
        // Reload detail
        await selectPool(poolId);
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Add expense failed', err instanceof Error ? err.message : 'Failed to add expense.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadPools, selectPool, user],
  );

  const updateExpense = useCallback(
    async (expenseId: string, data: Partial<PoolExpense>): Promise<boolean> => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('pool_expenses')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', expenseId);
        if (error) throw error;
        if (selectedPool) await selectPool(selectedPool.id);
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Update expense failed', err instanceof Error ? err.message : 'Failed to update expense.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadPools, selectPool, selectedPool],
  );

  const deleteExpense = useCallback(
    async (expenseId: string): Promise<boolean> => {
      setSaving(true);
      try {
        const { error } = await supabase.from('pool_expenses').delete().eq('id', expenseId);
        if (error) throw error;
        if (selectedPool) await selectPool(selectedPool.id);
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Delete expense failed', err instanceof Error ? err.message : 'Failed to delete expense.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadPools, selectPool, selectedPool],
  );

  // ── settlement algorithm ──────────────────────────────────────────────

  const calculateSettlement = useCallback(
    (poolId: string): SettlementPreview | null => {
      const pool = pools.find((p) => p.id === poolId);
      if (!pool) return null;

      const memberIds = pool.members.map((m) => m.user_id);

      // Determine which expenses are already settled (for continuous pools)
      const settledIds = new Set<string>();
      for (const s of poolSettlements) {
        for (const eid of s.expense_ids ?? []) settledIds.add(eid);
      }

      const unsettled =
        pool.type === 'event'
          ? poolExpenses
          : poolExpenses.filter((e) => !settledIds.has(e.id));

      if (unsettled.length === 0) return null;

      // Step 1: Compute per-user net balance
      const balance: Record<string, number> = {};
      for (const uid of memberIds) balance[uid] = 0;

      for (const exp of unsettled) {
        const splitMembers = exp.split_among ?? memberIds;
        const share = Number(exp.amount) / splitMembers.length;
        balance[exp.paid_by] = (balance[exp.paid_by] ?? 0) + Number(exp.amount);
        for (const uid of splitMembers) {
          balance[uid] = (balance[uid] ?? 0) - share;
        }
      }

      // Round balances to 2 decimal places
      for (const uid of Object.keys(balance)) {
        balance[uid] = Math.round(balance[uid] * 100) / 100;
      }

      // Step 2: Debt simplification (greedy)
      const creditors: { userId: string; amount: number }[] = [];
      const debtors: { userId: string; amount: number }[] = [];

      for (const [uid, bal] of Object.entries(balance)) {
        if (bal > 0.005) creditors.push({ userId: uid, amount: bal });
        else if (bal < -0.005) debtors.push({ userId: uid, amount: Math.abs(bal) });
      }

      creditors.sort((a, b) => b.amount - a.amount);
      debtors.sort((a, b) => b.amount - a.amount);

      const transfers: SettlementTransfer[] = [];
      let ci = 0;
      let di = 0;

      while (ci < creditors.length && di < debtors.length) {
        const c = creditors[ci];
        const d = debtors[di];
        const amount = Math.round(Math.min(c.amount, d.amount) * 100) / 100;

        if (amount > 0) {
          transfers.push({ from: d.userId, to: c.userId, amount });
        }

        c.amount = Math.round((c.amount - amount) * 100) / 100;
        d.amount = Math.round((d.amount - amount) * 100) / 100;

        if (c.amount < 0.005) ci++;
        if (d.amount < 0.005) di++;
      }

      return {
        balances: balance,
        transfers,
        expenseIds: unsettled.map((e) => e.id),
      };
    },
    [pools, poolExpenses, poolSettlements],
  );

  // ── commit settlement ─────────────────────────────────────────────────

  const commitSettlement = useCallback(
    async (poolId: string, preview: SettlementPreview, note?: string): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      try {
        const pool = pools.find((p) => p.id === poolId);
        if (!pool) throw new Error('Pool not found');

        // Insert settlement record
        const { data: settlement, error: settErr } = await supabase
          .from('pool_settlements')
          .insert({
            pool_id: poolId,
            settled_by: user.id,
            balances: preview.balances,
            transfers: preview.transfers,
            expense_ids: preview.expenseIds,
            note: note ?? null,
          })
          .select('id')
          .single();
        if (settErr) throw settErr;

        // Insert debt records for each transfer
        if (preview.transfers.length > 0) {
          const poolDebts = preview.transfers.map((t) => ({
            pool_id: poolId,
            settlement_id: settlement.id,
            from_user_id: t.from,
            to_user_id: t.to,
            amount: t.amount,
            currency: pool.currency,
            status: 'pending' as const,
          }));

          const { error: poolDebtErr } = await supabase.from('pool_debts').insert(poolDebts);
          if (poolDebtErr) throw poolDebtErr;

          // Also create standalone debts (not auto-confirmed)
          const standaloneDebts = preview.transfers.map((t) => ({
            from_user_id: t.from,
            to_user_id: t.to,
            amount: t.amount,
            currency: pool.currency,
            description: `Settlement: ${pool.name}`,
            status: 'pending' as const,
            created_by: user.id,
          }));

          const { error: debtErr } = await supabase.from('debts').insert(standaloneDebts);
          if (debtErr) throw debtErr;
        }

        // For event pools, close the pool
        if (pool.type === 'event') {
          const { error: updateErr } = await supabase
            .from('pools')
            .update({
              status: 'settled',
              settled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', poolId);
          if (updateErr) throw updateErr;
        }

        await selectPool(poolId);
        await loadPools();
        return true;
      } catch (err) {
        Alert.alert('Settlement failed', err instanceof Error ? err.message : 'Failed to settle pool.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadPools, pools, selectPool, user],
  );

  // ── debt confirmation / payment ───────────────────────────────────────

  const confirmDebt = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const debt = poolDebts.find((d) => d.id === debtId);
        if (!debt) throw new Error('Debt not found');

        const isFrom = debt.from_user_id === user.id;
        const isTo = debt.to_user_id === user.id;
        if (!isFrom && !isTo) throw new Error('Not a party to this debt');

        const update: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (isFrom) update.confirmed_by_from = true;
        if (isTo) update.confirmed_by_to = true;

        // Check if both will be confirmed
        const bothConfirmed =
          (isFrom || debt.confirmed_by_from) && (isTo || debt.confirmed_by_to);
        if (bothConfirmed) update.status = 'confirmed';

        const { error } = await supabase.from('pool_debts').update(update).eq('id', debtId);
        if (error) throw error;

        await loadAllDebts();
        return true;
      } catch (err) {
        Alert.alert('Confirm failed', err instanceof Error ? err.message : 'Failed to confirm debt.');
        return false;
      }
    },
    [poolDebts, user],
  );

  const markDebtPaid = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const { error } = await supabase
          .from('pool_debts')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', debtId);
        if (error) throw error;

        await loadAllDebts();
        return true;
      } catch (err) {
        Alert.alert('Mark paid failed', err instanceof Error ? err.message : 'Failed to mark debt as paid.');
        return false;
      }
    },
    [user],
  );

  const disputeDebt = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const { error } = await supabase
          .from('pool_debts')
          .update({
            status: 'disputed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', debtId);
        if (error) throw error;

        await loadAllDebts();
        return true;
      } catch (err) {
        Alert.alert('Dispute failed', err instanceof Error ? err.message : 'Failed to dispute debt.');
        return false;
      }
    },
    [user],
  );

  // ── load all debts ────────────────────────────────────────────────────

  const loadAllDebts = useCallback(async () => {
    if (!user) return;
    try {
      const { data: debtRows, error } = await supabase
        .from('pool_debts')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (!debtRows || debtRows.length === 0) {
        setPoolDebts([]);
        return;
      }

      // Resolve other user profiles and pool names
      const otherIds = [
        ...new Set(
          debtRows.map((d: PoolDebt) =>
            d.from_user_id === user.id ? d.to_user_id : d.from_user_id,
          ),
        ),
      ];
      const profileMap = await resolveProfiles(otherIds);

      const poolIds = [...new Set(debtRows.map((d: PoolDebt) => d.pool_id))];
      const { data: poolNameRows } = await supabase
        .from('pools')
        .select('id, name')
        .in('id', poolIds);
      const poolNameMap: Record<string, string> = {};
      for (const p of poolNameRows ?? []) poolNameMap[p.id] = p.name;

      const resolved: ResolvedDebt[] = debtRows.map((d: PoolDebt) => {
        const isFrom = d.from_user_id === user.id;
        const otherId = isFrom ? d.to_user_id : d.from_user_id;
        const profile = profileMap[otherId];
        return {
          ...d,
          otherUser: {
            user_id: otherId,
            display_name: profile?.display_name ?? null,
            email: profile?.email ?? null,
            avatar_url: profile?.avatar_url ?? null,
          },
          direction: isFrom ? ('owe' as const) : ('owed' as const),
          poolName: poolNameMap[d.pool_id] ?? 'Unknown pool',
        };
      });

      setPoolDebts(resolved);
    } catch (err) {
      Alert.alert('Debts error', err instanceof Error ? err.message : 'Failed to load debts.');
    }
  }, [user]);

  return {
    pools,
    selectedPool,
    poolExpenses,
    poolSettlements,
    poolDebts,
    loading,
    saving,
    loadPools,
    selectPool,
    createPool,
    updatePool,
    deletePool,
    addPoolMember,
    removePoolMember,
    addExpense,
    updateExpense,
    deleteExpense,
    calculateSettlement,
    commitSettlement,
    confirmDebt,
    markDebtPaid,
    disputeDebt,
    loadAllDebts,
  };
}
