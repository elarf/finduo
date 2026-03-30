import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Pool, PoolMember, PoolTransaction } from '../types/pools';

interface UsePoolOptions {
  members: Record<string, PoolMember[]>;
  transactions: PoolTransaction[];
  closePool: (id: string) => Promise<void>;
  settlePoolDebts: (id: string) => Promise<void>;
  getUserPools: () => Promise<void>;
  getPoolTransactions: (id: string) => Promise<void>;
  loadPoolMembers: (id: string) => Promise<void>;
  loadFriends: () => Promise<void>;
}

export function usePool({
  members,
  transactions,
  closePool,
  settlePoolDebts,
  getUserPools,
  getPoolTransactions,
  loadPoolMembers,
  loadFriends,
}: UsePoolOptions) {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  const openPool = useCallback((pool: Pool) => {
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
    Alert.alert(
      'Close pool',
      `Close "${selectedPool.name}"? No more transactions can be added.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            await closePool(selectedPool.id);
            setSelectedPool(null);
          },
        },
      ],
    );
  }, [closePool, selectedPool]);

  const handleSettlePool = useCallback(async () => {
    if (!selectedPool) return;
    Alert.alert(
      'Settle pool',
      `Settle "${selectedPool.name}"? This will calculate debts and close the pool.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: async () => {
            await settlePoolDebts(selectedPool.id);
            await getUserPools();
            setSelectedPool(null);
          },
        },
      ],
    );
  }, [getUserPools, selectedPool, settlePoolDebts]);

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
  };
}
