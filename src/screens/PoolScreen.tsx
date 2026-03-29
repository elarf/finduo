import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePools } from '../hooks/usePools';
import { usePoolTransactions } from '../hooks/usePoolTransactions';
import { useDebts } from '../hooks/useDebts';
import { useFriends } from '../hooks/useFriends';
import Icon from '../components/Icon';
import type { Pool, PoolType, PoolTransaction } from '../types/pools';
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

  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Create pool form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PoolType>('event');

  // Add transaction form
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txPaidBy, setTxPaidBy] = useState<string>('');

  // Add member form
  const [memberMode, setMemberMode] = useState<'friends' | 'external'>('friends');
  const [memberSearch, setMemberSearch] = useState('');
  const [externalName, setExternalName] = useState('');

  // Editing transaction
  const [editingTx, setEditingTx] = useState<PoolTransaction | null>(null);
  useEffect(() => {
    void getUserPools();
  }, [getUserPools]);

  const openPool = useCallback((pool: Pool) => {
    setSelectedPool(pool);
    void getPoolTransactions(pool.id);
    void loadPoolMembers(pool.id);
    void loadFriends(); // pre-load so the modal is instant
  }, [getPoolTransactions, loadFriends, loadPoolMembers]);

  const handleCreatePool = useCallback(async () => {
    if (!newName.trim()) {
      Alert.alert('Missing name', 'Enter a pool name.');
      return;
    }
    const pool = await createPool(newName.trim(), newType);
    setNewName('');
    setNewType('event');
    setShowCreateModal(false);
    if (pool) openPool(pool);
  }, [createPool, newName, newType, openPool]);

  // Seed paidBy when modal opens (default: current user)
  useEffect(() => {
    if (showAddTxModal && !editingTx) setTxPaidBy(user?.id ?? '');
  }, [showAddTxModal, editingTx, user?.id]);

  const openEditTxModal = useCallback((tx: PoolTransaction) => {
    setEditingTx(tx);
    setTxAmount(String(Number(tx.amount)));
    setTxDescription(tx.description);
    setTxPaidBy(tx.paid_by);
    setShowAddTxModal(true);
  }, []);

  const closeTxModal = useCallback(() => {
    setShowAddTxModal(false);
    setEditingTx(null);
    setTxAmount('');
    setTxDescription('');
  }, []);

  const appendNumpad = useCallback((key: string) => {
    setTxAmount((prev) => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.' && prev.includes('.')) return prev;
      if (key === '.' && prev === '') return '0.';
      const parts = prev.split('.');
      if (parts.length === 2 && parts[1].length >= 2) return prev;
      if (prev === '0' && key !== '.') return key;
      return prev + key;
    });
  }, []);

  const handleAddTransaction = useCallback(async () => {
    if (!selectedPool) return;
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    if (editingTx) {
      await updatePoolTransaction(
        editingTx.id,
        selectedPool.id,
        amount,
        txDescription.trim(),
        txPaidBy || user?.id,
      );
    } else {
      await addPoolTransaction(
        selectedPool.id,
        amount,
        txDescription.trim(),
        new Date().toISOString().slice(0, 10),
        txPaidBy || user?.id,
      );
    }
    closeTxModal();
  }, [addPoolTransaction, updatePoolTransaction, closeTxModal, editingTx, selectedPool, txAmount, txDescription, txPaidBy, user?.id]);

  const closeMemberModal = useCallback(() => {
    setShowAddMemberModal(false);
    setMemberSearch('');
    setExternalName('');
  }, []);

  const handleAddFriend = useCallback(async (friend: ResolvedFriend) => {
    if (!selectedPool) return;
    const displayName =
      friend.profile?.display_name ?? friend.profile?.email ?? friend.userId;
    await addPoolMember(selectedPool.id, friend.userId, displayName);
    closeMemberModal();
  }, [addPoolMember, closeMemberModal, selectedPool]);

  const handleAddExternal = useCallback(async () => {
    if (!selectedPool) return;
    const name = externalName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the external member.');
      return;
    }
    const alreadyAdded = (members[selectedPool.id] ?? []).some(
      (m) => m.display_name?.toLowerCase() === name.toLowerCase(),
    );
    if (alreadyAdded) {
      Alert.alert('Duplicate', `"${name}" is already a member of this pool.`);
      return;
    }
    await addPoolMember(selectedPool.id, null, name);
    closeMemberModal();
  }, [addPoolMember, closeMemberModal, externalName, members, selectedPool]);

  useEffect(() => {
    if (showAddMemberModal) {
      setMemberSearch('');
      setExternalName('');
      // If friends haven't been loaded yet, kick off a load
      if (friends.length === 0 && !friendsLoading) void loadFriends();
    }
  }, [friendsLoading, friends.length, loadFriends, showAddMemberModal]);

  // Auto-switch to manual entry if friends finished loading and list is still empty
  useEffect(() => {
    if (showAddMemberModal && !friendsLoading && friends.length === 0) {
      setMemberMode('external');
    }
  }, [friendsLoading, friends.length, showAddMemberModal]);

  const filteredFriends = useMemo(() => {
    const q = memberSearch.toLowerCase();
    return friends.filter((f) => {
      if (!q) return true;
      const name = (f.profile?.display_name ?? '').toLowerCase();
      const email = (f.profile?.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [friends, memberSearch]);

  const handleClosePool = useCallback(async () => {
    if (!selectedPool) return;
    Alert.alert('Close pool', `Close "${selectedPool.name}"? No more transactions can be added.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          await closePool(selectedPool.id);
          setSelectedPool(null);
        },
      },
    ]);
  }, [closePool, selectedPool]);

  const handleSettlePool = useCallback(async () => {
    if (!selectedPool) return;
    Alert.alert('Settle pool', `Settle "${selectedPool.name}"? This will calculate debts and close the pool.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settle',
        onPress: async () => {
          await settlePoolDebts(selectedPool.id);
          await getUserPools();
          setSelectedPool(null);
        },
      },
    ]);
  }, [getUserPools, selectedPool, settlePoolDebts]);

  // Pool totals
  const poolTotal = useMemo(
    () => transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions],
  );

  const poolMembers = selectedPool ? (members[selectedPool.id] ?? []) : [];
  const memberCount = poolMembers.length || 1;
  const perPerson = poolTotal / memberCount;

  // ─── Pool detail view ───
  if (selectedPool) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelectedPool(null)} style={s.backButton}>
            <Icon name="ArrowLeft" size={20} color="#EAF3FF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{selectedPool.name}</Text>
            <Text style={s.headerSub}>
              {selectedPool.type === 'event' ? 'Event' : 'Continuous'} &middot; {selectedPool.status}
            </Text>
          </View>
          {selectedPool.status === 'active' && (
            <>
              <TouchableOpacity onPress={handleSettlePool} style={s.headerAction}>
                <Text style={{ color: '#53E3A6', fontSize: 13, fontWeight: '600' }}>Settle</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClosePool} style={s.headerAction}>
                <Text style={{ color: '#f87171', fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Summary */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Total</Text>
            <Text style={s.summaryValue}>{poolTotal.toFixed(2)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Members</Text>
            <Text style={s.summaryValue}>{memberCount}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Per person</Text>
            <Text style={s.summaryValue}>{perPerson.toFixed(2)}</Text>
          </View>
        </View>

        {/* Members */}
        {poolMembers.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.membersRow}
          >
            {poolMembers.map((m) => {
              const label = m.display_name ?? (m.user_id === user?.id ? 'You' : (m.user_id?.slice(0, 8) ?? '?'));
              const isExternal = !m.user_id;
              return (
                <View key={m.id} style={[s.memberChip, isExternal && s.memberChipExternal]}>
                  <Text style={s.memberChipText}>{label}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Actions */}
        {selectedPool.status === 'active' && (
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionButton} onPress={() => setShowAddTxModal(true)}>
              <Icon name="Plus" size={16} color="#060A14" />
              <Text style={s.actionButtonText}>Add expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionButton, s.actionButtonSecondary]} onPress={() => setShowAddMemberModal(true)}>
              <Icon name="UserPlus" size={16} color="#EAF3FF" />
              <Text style={[s.actionButtonText, { color: '#EAF3FF' }]}>Add member</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transactions */}
        <Text style={s.sectionTitle}>Transactions</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {txLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 12 }} />}
          {!txLoading && transactions.length === 0 && (
            <Text style={s.emptyText}>No transactions yet</Text>
          )}
          {transactions.map((tx) => {
            const payer = poolMembers.find((m) => m.user_id === tx.paid_by);
            const payerLabel = payer?.display_name ?? (tx.paid_by === user?.id ? 'You' : tx.paid_by?.slice(0, 8));
            return (
            <TouchableOpacity key={tx.id} style={s.txRow} onPress={() => openEditTxModal(tx)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.txDescription}>{tx.description || 'Expense'}</Text>
                <Text style={s.txDate}>{tx.date} &middot; {payerLabel}</Text>
              </View>
              <Text style={s.txAmount}>{Number(tx.amount).toFixed(2)}</Text>
              {(tx.paid_by === user?.id || selectedPool.created_by === user?.id) && (
                <TouchableOpacity
                  style={s.txDelete}
                  onPress={() => {
                    Alert.alert('Delete', 'Remove this expense?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => void deletePoolTransaction(tx.id, selectedPool.id) },
                    ]);
                  }}
                >
                  <Icon name="Trash2" size={14} color="#f87171" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Add/Edit transaction modal */}
        <Modal visible={showAddTxModal} transparent animationType="none" onRequestClose={closeTxModal}>
          <Pressable style={s.modalBackdrop} onPress={closeTxModal}>
            <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={s.modalTitle}>{editingTx ? 'Edit expense' : 'Add expense'}</Text>

              {/* Payer selector */}
              {poolMembers.filter((m) => m.user_id).length > 1 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={s.label}>Who paid?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {poolMembers.filter((m) => m.user_id !== null).map((m) => {
                      const label = m.display_name ?? (m.user_id === user?.id ? 'You' : m.user_id!.slice(0, 8));
                      const active = txPaidBy === m.user_id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[s.payerChip, active && s.payerChipActive]}
                          onPress={() => setTxPaidBy(m.user_id!)}
                        >
                          <Text style={[s.payerChipText, active && s.payerChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Amount display */}
              <View style={s.amountDisplay}>
                <Text style={s.amountText}>{txAmount || '0'}</Text>
              </View>

              {/* Description */}
              <TextInput
                placeholder="Description (optional)"
                placeholderTextColor="#64748B"
                value={txDescription}
                onChangeText={setTxDescription}
                style={[s.input, { marginTop: 8 }]}
              />

              {/* Numpad */}
              <View style={s.numpad}>
                {(['7','8','9','4','5','6','1','2','3','.','0','⌫'] as const).map((key) => (
                  <TouchableOpacity key={key} style={s.numpadKey} onPress={() => appendNumpad(key)}>
                    <Text style={s.numpadKeyText}>{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalSecondary} onPress={closeTxModal}>
                  <Text style={s.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalPrimary} onPress={() => void handleAddTransaction()}>
                  <Text style={s.modalPrimaryText}>{editingTx ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Add member modal */}
        <Modal visible={showAddMemberModal} transparent animationType="none" onRequestClose={closeMemberModal}>
          <Pressable style={s.modalBackdrop} onPress={closeMemberModal}>
            <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={s.modalTitle}>Add member</Text>

              {/* Tab toggle */}
              <View style={s.tabRow}>
                <TouchableOpacity
                  style={[s.tab, memberMode === 'friends' && s.tabActive]}
                  onPress={() => setMemberMode('friends')}
                >
                  <Icon name="Users" size={13} color={memberMode === 'friends' ? '#53E3A6' : '#64748B'} />
                  <Text style={[s.tabText, memberMode === 'friends' && s.tabTextActive]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tab, memberMode === 'external' && s.tabActive]}
                  onPress={() => setMemberMode('external')}
                >
                  <Icon name="UserPlus" size={13} color={memberMode === 'external' ? '#53E3A6' : '#64748B'} />
                  <Text style={[s.tabText, memberMode === 'external' && s.tabTextActive]}>Add manually</Text>
                </TouchableOpacity>
              </View>

              {memberMode === 'friends' ? (
                <View>
                  <TextInput
                    placeholder="Search friends…"
                    placeholderTextColor="#64748B"
                    value={memberSearch}
                    onChangeText={setMemberSearch}
                    style={[s.input, { marginTop: 10 }]}
                  />
                  {friendsLoading ? (
                    <ActivityIndicator color="#53E3A6" style={{ marginVertical: 16 }} />
                  ) : filteredFriends.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
                      <Icon name="Users" size={28} color="#1F3A59" />
                      <Text style={[s.hintText, { textAlign: 'center' }]}>
                        {friends.length === 0
                          ? 'No friends yet. Use "Add manually" to add anyone by name.'
                          : 'No results for that search'}
                      </Text>
                    </View>
                  ) : (
                    <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                      {filteredFriends.map((f) => {
                        const alreadyAdded = poolMembers.some((m) => m.user_id === f.userId);
                        const label = f.profile?.display_name ?? f.profile?.email ?? f.userId;
                        const sub = f.profile?.display_name && f.profile?.email ? f.profile.email : null;
                        return (
                          <TouchableOpacity
                            key={f.rowId}
                            style={[s.friendRow, alreadyAdded && s.friendRowDisabled]}
                            disabled={alreadyAdded}
                            onPress={() => void handleAddFriend(f)}
                          >
                            <View style={s.avatar}>
                              {f.profile?.avatar_url ? (
                                <Image source={{ uri: f.profile.avatar_url }} style={s.avatarImg} />
                              ) : (
                                <Text style={s.avatarInitial}>{label[0]?.toUpperCase() ?? '?'}</Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.friendName, alreadyAdded && { color: '#475569' }]}>{label}</Text>
                              {sub && <Text style={s.friendEmail}>{sub}</Text>}
                            </View>
                            {alreadyAdded && <Icon name="Check" size={14} color="#475569" />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.hintText}>Add anyone — no app account needed.</Text>
                  <TextInput
                    placeholder="Name (required)"
                    placeholderTextColor="#64748B"
                    value={externalName}
                    onChangeText={setExternalName}
                    style={s.input}
                    autoCorrect={false}
                  />
                </View>
              )}

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalSecondary} onPress={closeMemberModal}>
                  <Text style={s.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                {memberMode === 'external' && (
                  <TouchableOpacity
                    style={[s.modalPrimary, !externalName.trim() && { opacity: 0.4 }]}
                    disabled={!externalName.trim()}
                    onPress={() => void handleAddExternal()}
                  >
                    <Text style={s.modalPrimaryText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // ─── Pool list view ───
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
          <Icon name="ArrowLeft" size={20} color="#EAF3FF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Pools</Text>
        <TouchableOpacity style={s.headerAction} onPress={() => setShowCreateModal(true)}>
          <Icon name="Plus" size={20} color="#53E3A6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 24 }} />}
        {!loading && pools.length === 0 && (
          <View style={s.emptyContainer}>
            <Icon name="Users" size={40} color="#1F3A59" />
            <Text style={s.emptyText}>No pools yet</Text>
            <Text style={s.emptyHint}>Create a pool to split expenses with friends</Text>
          </View>
        )}
        {pools.map((pool) => (
          <TouchableOpacity key={pool.id} style={s.poolCard} onPress={() => openPool(pool)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.poolIcon, pool.status === 'closed' && { opacity: 0.4 }]}>
                <Icon name={pool.type === 'event' ? 'CalendarDays' : 'Repeat'} size={18} color="#53E3A6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.poolName, pool.status === 'closed' && { color: '#475569' }]}>{pool.name}</Text>
                <Text style={s.poolMeta}>
                  {pool.type === 'event' ? 'Event' : 'Continuous'}
                  {pool.status === 'closed' ? ' \u00b7 Closed' : ''}
                </Text>
              </View>
              <Icon name="ChevronRight" size={16} color="#475569" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create pool modal */}
      <Modal visible={showCreateModal} transparent animationType="none" onRequestClose={() => setShowCreateModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowCreateModal(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Create pool</Text>
            <TextInput
              placeholder="Pool name"
              placeholderTextColor="#64748B"
              value={newName}
              onChangeText={setNewName}
              style={s.input}
            />
            <Text style={s.label}>Type</Text>
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeButton, newType === 'event' && s.typeButtonActive]}
                onPress={() => setNewType('event')}
              >
                <Text style={s.typeButtonText}>Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeButton, newType === 'continuous' && s.typeButtonActive]}
                onPress={() => setNewType('continuous')}
              >
                <Text style={s.typeButtonText}>Continuous</Text>
              </TouchableOpacity>
            </View>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalSecondary} onPress={() => setShowCreateModal(false)}>
                <Text style={s.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalPrimary} onPress={() => void handleCreatePool()}>
                <Text style={s.modalPrimaryText}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060A14',
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#000',
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    color: '#EAF3FF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  headerAction: {
    padding: 6,
  },

  // Pool list
  poolCard: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
  },
  poolIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0D2818',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolName: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '600',
  },
  poolMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyHint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  summaryValue: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#53E3A6',
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionButtonSecondary: {
    backgroundColor: '#1F3A59',
  },
  actionButtonText: {
    color: '#060A14',
    fontSize: 13,
    fontWeight: '600',
  },

  // Section
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },

  // Transactions
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#101A2A',
    gap: 10,
  },
  txDescription: {
    color: '#EAF3FF',
    fontSize: 14,
  },
  txDate: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },
  txDelete: {
    padding: 6,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#0E1A2B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    width: '90%',
    maxWidth: 380,
  },
  modalTitle: {
    color: '#EAF3FF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  modalSecondaryText: {
    color: '#9BB0C9',
    fontSize: 14,
  },
  modalPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#53E3A6',
  },
  modalPrimaryText: {
    color: '#060A14',
    fontSize: 14,
    fontWeight: '600',
  },

  // Form
  input: {
    backgroundColor: '#060A14',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 10,
    color: '#EAF3FF',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  hintText: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#0D2818',
  },
  typeButtonText: {
    color: '#EAF3FF',
    fontSize: 13,
  },

  // Member chips (pool detail)
  membersRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  memberChip: {
    backgroundColor: '#1F3A59',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberChipExternal: {
    backgroundColor: '#2A1F3A',
  },
  memberChipText: {
    color: '#BAD0EE',
    fontSize: 12,
  },

  // Add member modal — tabs
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  tabActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#0D2818',
  },
  tabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#53E3A6',
  },

  // Add member modal — friend list
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111E2E',
  },
  friendRowDisabled: {
    opacity: 0.45,
  },
  friendName: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '500',
  },
  friendEmail: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 34,
    height: 34,
  },
  avatarInitial: {
    color: '#53E3A6',
    fontSize: 13,
    fontWeight: '700',
  },

  // Add expense modal — payer chips
  payerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  payerChipActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#0D2818',
  },
  payerChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  payerChipTextActive: {
    color: '#53E3A6',
    fontWeight: '700',
  },

  // Add expense modal — amount display
  amountDisplay: {
    backgroundColor: '#060A14',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'flex-end',
  },
  amountText: {
    color: '#EAF3FF',
    fontSize: 28,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },

  // Numpad
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  numpadKey: {
    width: '30.5%',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#111F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyText: {
    color: '#EAF3FF',
    fontSize: 18,
    fontWeight: '500',
  },
});
