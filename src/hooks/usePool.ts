import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { logUI, webAlert } from '../lib/devtools';
import type { Pool, PoolMember, PoolTransaction, SettleResult } from '../types/pools';

/** Alert.alert multi-button dialogs are silent no-ops on RN Web. Use window.confirm there. */
function confirmDialog(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void | Promise<void>,
) {
  const run = async () => {
    try {
      await onConfirm();
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : String(err));
    }
  };
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) void run();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: () => void run() },
    ]);
  }
}

interface UsePoolOptions {
  members: Record<string, PoolMember[]>;
  transactions: PoolTransaction[];
  closePool: (id: string) => Promise<boolean>;
  deletePool: (id: string) => Promise<void>;
  settlePoolDebts: (id: string) => Promise<SettleResult>;
  getUserPools: () => Promise<void>;
  getPoolTransactions: (id: string) => Promise<void>;
  loadPoolMembers: (id: string) => Promise<void>;
  loadFriends: () => Promise<void>;
  /** Called when settle produces an entry-type result that should open the EntryModal */
  onSettleEntry: (amount: number, entryType: 'income' | 'expense', poolName: string) => void;
}

export function usePool({
  members,
  transactions,
  closePool,
  deletePool,
  settlePoolDebts,
  getUserPools,
  getPoolTransactions,
  loadPoolMembers,
  loadFriends,
  onSettleEntry,
}: UsePoolOptions) {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  const openPool = useCallback((pool: Pool) => {
    logUI('pool.summary_card.card', 'selected');
    setSelectedPool(pool);
    void getPoolTransactions(pool.id);
    void loadPoolMembers(pool.id);
    void loadFriends();
  }, [getPoolTransactions, loadFriends, loadPoolMembers]);

  const poolMembers = useMemo(
    () => (selectedPool ? (members[selectedPool.id] ?? []) : []),
    [members, selectedPool],
  );

  const poolTotal = useMemo(
    () => transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions],
  );

  const memberCount = poolMembers.length || 1;
  const perPerson = poolTotal / memberCount;

  const handleClosePool = useCallback(async () => {
    if (!selectedPool) return;
    confirmDialog(
      'Close pool',
      `Close "${selectedPool.name}"? No more transactions can be added.`,
      'Close',
      async () => {
        const ok = await closePool(selectedPool.id);
        if (ok) setSelectedPool(null);
      },
    );
  }, [closePool, selectedPool]);

  const handleSettlePool = useCallback(async () => {
    if (!selectedPool) return;
    confirmDialog(
      'Settle pool',
      `Settle "${selectedPool.name}"? This will calculate debts and close the pool.`,
      'Settle',
      async () => {
        const result = await settlePoolDebts(selectedPool.id);
        if (result.kind === 'settled') {
          await getUserPools();
          setSelectedPool(null);
        } else if (result.kind === 'entry') {
          // Pool is now closed in DB; update local state + surface the entry prompt
          setSelectedPool((prev) => prev ? { ...prev, status: 'closed' as const } : null);
          await getUserPools();
          onSettleEntry(result.amount, result.entryType, selectedPool.name);
        }
        // 'balanced' and 'error': stay on screen, feedback already shown
      },
    );
  }, [getUserPools, onSettleEntry, selectedPool, settlePoolDebts]);

  const handleDeletePool = useCallback(async () => {
    if (!selectedPool) return;
    confirmDialog(
      'Delete pool',
      `Permanently delete "${selectedPool.name}"? All transactions will be lost and this cannot be undone.`,
      'Delete',
      async () => {
        await deletePool(selectedPool.id);
        setSelectedPool(null);
      },
    );
  }, [deletePool, selectedPool]);

  return {
    selectedPool,
    setSelectedPool,
    openPool,
    poolMembers,
    poolTotal,
    memberCount,
    perPerson,
    handleClosePool,
    handleSettlePool,
    handleDeletePool,
  };
}
