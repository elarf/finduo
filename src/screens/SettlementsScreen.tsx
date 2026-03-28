import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Icon from '../components/Icon';
import type { Pool, PoolType } from '../types/pools';
import type { AppDebt } from '../types/pools';

export default function SettlementsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const {
    pools, members, loading: poolsLoading,
    getUserPools, createPool, addPoolMember, loadPoolMembers, closePool,
  } = usePools(user);
  const {
    transactions, loading: txLoading,
    getPoolTransactions, addPoolTransaction, deletePoolTransaction,
  } = usePoolTransactions(user);
  const { debts, loading: debtsLoading, getUserDebts, settlePoolDebts, confirmDebt, markPaid } = useDebts(user);

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

  // Add member form
  const [memberUserId, setMemberUserId] = useState('');

  useEffect(() => {
    void getUserPools();
    void getUserDebts();
  }, [getUserPools, getUserDebts]);

  const openPool = useCallback((pool: Pool) => {
    setSelectedPool(pool);
    void getPoolTransactions(pool.id);
    void loadPoolMembers(pool.id);
  }, [getPoolTransactions, loadPoolMembers]);

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

  const handleAddTransaction = useCallback(async () => {
    if (!selectedPool) return;
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    await addPoolTransaction(
      selectedPool.id,
      amount,
      txDescription.trim(),
      new Date().toISOString().slice(0, 10),
    );
    setTxAmount('');
    setTxDescription('');
    setShowAddTxModal(false);
  }, [addPoolTransaction, selectedPool, txAmount, txDescription]);

  const handleAddMember = useCallback(async () => {
    if (!selectedPool || !memberUserId.trim()) return;
    await addPoolMember(selectedPool.id, memberUserId.trim());
    setMemberUserId('');
    setShowAddMemberModal(false);
  }, [addPoolMember, memberUserId, selectedPool]);

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

  // Debt groupings
  const pendingDebts = useMemo(() => debts.filter((d) => d.status === 'pending'), [debts]);
  const confirmedDebts = useMemo(() => debts.filter((d) => d.status === 'confirmed'), [debts]);
  const paidDebts = useMemo(() => debts.filter((d) => d.status === 'paid'), [debts]);

  const netBalance = useMemo(() => {
    if (!user) return 0;
    return debts
      .filter((d) => d.status !== 'paid')
      .reduce((sum, d) => {
        if (d.to_user === user.id) return sum + Number(d.amount);
        if (d.from_user === user.id) return sum - Number(d.amount);
        return sum;
      }, 0);
  }, [debts, user]);

  if (!user) return null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
          <Icon name="ArrowLeft" size={20} color="#EAF3FF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settlements</Text>
        <TouchableOpacity
          onPress={() => { void getUserPools(); void getUserDebts(); }}
          style={s.backButton}
        >
          <Icon name="RefreshCw" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ═══════════════ SECTION 1: POOLS ═══════════════ */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Pools</Text>
          <TouchableOpacity style={s.sectionAction} onPress={() => setShowCreateModal(true)}>
            <Icon name="Plus" size={16} color="#53E3A6" />
            <Text style={s.sectionActionText}>Create</Text>
          </TouchableOpacity>
        </View>

        {poolsLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 12 }} />}

        {!poolsLoading && pools.length === 0 && (
          <View style={s.emptyContainer}>
            <Icon name="Users" size={32} color="#1F3A59" />
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

        {/* ═══════════════ ACTIVE POOL VIEW ═══════════════ */}
        {selectedPool && (
          <>
            <View style={s.divider} />
            <View style={s.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>{selectedPool.name}</Text>
                <Text style={s.poolDetailSub}>
                  {selectedPool.type === 'event' ? 'Event' : 'Continuous'} &middot; {selectedPool.status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPool(null)} style={s.backButton}>
                <Icon name="X" size={18} color="#64748B" />
              </TouchableOpacity>
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

            {/* Pool actions */}
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
            {selectedPool.status === 'active' && (
              <View style={s.actionsRow}>
                <TouchableOpacity style={s.settleButton} onPress={() => void handleSettlePool()}>
                  <Icon name="Check" size={16} color="#060A14" />
                  <Text style={s.actionButtonText}>Settle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeButton} onPress={() => void handleClosePool()}>
                  <Icon name="X" size={16} color="#f87171" />
                  <Text style={[s.actionButtonText, { color: '#f87171' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Pool transactions */}
            <Text style={[s.subSectionTitle, { marginTop: 16 }]}>Transactions</Text>
            {txLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 8 }} />}
            {!txLoading && transactions.length === 0 && (
              <Text style={s.emptyTextSmall}>No transactions yet</Text>
            )}
            {transactions.map((tx) => (
              <View key={tx.id} style={s.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDescription}>{tx.description || 'Expense'}</Text>
                  <Text style={s.txDate}>{tx.date}</Text>
                </View>
                <Text style={s.txAmount}>{Number(tx.amount).toFixed(2)}</Text>
                {tx.paid_by === user.id && selectedPool.status === 'active' && (
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
              </View>
            ))}
          </>
        )}

        {/* ═══════════════ SECTION 3: DEBTS ═══════════════ */}
        <View style={s.divider} />
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Debts</Text>
        </View>

        {/* Net balance */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Net balance</Text>
          <Text style={[s.balanceValue, { color: netBalance >= 0 ? '#4ade80' : '#f87171' }]}>
            {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}
          </Text>
          <Text style={s.balanceHint}>
            {netBalance > 0 ? 'Others owe you' : netBalance < 0 ? 'You owe others' : 'All settled'}
          </Text>
        </View>

        {debtsLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 12 }} />}

        {!debtsLoading && debts.length === 0 && (
          <View style={s.emptyContainer}>
            <Icon name="Handshake" size={32} color="#1F3A59" />
            <Text style={s.emptyText}>No debts</Text>
            <Text style={s.emptyHint}>Settle a pool to create debts</Text>
          </View>
        )}

        {pendingDebts.length > 0 && (
          <>
            <Text style={s.subSectionTitle}>Pending ({pendingDebts.length})</Text>
            {pendingDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onMarkPaid={markPaid} />
            ))}
          </>
        )}

        {confirmedDebts.length > 0 && (
          <>
            <Text style={s.subSectionTitle}>Confirmed ({confirmedDebts.length})</Text>
            {confirmedDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onMarkPaid={markPaid} />
            ))}
          </>
        )}

        {paidDebts.length > 0 && (
          <>
            <Text style={s.subSectionTitle}>Paid ({paidDebts.length})</Text>
            {paidDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onMarkPaid={markPaid} />
            ))}
          </>
        )}
      </ScrollView>

      {/* ═══════════════ MODALS ═══════════════ */}

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

      {/* Add transaction modal */}
      <Modal visible={showAddTxModal} transparent animationType="none" onRequestClose={() => setShowAddTxModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowAddTxModal(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Add expense</Text>
            <TextInput
              placeholder="Amount"
              placeholderTextColor="#64748B"
              value={txAmount}
              onChangeText={setTxAmount}
              keyboardType="numeric"
              style={s.input}
            />
            <TextInput
              placeholder="Description (optional)"
              placeholderTextColor="#64748B"
              value={txDescription}
              onChangeText={setTxDescription}
              style={s.input}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalSecondary} onPress={() => setShowAddTxModal(false)}>
                <Text style={s.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalPrimary} onPress={() => void handleAddTransaction()}>
                <Text style={s.modalPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add member modal */}
      <Modal visible={showAddMemberModal} transparent animationType="none" onRequestClose={() => setShowAddMemberModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowAddMemberModal(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Add member</Text>
            <Text style={s.hintText}>Paste the user ID of the person to add</Text>
            <TextInput
              placeholder="User ID"
              placeholderTextColor="#64748B"
              value={memberUserId}
              onChangeText={setMemberUserId}
              style={s.input}
              autoCapitalize="none"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalSecondary} onPress={() => setShowAddMemberModal(false)}>
                <Text style={s.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalPrimary} onPress={() => void handleAddMember()}>
                <Text style={s.modalPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─── DebtRow component ─── */

function DebtRow({ debt, userId, onConfirm, onMarkPaid }: {
  debt: AppDebt;
  userId: string;
  onConfirm: (id: string) => void;
  onMarkPaid: (id: string) => void;
}) {
  const iOwe = debt.from_user === userId;
  const myConfirmed = iOwe ? debt.from_confirmed : debt.to_confirmed;
  const otherConfirmed = iOwe ? debt.to_confirmed : debt.from_confirmed;
  const otherUserId = iOwe ? debt.to_user : debt.from_user;
  const shortId = otherUserId.slice(0, 8);

  const statusColor =
    debt.status === 'paid' ? '#4ade80' :
    debt.status === 'confirmed' ? '#53E3A6' :
    '#f59e0b';

  return (
    <View style={s.debtRow}>
      <View style={s.debtIcon}>
        <Icon
          name={iOwe ? 'ArrowUpRight' : 'ArrowDownLeft'}
          size={18}
          color={iOwe ? '#f87171' : '#4ade80'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.debtText}>
          {iOwe ? `You owe ${shortId}...` : `${shortId}... owes you`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <View style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{debt.status}</Text>
          </View>
          {debt.pool_id && <Text style={s.debtMeta}>pool</Text>}
          {myConfirmed && <Text style={s.debtMeta}>you confirmed</Text>}
          {otherConfirmed && <Text style={s.debtMeta}>they confirmed</Text>}
        </View>
      </View>
      <Text style={[s.debtAmount, { color: iOwe ? '#f87171' : '#4ade80' }]}>
        {iOwe ? '-' : '+'}{Number(debt.amount).toFixed(2)}
      </Text>
      <View style={s.debtActions}>
        {debt.status === 'pending' && !myConfirmed && (
          <TouchableOpacity style={s.confirmBtn} onPress={() => onConfirm(debt.id)}>
            <Icon name="Check" size={14} color="#060A14" />
          </TouchableOpacity>
        )}
        {debt.status === 'confirmed' && (
          <TouchableOpacity style={s.paidBtn} onPress={() => onMarkPaid(debt.id)}>
            <Text style={s.paidBtnText}>Paid</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Styles ─── */

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

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionActionText: {
    color: '#53E3A6',
    fontSize: 12,
    fontWeight: '600',
  },
  subSectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },

  divider: {
    height: 1,
    backgroundColor: '#1F3A59',
    marginHorizontal: 16,
    marginTop: 20,
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
  poolDetailSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyHint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyTextSmall: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 10,
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
    marginTop: 10,
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
  settleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#53E3A6',
    borderRadius: 10,
    paddingVertical: 10,
  },
  closeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0E1A2B',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f8717133',
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

  // Balance card
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  balanceHint: {
    color: '#475569',
    fontSize: 12,
  },

  // Debt row
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#101A2A',
    gap: 10,
  },
  debtIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtText: {
    color: '#EAF3FF',
    fontSize: 14,
  },
  debtMeta: {
    color: '#475569',
    fontSize: 10,
  },
  debtAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  debtActions: {
    flexDirection: 'row',
    gap: 6,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Buttons
  confirmBtn: {
    backgroundColor: '#53E3A6',
    borderRadius: 6,
    padding: 6,
  },
  paidBtn: {
    backgroundColor: '#1F3A59',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paidBtnText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '600',
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
});
