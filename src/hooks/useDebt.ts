/**
 * Hook for standalone debt management (person-to-person lending).
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Debt, ResolvedDebt, CreateDebtData } from '../types/debt';
import type { UserProfile } from '../types/friends';

export function useDebt(user: User | null) {
  const [debts, setDebts] = useState<ResolvedDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── helper: resolve user profiles ─────────────────────────────────────
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

  // ── load debts ────────────────────────────────────────────────────────
  /**
   * Load all debts where current user is a party (from or to).
   */
  const loadDebts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: debtRows, error } = await supabase
        .from('debts')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!debtRows || debtRows.length === 0) {
        setDebts([]);
        return;
      }

      // Resolve other user profiles
      const otherIds = [
        ...new Set(
          debtRows.map((d: Debt) =>
            d.from_user_id === user.id ? d.to_user_id : d.from_user_id
          )
        ),
      ];
      const profileMap = await resolveProfiles(otherIds);

      const resolved: ResolvedDebt[] = debtRows.map((d: Debt) => {
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
        };
      });

      setDebts(resolved);
    } catch (err) {
      Alert.alert('Load debts error', err instanceof Error ? err.message : 'Failed to load debts.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── create debt ───────────────────────────────────────────────────────
  /**
   * Create a new debt record.
   * Direction: 'owe' means current user owes other user, 'owed' means other user owes current user.
   */
  const createDebt = useCallback(
    async (data: CreateDebtData): Promise<string | null> => {
      if (!user) return null;
      setSaving(true);
      try {
        const from_user_id = data.direction === 'owe' ? user.id : data.other_user_id;
        const to_user_id = data.direction === 'owe' ? data.other_user_id : user.id;

        const { data: row, error } = await supabase
          .from('debts')
          .insert({
            from_user_id,
            to_user_id,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            status: 'pending',
            created_by: user.id,
            due_date: data.due_date ?? null,
          })
          .select('id')
          .single();

        if (error) throw error;

        await loadDebts();
        return row.id;
      } catch (err) {
        Alert.alert('Create debt failed', err instanceof Error ? err.message : 'Failed to create debt.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [loadDebts, user]
  );

  // ── confirm debt ──────────────────────────────────────────────────────
  /**
   * Confirm a debt. Each party must confirm.
   * Once both confirm, status changes to 'confirmed'.
   */
  const confirmDebt = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      try {
        const debt = debts.find((d) => d.id === debtId);
        if (!debt) throw new Error('Debt not found');

        const isFrom = debt.from_user_id === user.id;
        const isTo = debt.to_user_id === user.id;
        if (!isFrom && !isTo) throw new Error('Not a party to this debt');

        const update: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (isFrom) update.confirmed_by_from = true;
        if (isTo) update.confirmed_by_to = true;

        // Check if both will be confirmed after this update
        const bothConfirmed =
          (isFrom || debt.confirmed_by_from) && (isTo || debt.confirmed_by_to);
        if (bothConfirmed) {
          update.status = 'confirmed';
        }

        const { error } = await supabase
          .from('debts')
          .update(update)
          .eq('id', debtId);

        if (error) throw error;

        await loadDebts();
        return true;
      } catch (err) {
        Alert.alert('Confirm failed', err instanceof Error ? err.message : 'Failed to confirm debt.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [debts, loadDebts, user]
  );

  // ── mark debt as paid ─────────────────────────────────────────────────
  /**
   * Mark a debt as paid (typically called by the person who owed).
   */
  const markDebtPaid = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      try {
        const { error } = await supabase
          .from('debts')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', debtId);

        if (error) throw error;

        await loadDebts();
        return true;
      } catch (err) {
        Alert.alert('Mark paid failed', err instanceof Error ? err.message : 'Failed to mark debt as paid.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadDebts, user]
  );

  // ── dispute debt ──────────────────────────────────────────────────────
  /**
   * Mark a debt as disputed (either party can dispute).
   */
  const disputeDebt = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      try {
        const { error } = await supabase
          .from('debts')
          .update({
            status: 'disputed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', debtId);

        if (error) throw error;

        await loadDebts();
        return true;
      } catch (err) {
        Alert.alert('Dispute failed', err instanceof Error ? err.message : 'Failed to dispute debt.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadDebts, user]
  );

  // ── cancel debt ───────────────────────────────────────────────────────
  /**
   * Cancel a debt (only creator can delete).
   */
  const cancelDebt = useCallback(
    async (debtId: string): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      try {
        const { error } = await supabase
          .from('debts')
          .delete()
          .eq('id', debtId)
          .eq('created_by', user.id);

        if (error) throw error;

        await loadDebts();
        return true;
      } catch (err) {
        Alert.alert('Cancel failed', err instanceof Error ? err.message : 'Failed to cancel debt.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadDebts, user]
  );

  return {
    debts,
    loading,
    saving,
    loadDebts,
    createDebt,
    confirmDebt,
    markDebtPaid,
    disputeDebt,
    cancelDebt,
  };
}
