import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePools } from '../hooks/usePools';
import { usePoolTransactions } from '../hooks/usePoolTransactions';
import { usePool } from '../hooks/usePool';
import { useDebts } from '../hooks/useDebts';
import { useFriends } from '../hooks/useFriends';
import { poolSharedStyles as sh } from '../components/pool/poolStyles';
import { PoolHeader } from '../components/pool/PoolHeader';
import { PoolSummaryCard } from '../components/pool/PoolSummaryCard';
import { PoolMemberChips } from '../components/pool/PoolMemberChips';
import { PoolActions } from '../components/pool/PoolActions';
import { TransactionList } from '../components/pool/TransactionList';
import { TransactionModal } from '../components/pool/TransactionModal';
import { AddMemberModal } from '../components/pool/AddMemberModal';
import { CreatePoolModal } from '../components/pool/CreatePoolModal';
import { PoolListContent } from '../components/pool/PoolListContent';
import type { Pool, PoolTransaction } from '../types/pools';
import type { PoolType } from '../types/pools';
import type { ResolvedFriend } from '../types/friends';

export default function PoolScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  const {
    pools, members, loading,
    getUserPools, createPool, addPoolMember, loadPoolMembers, closePool,
  } = usePools(user);

  const {
    transactions, loading: txLoading,
    getPoolTransactions, addPoolTransaction, updatePoolTransaction, deletePoolTransaction,
  } = usePoolTransactions(user);

  const { settlePoolDebts } = useDebts(user);
  const { friends, loading: friendsLoading, loadFriends } = useFriends(user);

  const pool = usePool({
    members,
    transactions,
    closePool,
    settlePoolDebts,
    getUserPools,
    getPoolTransactions,
    loadPoolMembers,
    loadFriends,
  });

  // Modal visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Which transaction is being edited (null = create mode)
  const [editingTx, setEditingTx] = useState<PoolTransaction | null>(null);

  useEffect(() => {
    void getUserPools();
  }, [getUserPools]);

  // Pre-load friends whenever the member modal opens
  useEffect(() => {
    if (showAddMemberModal && friends.length === 0 && !friendsLoading) {
      void loadFriends();
    }
  }, [friends.length, friendsLoading, loadFriends, showAddMemberModal]);

  const openEditTxModal = useCallback((tx: PoolTransaction) => {
    setEditingTx(tx);
    setShowAddTxModal(true);
  }, []);

  const closeTxModal = useCallback(() => {
    setShowAddTxModal(false);
    setEditingTx(null);
  }, []);

  const handleTxSubmit = useCallback(async (amount: number, description: string, paidBy: string) => {
    if (!pool.selectedPool) return;
    if (editingTx) {
      await updatePoolTransaction(editingTx.id, pool.selectedPool.id, amount, description, paidBy);
    } else {
      await addPoolTransaction(
        pool.selectedPool.id,
        amount,
        description,
        new Date().toISOString().slice(0, 10),
        paidBy,
      );
    }
    closeTxModal();
  }, [addPoolTransaction, closeTxModal, editingTx, pool.selectedPool, updatePoolTransaction]);

  const handleAddFriend = useCallback(async (friend: ResolvedFriend) => {
    if (!pool.selectedPool) return;
    const displayName = friend.profile?.display_name ?? friend.profile?.email ?? friend.userId;
    await addPoolMember(pool.selectedPool.id, friend.userId, displayName);
    setShowAddMemberModal(false);
  }, [addPoolMember, pool.selectedPool]);

  const handleAddExternal = useCallback(async (name: string) => {
    if (!pool.selectedPool) return;
    await addPoolMember(pool.selectedPool.id, null, name);
    setShowAddMemberModal(false);
  }, [addPoolMember, pool.selectedPool]);

  const handleCreatePool = useCallback(async (name: string, type: PoolType) => {
    const created = await createPool(name, type);
    setShowCreateModal(false);
    if (created) pool.openPool(created as Pool);
  }, [createPool, pool]);

  // ─── Pool detail view ───
  if (pool.selectedPool) {
    const isActive = pool.selectedPool.status === 'active';
    return (
      <View style={sh.container}>
        <PoolHeader
          title={pool.selectedPool.name}
          subtitle={`${pool.selectedPool.type === 'event' ? 'Event' : 'Continuous'} · ${pool.selectedPool.status}`}
          onBack={() => pool.setSelectedPool(null)}
          onSettle={isActive ? pool.handleSettlePool : undefined}
          onClose={isActive ? pool.handleClosePool : undefined}
        />

        <PoolSummaryCard
          total={pool.poolTotal}
          memberCount={pool.memberCount}
          perPerson={pool.perPerson}
        />

        <PoolMemberChips members={pool.poolMembers} currentUserId={user?.id ?? ''} />

        {isActive && (
          <PoolActions
            onAddExpense={() => setShowAddTxModal(true)}
            onAddMember={() => setShowAddMemberModal(true)}
          />
        )}

        <TransactionList
          transactions={transactions}
          loading={txLoading}
          members={pool.poolMembers}
          currentUserId={user?.id ?? ''}
          poolCreatedBy={pool.selectedPool.created_by}
          onEdit={openEditTxModal}
          onDelete={deletePoolTransaction}
        />

        <TransactionModal
          visible={showAddTxModal}
          onClose={closeTxModal}
          onSubmit={handleTxSubmit}
          editingTx={editingTx}
          members={pool.poolMembers}
          currentUserId={user?.id ?? ''}
        />

        <AddMemberModal
          visible={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          onAddFriend={handleAddFriend}
          onAddExternal={handleAddExternal}
          poolMembers={pool.poolMembers}
          friends={friends}
          friendsLoading={friendsLoading}
        />
      </View>
    );
  }

  // ─── Pool list view ───
  return (
    <View style={sh.container}>
      <PoolHeader
        title="Pools"
        onBack={() => navigation.goBack()}
        onAdd={() => setShowCreateModal(true)}
      />

      <PoolListContent pools={pools} loading={loading} onOpenPool={pool.openPool} />

      <CreatePoolModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePool}
      />
    </View>
  );
}
