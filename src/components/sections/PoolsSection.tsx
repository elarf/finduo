import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { usePools } from '../../hooks/usePools';
import { usePoolTransactions } from '../../hooks/usePoolTransactions';
import { usePool } from '../../hooks/usePool';
import { useDebts } from '../../hooks/useDebts';
import { useFriends } from '../../hooks/useFriends';
import { useContacts } from '../../hooks/useContacts';
import { poolSharedStyles as sh } from '../pool/poolStyles';
import { PoolHeader } from '../pool/PoolHeader';
import { PoolSummaryCard } from '../pool/PoolSummaryCard';
import { PoolMemberChips } from '../pool/PoolMemberChips';
import { PoolActions } from '../pool/PoolActions';
import { TransactionList } from '../pool/TransactionList';
import { TransactionModal } from '../pool/TransactionModal';
import { AddMemberModal } from '../pool/AddMemberModal';
import { CreatePoolModal } from '../pool/CreatePoolModal';
import { PoolListContent } from '../pool/PoolListContent';
import { SettlementModal } from '../pool/SettlementModal';
import ContextBar from '../dashboard/layout/ContextBar';
import Icon from '../Icon';
import { uiPath, uiProps } from '../../lib/devtools';
import type { Pool, PoolTransaction } from '../../types/pools';
import type { PoolType } from '../../types/pools';
import type { ResolvedFriend } from '../../types/friends';

export default function PoolsSection() {
  const { user } = useAuth();
  const { setActiveSection } = useDashboard();

  const {
    pools, members, creatorProfiles, loading,
    getUserPools, createPool, addPoolMember, loadPoolMembers, closePool, deletePool,
  } = usePools(user);

  const {
    transactions, loading: txLoading,
    getPoolTransactions, addPoolTransaction, updatePoolTransaction, deletePoolTransaction,
  } = usePoolTransactions(user);

  const { settlePoolDebts, computePoolSettlement, commitPoolSettlement } = useDebts(user);
  const { friends, loading: friendsLoading, loadFriends } = useFriends(user);
  const {
    contacts, loading: contactsLoading,
    getContacts, createContact, findOrCreateContactForUser,
  } = useContacts(user);

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
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [editingTx, setEditingTx] = useState<PoolTransaction | null>(null);

  useEffect(() => {
    void getUserPools();
  }, [getUserPools]);

  useEffect(() => {
    if (showAddMemberModal) {
      if (friends.length === 0 && !friendsLoading) void loadFriends();
      if (contacts.length === 0 && !contactsLoading) void getContacts();
    }
  }, [contacts.length, contactsLoading, friends.length, friendsLoading, getContacts, loadFriends, showAddMemberModal]);

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
    const contact = await findOrCreateContactForUser(
      friend.userId,
      displayName,
      friend.profile?.email,
      friend.profile?.avatar_url,
    );
    await addPoolMember(pool.selectedPool.id, friend.userId, displayName, contact?.id);
    setShowAddMemberModal(false);
  }, [addPoolMember, findOrCreateContactForUser, pool.selectedPool]);

  const handleAddExternal = useCallback(async (name: string, contactId?: string) => {
    if (!pool.selectedPool) return;
    if (contactId) {
      await addPoolMember(pool.selectedPool.id, null, name, contactId);
    } else {
      const contact = await createContact({ display_name: name });
      await addPoolMember(pool.selectedPool.id, null, name, contact?.id);
    }
    setShowAddMemberModal(false);
  }, [addPoolMember, createContact, pool.selectedPool]);

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
        <ContextBar label="Pools" onDismiss={() => setActiveSection(null)} />
        <PoolHeader
          title={pool.selectedPool.name}
          subtitle={`${pool.selectedPool.type === 'event' ? 'Event' : 'Continuous'} · ${pool.selectedPool.status}`}
          onBack={() => pool.setSelectedPool(null)}
          onSettle={isActive ? () => setShowSettlementModal(true) : undefined}
          onClose={isActive && isCreator && pool.selectedPool.type === 'event' ? pool.handleClosePool : undefined}
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

        <View style={{ flex: 1 }}>
          <TransactionList
            transactions={transactions}
            loading={txLoading}
            members={pool.poolMembers}
            currentUserId={user?.id ?? ''}
            poolCreatedBy={pool.selectedPool.created_by}
            onEdit={openEditTxModal}
            onDelete={deletePoolTransaction}
          />
        </View>

        {isActive && (
          <PoolActions
            onAddExpense={() => setShowAddTxModal(true)}
            onAddMember={() => setShowAddMemberModal(true)}
          />
        )}

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
          contacts={contacts}
          contactsLoading={contactsLoading}
        />

        <SettlementModal
          visible={showSettlementModal}
          onClose={() => setShowSettlementModal(false)}
          onSaved={async () => {
            setShowSettlementModal(false);
            await getUserPools();
            pool.setSelectedPool(null);
          }}
          poolId={pool.selectedPool.id}
          poolName={pool.selectedPool.name}
          members={pool.poolMembers}
          transactions={transactions}
          perPerson={pool.perPerson}
          computeSettlement={computePoolSettlement}
          commitSettlement={commitPoolSettlement}
        />
      </View>
    );
  }

  // ─── Pool list view ───
  return (
    <View style={sh.container} {...uiProps(uiPath('pool_list', 'screen', 'container'))}>
      <ContextBar
        label="Pools"
        onDismiss={() => setActiveSection(null)}
        rightElement={
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            style={{ padding: 6 }}
            {...uiProps(uiPath('pool_list', 'header', 'add_button'))}
          >
            <Icon name="Plus" size={20} color="#53E3A6" />
          </TouchableOpacity>
        }
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
