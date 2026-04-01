import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { uiPath, uiProps } from '../lib/devtools';
import type { Pool, PoolTransaction } from '../types/pools';
import type { PoolType } from '../types/pools';
import type { ResolvedFriend } from '../types/friends';

export default function PoolScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  const {
    pools, members, creatorProfiles, loading,
    getUserPools, createPool, addPoolMember, loadPoolMembers, closePool, deletePool,
  } = usePools(user);

  const {
    transactions, loading: txLoading,
    getPoolTransactions, addPoolTransaction, updatePoolTransaction, deletePoolTransaction,
  } = usePoolTransactions(user);

  const { settlePoolDebts } = useDebts(user);
  const { friends, loading: friendsLoading, loadFriends } = useFriends(user);

  // Pending settlement entry — shown as a banner when settle produces an entry-type result
  const [settlementEntry, setSettlementEntry] = useState<{
    amount: number;
    entryType: 'income' | 'expense';
    poolName: string;
  } | null>(null);

  const handleSettleEntry = useCallback((
    amount: number,
    entryType: 'income' | 'expense',
    poolName: string,
  ) => {
    setSettlementEntry({ amount, entryType, poolName });
  }, []);

  const pool = usePool({
    members,
    transactions,
    closePool,
    deletePool,
    settlePoolDebts,
    getUserPools,
    getPoolTransactions,
    loadPoolMembers,
    loadFriends,
    onSettleEntry: handleSettleEntry,
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
    const isCreator = user?.id === pool.selectedPool.created_by;
    const creatorMember = !isCreator
      ? pool.poolMembers.find((m) => m.user_id === pool.selectedPool!.created_by)
      : null;
    const creatorName = creatorMember?.display_name ?? null;
    const creatorAvatar = creatorMember?.avatar_url ?? null;
    return (
      <View style={sh.container} {...uiProps(uiPath('pool_detail', 'screen', 'container'))}>
        <PoolHeader
          title={pool.selectedPool.name}
          subtitle={`${pool.selectedPool.type === 'event' ? 'Event' : 'Continuous'} · ${pool.selectedPool.status}`}
          onBack={() => pool.setSelectedPool(null)}
          onSettle={isActive ? pool.handleSettlePool : undefined}
          onClose={isActive ? pool.handleClosePool : undefined}
          onDelete={isCreator ? pool.handleDeletePool : undefined}
        />

        <PoolSummaryCard
          total={pool.poolTotal}
          memberCount={pool.memberCount}
          perPerson={pool.perPerson}
          creatorName={creatorName}
          creatorAvatar={creatorAvatar}
        />

        <PoolMemberChips members={pool.poolMembers} currentUserId={user?.id ?? ''} />

        {isActive && (
          <PoolActions
            onAddExpense={() => setShowAddTxModal(true)}
            onAddMember={() => setShowAddMemberModal(true)}
          />
        )}

        {settlementEntry && (
          <View style={poolScreenStyles.entryBanner} {...uiProps(uiPath('pool_detail', 'settlement_banner', 'container'))}>
            <Text style={poolScreenStyles.entryBannerLabel} {...uiProps(uiPath('pool_detail', 'settlement_banner', 'label'))}>
              {settlementEntry.entryType === 'income' ? 'You are owed' : 'You owe'}{' '}
              <Text style={poolScreenStyles.entryBannerAmount}>{settlementEntry.amount.toFixed(2)}</Text>
            </Text>
            <TouchableOpacity
              style={poolScreenStyles.entryBannerButton}
              onPress={() => {
                const entry = settlementEntry;
                setSettlementEntry(null);
                pool.setSelectedPool(null);
                navigation.navigate('Dashboard', {
                  prefillEntry: {
                    amount: entry.amount,
                    type: entry.entryType,
                    note: entry.poolName,
                  },
                });
              }}
              {...uiProps(uiPath('pool_detail', 'settlement_banner', 'add_button'))}
            >
              <Text style={poolScreenStyles.entryBannerButtonText}>Add as transaction</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={poolScreenStyles.entryBannerDismiss}
              onPress={() => {
                setSettlementEntry(null);
                pool.setSelectedPool(null);
              }}
              {...uiProps(uiPath('pool_detail', 'settlement_banner', 'dismiss_button'))}
            >
              <Text style={poolScreenStyles.entryBannerDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
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
    <View style={sh.container} {...uiProps(uiPath('pool_list', 'screen', 'container'))}>
      <PoolHeader
        title="Pools"
        onBack={() => navigation.goBack()}
        onAdd={() => setShowCreateModal(true)}
      />

      <PoolListContent
        pools={pools}
        loading={loading}
        onOpenPool={pool.openPool}
        currentUserId={user?.id ?? ''}
        creatorProfiles={creatorProfiles}
      />

      <CreatePoolModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePool}
      />
    </View>
  );
}

const poolScreenStyles = StyleSheet.create({
  entryBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#0E2818',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a4a2e',
    padding: 14,
    gap: 10,
  },
  entryBannerLabel: {
    color: '#BAD0EE',
    fontSize: 13,
  },
  entryBannerAmount: {
    color: '#53E3A6',
    fontWeight: '700',
  },
  entryBannerButton: {
    backgroundColor: '#0D3D22',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  entryBannerButtonText: {
    color: '#53E3A6',
    fontSize: 13,
    fontWeight: '600',
  },
  entryBannerDismiss: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  entryBannerDismissText: {
    color: '#475569',
    fontSize: 12,
  },
});
