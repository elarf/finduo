import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../screens/DashboardScreen.styles';
import { CURRENCY_OPTIONS } from '../../types/dashboard';
import type { ResolvedFriend } from '../../types/friends';
import type {
  CreateExpenseData,
  CreatePoolData,
  PoolExpense,
  PoolSettlement,
  PoolType,
  ResolvedDebt,
  ResolvedPool,
  ResolvedPoolMember,
  SettlementPreview,
} from '../../types/pool';

type PoolView = 'list' | 'create' | 'detail' | 'addExpense' | 'settlement';
type ListTab = 'active' | 'settled' | 'debts';
type DetailTab = 'expenses' | 'members' | 'settlements';

type PoolListModalProps = {
  visible: boolean;
  onClose: () => void;
  friends: ResolvedFriend[];
  // usePool return
  pools: ResolvedPool[];
  selectedPool: ResolvedPool | null;
  poolExpenses: PoolExpense[];
  poolSettlements: PoolSettlement[];
  poolDebts: ResolvedDebt[];
  loading: boolean;
  saving: boolean;
  loadPools: () => Promise<void>;
  selectPool: (poolId: string) => Promise<void>;
  createPool: (data: CreatePoolData) => Promise<string | null>;
  updatePool: (poolId: string, data: Partial<any>) => Promise<boolean>;
  deletePool: (poolId: string) => Promise<boolean>;
  addPoolMember: (poolId: string, userId: string) => Promise<boolean>;
  removePoolMember: (poolId: string, userId: string) => Promise<boolean>;
  addExpense: (poolId: string, data: CreateExpenseData) => Promise<boolean>;
  updateExpense: (expenseId: string, data: Partial<PoolExpense>) => Promise<boolean>;
  deleteExpense: (expenseId: string) => Promise<boolean>;
  calculateSettlement: (poolId: string) => SettlementPreview | null;
  commitSettlement: (poolId: string, preview: SettlementPreview, note?: string) => Promise<boolean>;
  confirmDebt: (debtId: string) => Promise<boolean>;
  markDebtPaid: (debtId: string) => Promise<boolean>;
  disputeDebt: (debtId: string) => Promise<boolean>;
  loadAllDebts: () => Promise<void>;
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Helpers                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

const getName = (m: ResolvedPoolMember) =>
  m.display_name ?? m.email ?? 'Unknown';

const getAvatar = (m: ResolvedPoolMember) => m.avatar_url ?? null;

const avatarFallback = (name: string) => (name[0] ?? '?').toUpperCase();

const formatAmount = (amount: number, currency: string) =>
  `${currency} ${Number(amount).toFixed(2)}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Component                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

const PoolListModal: React.FC<PoolListModalProps> = (props) => {
  const {
    visible,
    onClose,
    friends,
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
    deletePool,
    addPoolMember,
    removePoolMember,
    addExpense,
    deleteExpense,
    calculateSettlement,
    commitSettlement,
    confirmDebt,
    markDebtPaid,
    loadAllDebts,
  } = props;

  // ── navigation state ────────────────────────────────────────────────
  const [view, setView] = useState<PoolView>('list');
  const [listTab, setListTab] = useState<ListTab>('active');
  const [detailTab, setDetailTab] = useState<DetailTab>('expenses');

  // ── create pool form ────────────────────────────────────────────────
  const [cpName, setCpName] = useState('');
  const [cpDesc, setCpDesc] = useState('');
  const [cpType, setCpType] = useState<PoolType>('event');
  const [cpCurrency, setCpCurrency] = useState('USD');
  const [cpStartDate, setCpStartDate] = useState(todayIso());
  const [cpEndDate, setCpEndDate] = useState('');
  const [cpSelectedFriends, setCpSelectedFriends] = useState<string[]>([]);

  // ── add expense form ────────────────────────────────────────────────
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(todayIso());
  const [expPaidBy, setExpPaidBy] = useState<string | null>(null);
  const [expSplitAmong, setExpSplitAmong] = useState<string[]>([]);

  // ── settlement ──────────────────────────────────────────────────────
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreview | null>(null);
  const [settlementNote, setSettlementNote] = useState('');

  // ── callbacks ───────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    setView('list');
    setListTab('active');
    void loadPools();
    void loadAllDebts();
  }, [loadPools, loadAllDebts]);

  const resetCreateForm = () => {
    setCpName('');
    setCpDesc('');
    setCpType('event');
    setCpCurrency('USD');
    setCpStartDate(todayIso());
    setCpEndDate('');
    setCpSelectedFriends([]);
  };

  const openCreate = () => {
    resetCreateForm();
    setView('create');
  };

  const handleCreatePool = async () => {
    if (!cpName.trim()) return;
    const poolId = await createPool({
      name: cpName.trim(),
      description: cpDesc.trim() || undefined,
      type: cpType,
      currency: cpCurrency,
      start_date: cpStartDate || undefined,
      end_date: cpEndDate || undefined,
    });
    if (poolId) {
      // Add selected friends as members
      for (const fid of cpSelectedFriends) {
        await addPoolMember(poolId, fid);
      }
      setView('list');
    }
  };

  const openDetail = async (poolId: string) => {
    await selectPool(poolId);
    setDetailTab('expenses');
    setView('detail');
  };

  const openAddExpense = () => {
    setExpAmount('');
    setExpDesc('');
    setExpDate(todayIso());
    setExpPaidBy(null);
    setExpSplitAmong(selectedPool?.members.map((m) => m.user_id) ?? []);
    setView('addExpense');
  };

  const handleAddExpense = async () => {
    if (!selectedPool || !expAmount || !expDesc.trim()) return;
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) return;

    const allMemberIds = selectedPool.members.map((m) => m.user_id);
    const splitAll =
      expSplitAmong.length === allMemberIds.length &&
      allMemberIds.every((id) => expSplitAmong.includes(id));

    await addExpense(selectedPool.id, {
      paid_by: expPaidBy ?? selectedPool.members.find((m) => m.role === 'owner')?.user_id ?? '',
      amount: amt,
      description: expDesc.trim(),
      date: expDate,
      split_among: splitAll ? undefined : expSplitAmong,
    });
    setView('detail');
  };

  const openSettlement = () => {
    if (!selectedPool) return;
    const preview = calculateSettlement(selectedPool.id);
    if (!preview) {
      Alert.alert('Nothing to settle', 'There are no unsettled expenses in this pool.');
      return;
    }
    setSettlementPreview(preview);
    setSettlementNote('');
    setView('settlement');
  };

  const handleCommitSettlement = async () => {
    if (!selectedPool || !settlementPreview) return;
    const ok = await commitSettlement(selectedPool.id, settlementPreview, settlementNote || undefined);
    if (ok) {
      await loadAllDebts();
      setView('detail');
    }
  };

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert('Delete expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteExpense(expenseId) },
    ]);
  };

  const handleDeletePool = () => {
    if (!selectedPool) return;
    Alert.alert('Delete pool', `Delete "${selectedPool.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePool(selectedPool.id);
          setView('list');
        },
      },
    ]);
  };

  const handleRemoveMember = (userId: string, name: string) => {
    if (!selectedPool) return;
    Alert.alert('Remove member', `Remove ${name} from this pool?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removePoolMember(selectedPool.id, userId).then(() => selectPool(selectedPool.id)),
      },
    ]);
  };

  const handleCloseModal = () => {
    setView('list');
    onClose();
  };

  // ── member profile lookup for expenses ──────────────────────────────
  const memberMap: Record<string, ResolvedPoolMember> = {};
  for (const m of selectedPool?.members ?? []) memberMap[m.user_id] = m;

  const getMemberName = (userId: string) =>
    memberMap[userId]?.display_name ?? memberMap[userId]?.email ?? userId.slice(0, 8);

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                            */
  /* ═══════════════════════════════════════════════════════════════════ */

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCloseModal} onShow={handleOpen}>
      <Pressable style={styles.modalBackdrop} onPress={handleCloseModal}>
        <Pressable style={[styles.modalCard, { maxHeight: '85%' }]} onPress={(e) => e.stopPropagation()}>

          {/* ── LIST VIEW ─────────────────────────────────── */}
          {view === 'list' && (
            <>
              <Text style={styles.modalTitle}>Pools</Text>

              <View style={[styles.modalChipsRow, { marginBottom: 12 }]}>
                {(['active', 'settled', 'debts'] as ListTab[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.modalChip, listTab === t && styles.modalChipActive]}
                    onPress={() => setListTab(t)}
                  >
                    <Text style={styles.modalChipText}>
                      {t === 'active' ? 'Active' : t === 'settled' ? 'Settled' : 'Debts'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loading ? (
                <ActivityIndicator color="#53E3A6" style={{ marginVertical: 20 }} />
              ) : (
                <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                  {/* Active pools */}
                  {listTab === 'active' && (
                    <>
                      {pools.filter((p) => p.status === 'active').length === 0 ? (
                        <Text style={styles.emptyText}>No active pools. Create one to get started.</Text>
                      ) : (
                        pools
                          .filter((p) => p.status === 'active')
                          .map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              style={local.poolCard}
                              onPress={() => void openDetail(p.id)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={local.poolName}>{p.name}</Text>
                                <View style={local.poolMeta}>
                                  <Text style={local.poolBadge}>
                                    {p.type === 'event' ? 'Event' : 'Continuous'}
                                  </Text>
                                  <Text style={local.poolMetaText}>
                                    {p.members.length} members
                                  </Text>
                                  <Text style={local.poolMetaText}>
                                    {formatAmount(p.totalSpent, p.currency)}
                                  </Text>
                                </View>
                                {p.unsettledExpenseCount > 0 && (
                                  <Text style={local.unsettledBadge}>
                                    {p.unsettledExpenseCount} unsettled
                                  </Text>
                                )}
                              </View>
                              <Text style={{ color: '#8FA8C9', fontSize: 14 }}>▸</Text>
                            </TouchableOpacity>
                          ))
                      )}
                    </>
                  )}

                  {/* Settled pools */}
                  {listTab === 'settled' && (
                    <>
                      {pools.filter((p) => p.status !== 'active').length === 0 ? (
                        <Text style={styles.emptyText}>No settled pools yet.</Text>
                      ) : (
                        pools
                          .filter((p) => p.status !== 'active')
                          .map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              style={[local.poolCard, { opacity: 0.7 }]}
                              onPress={() => void openDetail(p.id)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={local.poolName}>{p.name}</Text>
                                <Text style={local.poolMetaText}>
                                  {formatAmount(p.totalSpent, p.currency)} total
                                </Text>
                              </View>
                              <Text style={local.poolBadgeSettled}>Settled</Text>
                            </TouchableOpacity>
                          ))
                      )}
                    </>
                  )}

                  {/* Debts */}
                  {listTab === 'debts' && (
                    <>
                      {poolDebts.length === 0 ? (
                        <Text style={styles.emptyText}>No debts.</Text>
                      ) : (
                        poolDebts.map((d) => {
                          const otherName = d.otherUser.display_name ?? d.otherUser.email ?? 'Unknown';
                          const otherAvatar = d.otherUser.avatar_url;
                          return (
                            <View key={d.id} style={local.debtCard}>
                              {otherAvatar ? (
                                <Image source={{ uri: otherAvatar }} style={local.avatar} />
                              ) : (
                                <View style={local.avatarFallback}>
                                  <Text style={local.avatarFallbackText}>{avatarFallback(otherName)}</Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={local.debtText}>
                                  {d.direction === 'owe' ? `You owe ${otherName}` : `${otherName} owes you`}
                                </Text>
                                <Text style={local.debtAmount}>
                                  {formatAmount(d.amount, d.currency)}
                                </Text>
                                <Text style={local.debtPoolName}>{d.poolName}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <Text
                                  style={[
                                    local.statusBadge,
                                    d.status === 'paid' && { color: '#4ade80' },
                                    d.status === 'confirmed' && { color: '#60a5fa' },
                                    d.status === 'disputed' && { color: '#f87171' },
                                  ]}
                                >
                                  {d.status}
                                </Text>
                                {d.status === 'pending' && (
                                  <View style={{ flexDirection: 'row', gap: 4 }}>
                                    {((d.direction === 'owe' && !d.confirmed_by_from) ||
                                      (d.direction === 'owed' && !d.confirmed_by_to)) && (
                                      <TouchableOpacity
                                        style={local.debtAction}
                                        onPress={() => void confirmDebt(d.id)}
                                      >
                                        <Text style={local.debtActionText}>Confirm</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}
                                {d.status === 'confirmed' && d.direction === 'owe' && (
                                  <TouchableOpacity
                                    style={[local.debtAction, { borderColor: '#4ade80' }]}
                                    onPress={() => void markDebtPaid(d.id)}
                                  >
                                    <Text style={[local.debtActionText, { color: '#4ade80' }]}>Mark Paid</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </>
                  )}
                </ScrollView>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={handleCloseModal}>
                  <Text style={styles.modalSecondaryText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimary} onPress={openCreate}>
                  <Text style={styles.modalPrimaryText}>Create Pool</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── CREATE VIEW ───────────────────────────────── */}
          {view === 'create' && (
            <>
              <Text style={styles.modalTitle}>Create Pool</Text>

              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                value={cpName}
                onChangeText={setCpName}
                placeholder="e.g. Weekend Trip"
                placeholderTextColor="#64748B"
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                value={cpDesc}
                onChangeText={setCpDesc}
                placeholder="Optional"
                placeholderTextColor="#64748B"
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Type</Text>
              <View style={[styles.modalChipsRow, { marginBottom: 10 }]}>
                {(['event', 'continuous'] as PoolType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.modalChip, cpType === t && styles.modalChipActive]}
                    onPress={() => setCpType(t)}
                  >
                    <Text style={styles.modalChipText}>
                      {t === 'event' ? 'Event' : 'Continuous'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Currency</Text>
              <View style={[styles.modalChipsRow, { marginBottom: 10, flexWrap: 'wrap' }]}>
                {CURRENCY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.modalChip, cpCurrency === c && styles.modalChipActive]}
                    onPress={() => setCpCurrency(c)}
                  >
                    <Text style={styles.modalChipText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {cpType === 'event' && (
                <>
                  <Text style={styles.modalLabel}>Start Date</Text>
                  <TextInput
                    value={cpStartDate}
                    onChangeText={setCpStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                  />
                  <Text style={styles.modalLabel}>End Date</Text>
                  <TextInput
                    value={cpEndDate}
                    onChangeText={setCpEndDate}
                    placeholder="YYYY-MM-DD (optional)"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                  />
                </>
              )}

              <Text style={[styles.modalLabel, { marginTop: 6 }]}>Participants</Text>
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {friends.filter((f) => f.profile).length === 0 ? (
                  <Text style={styles.emptyText}>No friends to add. Add friends first.</Text>
                ) : (
                  friends
                    .filter((f) => f.profile)
                    .map((f) => {
                      const selected = cpSelectedFriends.includes(f.userId);
                      return (
                        <TouchableOpacity
                          key={f.userId}
                          style={[local.memberRow, selected && local.memberRowActive]}
                          onPress={() => {
                            setCpSelectedFriends((prev) =>
                              selected ? prev.filter((id) => id !== f.userId) : [...prev, f.userId],
                            );
                          }}
                        >
                          <Text style={local.checkmark}>{selected ? '☑' : '☐'}</Text>
                          {f.profile?.avatar_url ? (
                            <Image source={{ uri: f.profile.avatar_url }} style={local.avatarSmall} />
                          ) : (
                            <View style={[local.avatarFallback, local.avatarSmall]}>
                              <Text style={local.avatarFallbackText}>
                                {avatarFallback(f.profile?.display_name ?? f.profile?.email ?? '?')}
                              </Text>
                            </View>
                          )}
                          <Text style={local.memberName}>
                            {f.profile?.display_name ?? f.profile?.email ?? 'Unknown'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={() => setView('list')}>
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimary}
                  onPress={() => void handleCreatePool()}
                  disabled={saving || !cpName.trim()}
                >
                  <Text style={styles.modalPrimaryText}>{saving ? 'Creating…' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── DETAIL VIEW ───────────────────────────────── */}
          {view === 'detail' && selectedPool && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <TouchableOpacity onPress={() => setView('list')} style={{ marginRight: 8 }}>
                  <Text style={{ color: '#8FA8C9', fontSize: 18 }}>◂</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>{selectedPool.name}</Text>
                {selectedPool.myRole === 'owner' && (
                  <TouchableOpacity onPress={handleDeletePool}>
                    <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={local.poolMeta}>
                <Text style={local.poolBadge}>
                  {selectedPool.type === 'event' ? 'Event' : 'Continuous'}
                </Text>
                <Text style={local.poolMetaText}>{selectedPool.currency}</Text>
                <Text style={local.poolMetaText}>
                  {selectedPool.status === 'active' ? 'Active' : 'Settled'}
                </Text>
              </View>

              {/* Member avatars row */}
              <View style={local.avatarRow}>
                {selectedPool.members.map((m) => {
                  const av = getAvatar(m);
                  return av ? (
                    <Image key={m.user_id} source={{ uri: av }} style={local.avatarSmall} />
                  ) : (
                    <View key={m.user_id} style={[local.avatarFallback, local.avatarSmall]}>
                      <Text style={local.avatarFallbackText}>{avatarFallback(getName(m))}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.modalChipsRow, { marginBottom: 10 }]}>
                {(['expenses', 'members', 'settlements'] as DetailTab[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.modalChip, detailTab === t && styles.modalChipActive]}
                    onPress={() => setDetailTab(t)}
                  >
                    <Text style={styles.modalChipText}>
                      {t === 'expenses' ? 'Expenses' : t === 'members' ? 'Members' : 'Settlements'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {/* Expenses tab */}
                {detailTab === 'expenses' && (
                  <>
                    {poolExpenses.length === 0 ? (
                      <Text style={styles.emptyText}>No expenses yet.</Text>
                    ) : (
                      poolExpenses.map((e) => (
                        <View key={e.id} style={local.expenseRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={local.expenseDesc}>{e.description}</Text>
                            <Text style={local.expenseMeta}>
                              {getMemberName(e.paid_by)} paid • {e.date}
                            </Text>
                            {e.split_among && (
                              <Text style={local.expenseSplit}>
                                Split: {e.split_among.map(getMemberName).join(', ')}
                              </Text>
                            )}
                          </View>
                          <Text style={local.expenseAmount}>
                            {formatAmount(e.amount, selectedPool.currency)}
                          </Text>
                          {e.created_by === selectedPool.members.find((m) => m.role === 'owner')?.user_id && (
                            <TouchableOpacity
                              style={{ marginLeft: 6 }}
                              onPress={() => handleDeleteExpense(e.id)}
                            >
                              <Text style={{ color: '#f87171', fontSize: 12 }}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))
                    )}
                  </>
                )}

                {/* Members tab */}
                {detailTab === 'members' && (
                  <>
                    {selectedPool.members.map((m) => {
                      const name = getName(m);
                      const avatar = getAvatar(m);
                      // Compute running balance for this member
                      let net = 0;
                      for (const e of poolExpenses) {
                        const splitMembers = e.split_among ?? selectedPool.members.map((x) => x.user_id);
                        const share = Number(e.amount) / splitMembers.length;
                        if (e.paid_by === m.user_id) net += Number(e.amount);
                        if (splitMembers.includes(m.user_id)) net -= share;
                      }

                      return (
                        <View key={m.user_id} style={local.memberCard}>
                          {avatar ? (
                            <Image source={{ uri: avatar }} style={local.avatarSmall} />
                          ) : (
                            <View style={[local.avatarFallback, local.avatarSmall]}>
                              <Text style={local.avatarFallbackText}>{avatarFallback(name)}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={local.memberName}>{name}</Text>
                            <Text style={local.memberRole}>{m.role}</Text>
                          </View>
                          <Text
                            style={[
                              local.memberBalance,
                              net > 0.005 && { color: '#4ade80' },
                              net < -0.005 && { color: '#f87171' },
                            ]}
                          >
                            {net >= 0 ? '+' : ''}{net.toFixed(2)}
                          </Text>
                          {selectedPool.myRole === 'owner' && m.role !== 'owner' && (
                            <TouchableOpacity
                              style={{ marginLeft: 8 }}
                              onPress={() => handleRemoveMember(m.user_id, name)}
                            >
                              <Text style={{ color: '#f87171', fontSize: 12 }}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                {/* Settlements tab */}
                {detailTab === 'settlements' && (
                  <>
                    {poolSettlements.length === 0 ? (
                      <Text style={styles.emptyText}>No settlements yet.</Text>
                    ) : (
                      poolSettlements.map((s) => (
                        <View key={s.id} style={local.settlementCard}>
                          <Text style={local.settlementDate}>
                            {new Date(s.settled_at).toLocaleDateString()}
                          </Text>
                          <Text style={local.settlementMeta}>
                            {s.expense_ids.length} expenses settled
                          </Text>
                          {(s.transfers as any[]).map((t: any, i: number) => (
                            <Text key={i} style={local.transferLine}>
                              {getMemberName(t.from)} → {getMemberName(t.to)}: {selectedPool.currency} {Number(t.amount).toFixed(2)}
                            </Text>
                          ))}
                          {s.note ? <Text style={local.settlementNote}>{s.note}</Text> : null}
                        </View>
                      ))
                    )}
                  </>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={() => setView('list')}>
                  <Text style={styles.modalSecondaryText}>Back</Text>
                </TouchableOpacity>
                {selectedPool.status === 'active' && (
                  <>
                    <TouchableOpacity
                      style={[styles.modalPrimary, { backgroundColor: '#214264', marginRight: 6 }]}
                      onPress={openAddExpense}
                    >
                      <Text style={styles.modalPrimaryText}>Add Expense</Text>
                    </TouchableOpacity>
                    {selectedPool.myRole === 'owner' && selectedPool.unsettledExpenseCount > 0 && (
                      <TouchableOpacity style={styles.modalPrimary} onPress={openSettlement}>
                        <Text style={styles.modalPrimaryText}>Settle</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* ── ADD EXPENSE VIEW ──────────────────────────── */}
          {view === 'addExpense' && selectedPool && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <TouchableOpacity onPress={() => setView('detail')} style={{ marginRight: 8 }}>
                  <Text style={{ color: '#8FA8C9', fontSize: 18 }}>◂</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Add Expense</Text>
              </View>

              <Text style={styles.modalLabel}>Amount ({selectedPool.currency})</Text>
              <TextInput
                value={expAmount}
                onChangeText={setExpAmount}
                placeholder="0.00"
                placeholderTextColor="#64748B"
                style={styles.input}
                keyboardType="decimal-pad"
              />

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                value={expDesc}
                onChangeText={setExpDesc}
                placeholder="What was it for?"
                placeholderTextColor="#64748B"
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Date</Text>
              <TextInput
                value={expDate}
                onChangeText={setExpDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748B"
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Paid by</Text>
              <View style={[styles.modalChipsRow, { marginBottom: 10, flexWrap: 'wrap' }]}>
                {selectedPool.members.map((m) => (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[styles.modalChip, (expPaidBy ?? selectedPool.members.find((x) => x.role === 'owner')?.user_id) === m.user_id && styles.modalChipActive]}
                    onPress={() => setExpPaidBy(m.user_id)}
                  >
                    <Text style={styles.modalChipText}>{getName(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Split among</Text>
              <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                {selectedPool.members.map((m) => {
                  const selected = expSplitAmong.includes(m.user_id);
                  return (
                    <TouchableOpacity
                      key={m.user_id}
                      style={[local.memberRow, selected && local.memberRowActive]}
                      onPress={() => {
                        setExpSplitAmong((prev) =>
                          selected ? prev.filter((id) => id !== m.user_id) : [...prev, m.user_id],
                        );
                      }}
                    >
                      <Text style={local.checkmark}>{selected ? '☑' : '☐'}</Text>
                      <Text style={local.memberName}>{getName(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={() => setView('detail')}>
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimary}
                  onPress={() => void handleAddExpense()}
                  disabled={saving || !expAmount || !expDesc.trim() || expSplitAmong.length === 0}
                >
                  <Text style={styles.modalPrimaryText}>{saving ? 'Saving…' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── SETTLEMENT PREVIEW VIEW ───────────────────── */}
          {view === 'settlement' && selectedPool && settlementPreview && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <TouchableOpacity onPress={() => setView('detail')} style={{ marginRight: 8 }}>
                  <Text style={{ color: '#8FA8C9', fontSize: 18 }}>◂</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Settlement Preview</Text>
              </View>

              {selectedPool.type === 'event' && (
                <Text style={local.warningText}>
                  This will close the pool. No more expenses can be added.
                </Text>
              )}
              {selectedPool.type === 'continuous' && (
                <Text style={local.infoText}>
                  The pool will remain active after settlement.
                </Text>
              )}

              <Text style={[styles.modalLabel, { marginTop: 8 }]}>Balances</Text>
              {Object.entries(settlementPreview.balances).map(([uid, bal]) => (
                <View key={uid} style={local.balanceRow}>
                  <Text style={local.balanceName}>{getMemberName(uid)}</Text>
                  <Text
                    style={[
                      local.balanceAmount,
                      bal > 0 && { color: '#4ade80' },
                      bal < 0 && { color: '#f87171' },
                    ]}
                  >
                    {bal >= 0 ? '+' : ''}{bal.toFixed(2)}
                  </Text>
                </View>
              ))}

              <Text style={[styles.modalLabel, { marginTop: 10 }]}>
                Transfers ({settlementPreview.transfers.length})
              </Text>
              {settlementPreview.transfers.length === 0 ? (
                <Text style={styles.emptyText}>Everyone is even!</Text>
              ) : (
                settlementPreview.transfers.map((t, i) => (
                  <View key={i} style={local.transferRow}>
                    <Text style={local.transferText}>
                      {getMemberName(t.from)} → {getMemberName(t.to)}
                    </Text>
                    <Text style={local.transferAmount}>
                      {formatAmount(t.amount, selectedPool.currency)}
                    </Text>
                  </View>
                ))
              )}

              <Text style={[styles.modalLabel, { marginTop: 10 }]}>Note (optional)</Text>
              <TextInput
                value={settlementNote}
                onChangeText={setSettlementNote}
                placeholder="Add a note"
                placeholderTextColor="#64748B"
                style={styles.input}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondary} onPress={() => setView('detail')}>
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimary}
                  onPress={() => void handleCommitSettlement()}
                  disabled={saving}
                >
                  <Text style={styles.modalPrimaryText}>
                    {saving ? 'Settling…' : 'Confirm Settlement'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Local styles                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

const local = StyleSheet.create({
  poolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginBottom: 4,
  },
  poolName: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '700',
  },
  poolMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  poolMetaText: {
    color: '#8FA8C9',
    fontSize: 12,
  },
  poolBadge: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1E3552',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  poolBadgeSettled: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  unsettledBadge: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 2,
  },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  debtText: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  debtAmount: {
    color: '#DCEBFF',
    fontSize: 14,
    fontWeight: '700',
  },
  debtPoolName: {
    color: '#64748B',
    fontSize: 11,
  },
  statusBadge: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  debtAction: {
    borderColor: '#60a5fa',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  debtActionText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E3552',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#8FA8C9',
    fontSize: 14,
    fontWeight: '700',
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  memberRowActive: {
    backgroundColor: '#142235',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 2,
  },
  memberName: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  memberRole: {
    color: '#64748B',
    fontSize: 11,
  },
  memberBalance: {
    color: '#8FA8C9',
    fontSize: 14,
    fontWeight: '700',
  },
  checkmark: {
    color: '#53E3A6',
    fontSize: 16,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 2,
  },
  expenseDesc: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  expenseMeta: {
    color: '#8FA8C9',
    fontSize: 11,
  },
  expenseSplit: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  expenseAmount: {
    color: '#DCEBFF',
    fontSize: 14,
    fontWeight: '700',
  },
  settlementCard: {
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  settlementDate: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '700',
  },
  settlementMeta: {
    color: '#8FA8C9',
    fontSize: 11,
    marginBottom: 4,
  },
  settlementNote: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  transferLine: {
    color: '#DCEBFF',
    fontSize: 12,
    marginVertical: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  balanceName: {
    color: '#EAF3FF',
    fontSize: 13,
  },
  balanceAmount: {
    color: '#8FA8C9',
    fontSize: 13,
    fontWeight: '700',
  },
  transferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 2,
  },
  transferText: {
    color: '#EAF3FF',
    fontSize: 13,
  },
  transferAmount: {
    color: '#DCEBFF',
    fontSize: 14,
    fontWeight: '700',
  },
  warningText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  infoText: {
    color: '#60a5fa',
    fontSize: 12,
    marginBottom: 4,
  },
});

export default React.memo(PoolListModal);
