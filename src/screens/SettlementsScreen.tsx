import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePools } from '../hooks/usePools';
import { usePoolTransactions } from '../hooks/usePoolTransactions';
import { useDebts } from '../hooks/useDebts';
import Icon from '../components/Icon';
import type { Pool, PoolMember, AppDebt, PreTransaction } from '../types/pools';
import { uiPath, uiProps, logUI } from '../lib/devtools';

export default function SettlementsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const {
    pools, members, loading: poolsLoading,
    getUserPools, loadPoolMembers,
  } = usePools(user);
  const {
    transactions, loading: txLoading,
    getPoolTransactions,
  } = usePoolTransactions(user);
  const {
    debts, loading: debtsLoading,
    getUserDebts, computePoolSettlement, commitPoolSettlement, confirmDebt, markPaid,
  } = useDebts(user);

  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [preTransactions, setPreTransactions] = useState<PreTransaction[]>([]);
  const [computing, setComputing] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    void getUserPools();
    void getUserDebts();
  }, [getUserPools, getUserDebts]);

  useEffect(() => {
    logUI(uiPath('settlements', 'scroll_view', 'root'), 'mounted');
  }, []);

  const openPool = useCallback((pool: Pool) => {
    setSelectedPool(pool);
    setPreTransactions([]);
    void getPoolTransactions(pool.id);
    void loadPoolMembers(pool.id);
  }, [getPoolTransactions, loadPoolMembers]);

  const closePool = useCallback(() => {
    setSelectedPool(null);
    setPreTransactions([]);
  }, []);

  const handleCalculate = useCallback(async () => {
    if (!selectedPool) return;
    setComputing(true);
    try {
      const preTxs = await computePoolSettlement(selectedPool.id);
      if (preTxs.length === 0) {
        Alert.alert('All settled', 'Everyone paid their fair share — no transfers needed.');
        return;
      }
      setPreTransactions(preTxs);
    } catch (err) {
      Alert.alert('Cannot calculate', err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setComputing(false);
    }
  }, [computePoolSettlement, selectedPool]);

  const handleCommit = useCallback(async () => {
    if (!selectedPool || preTransactions.length === 0) return;
    Alert.alert(
      'Commit settlement',
      `Create ${preTransactions.length} debt(s) and close "${selectedPool.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Commit',
          onPress: async () => {
            setCommitting(true);
            try {
              await commitPoolSettlement(selectedPool.id, preTransactions);
              await getUserPools();
              Alert.alert('Settled', `${preTransactions.length} debt(s) created.`);
              setSelectedPool(null);
              setPreTransactions([]);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Commit failed');
            } finally {
              setCommitting(false);
            }
          },
        },
      ],
    );
  }, [commitPoolSettlement, getUserPools, preTransactions, selectedPool]);

  const handleDiscard = useCallback(() => {
    setPreTransactions([]);
  }, []);

  // Pool totals
  const poolTotal = useMemo(
    () => transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions],
  );
  const poolMembers: PoolMember[] = selectedPool ? (members[selectedPool.id] ?? []) : [];
  const memberCount = poolMembers.length || 1;
  const perPerson = poolTotal / memberCount;

  // Resolve a user_id or participant_id to a display name using the loaded pool members
  const nameFor = useCallback((id: string) => {
    if (id === user?.id) return 'You';
    // Match by auth user_id first, then by participant id
    const m = poolMembers.find((pm) => pm.user_id === id || pm.id === id);
    return m?.display_name ?? id.slice(0, 8) + '…';
  }, [poolMembers, user?.id]);

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
      <View style={s.header} {...uiProps(uiPath('settlements', 'header', 'container'))}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.iconBtn}
          {...uiProps(uiPath('settlements', 'header', 'back_button'))}
        >
          <Icon name="ArrowLeft" size={20} color="#EAF3FF" />
        </TouchableOpacity>
        <Text style={s.headerTitle} {...uiProps(uiPath('settlements', 'header', 'title'))}>Settlements</Text>
        <TouchableOpacity
          onPress={() => { void getUserPools(); void getUserDebts(); }}
          style={s.iconBtn}
          {...uiProps(uiPath('settlements', 'header', 'refresh_button'))}
        >
          <Icon name="RefreshCw" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        {...uiProps(uiPath('settlements', 'scroll_view', 'root'))}
      >

        {/* ═══════════════ POOL LIST (read-only) ═══════════════ */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle} {...uiProps(uiPath('settlements', 'section_title', 'pools'))}>Pools</Text>
          <Text style={s.sectionHint}>Manage in Pool tab</Text>
        </View>

        {poolsLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 12 }} />}

        {!poolsLoading && pools.length === 0 && (
          <View style={s.emptyContainer} {...uiProps(uiPath('settlements', 'empty_state', 'container'))}>
            <Icon name="Users" size={32} color="#1F3A59" />
            <Text style={s.emptyText}>No pools yet</Text>
            <Text style={s.emptyHint}>Create a pool in the Pool tab to start splitting expenses</Text>
          </View>
        )}

        {pools.map((pool) => (
          <TouchableOpacity
            key={pool.id}
            style={[s.poolCard, selectedPool?.id === pool.id && s.poolCardActive]}
            onPress={() => {
              logUI(uiPath('settlements', 'pool_card', 'container', pool.id), 'press');
              openPool(pool);
            }}
            {...uiProps(uiPath('settlements', 'pool_card', 'container', pool.id))}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={[s.poolIcon, pool.status === 'closed' && { opacity: 0.4 }]}
                {...uiProps(uiPath('settlements', 'pool_card', 'icon', pool.id))}
              >
                <Icon name={pool.type === 'event' ? 'CalendarDays' : 'Repeat'} size={18} color="#53E3A6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.poolName, pool.status === 'closed' && { color: '#475569' }]}
                  {...uiProps(uiPath('settlements', 'pool_card', 'name', pool.id))}
                >
                  {pool.name}
                </Text>
                <Text style={s.poolMeta} {...uiProps(uiPath('settlements', 'pool_card', 'meta', pool.id))}>
                  {pool.type === 'event' ? 'Event' : 'Continuous'}
                  {pool.status === 'closed' ? ' · Closed' : ' · Active'}
                </Text>
              </View>
              <Icon name="ChevronRight" size={16} color="#475569" />
            </View>
          </TouchableOpacity>
        ))}

        {/* ═══════════════ POOL DETAIL (read-only) ═══════════════ */}
        {selectedPool && (
          <>
            <View style={s.divider} />

            <View style={s.sectionHeader} {...uiProps(uiPath('settlements', 'pool_detail', 'header'))}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>{selectedPool.name}</Text>
                <Text style={s.poolDetailSub}>
                  {selectedPool.type === 'event' ? 'Event' : 'Continuous'} · {selectedPool.status}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  logUI(uiPath('settlements', 'pool_detail', 'close_button'), 'press');
                  closePool();
                }}
                style={s.iconBtn}
                {...uiProps(uiPath('settlements', 'pool_detail', 'close_button'))}
              >
                <Icon name="X" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Summary (read-only) */}
            <View style={s.summaryCard} {...uiProps(uiPath('settlements', 'summary_card', 'container'))}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel} {...uiProps(uiPath('settlements', 'summary_card', 'total_label'))}>Total</Text>
                <Text style={s.summaryValue} {...uiProps(uiPath('settlements', 'summary_card', 'total_value'))}>{poolTotal.toFixed(2)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel} {...uiProps(uiPath('settlements', 'summary_card', 'members_label'))}>Members</Text>
                <Text style={s.summaryValue} {...uiProps(uiPath('settlements', 'summary_card', 'members_value'))}>{memberCount}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel} {...uiProps(uiPath('settlements', 'summary_card', 'per_person_label'))}>Per person</Text>
                <Text style={s.summaryValue} {...uiProps(uiPath('settlements', 'summary_card', 'per_person_value'))}>{perPerson.toFixed(2)}</Text>
              </View>
            </View>

            {/* Member chips (read-only) */}
            {poolMembers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {poolMembers.map((m) => (
                  <View key={m.id} style={[s.chip, !m.user_id && s.chipExternal]}>
                    <Text style={s.chipText}>
                      {m.user_id === user.id ? 'You' : (m.display_name ?? m.id.slice(0, 8))}
                    </Text>
                    {!m.user_id && <Text style={s.chipExt}> ext</Text>}
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Transactions (read-only) */}
            <Text style={s.subSectionTitle} {...uiProps(uiPath('settlements', 'sub_section_title', 'transactions'))}>Transactions</Text>
            {txLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 8 }} />}
            {!txLoading && transactions.length === 0 && (
              <Text style={s.emptyTextSmall}>No transactions in this pool</Text>
            )}
            {transactions.map((tx) => (
              <View key={tx.id} style={s.txRow} {...uiProps(uiPath('settlements', 'tx_row', 'container', tx.id))}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDescription}>{tx.description || 'Expense'}</Text>
                  <Text style={s.txDate}>{tx.date}</Text>
                </View>
                <Text style={s.txAmount}>{Number(tx.amount).toFixed(2)}</Text>
              </View>
            ))}

            {/* ─── Settlement calculation ─── */}
            {selectedPool.status === 'active' && preTransactions.length === 0 && (
              <TouchableOpacity
                style={s.calcButton}
                onPress={() => {
                  logUI(uiPath('settlements', 'action_button', 'calculate'), 'press');
                  void handleCalculate();
                }}
                disabled={computing}
                {...uiProps(uiPath('settlements', 'action_button', 'calculate'))}
              >
                {computing
                  ? <ActivityIndicator color="#060A14" size="small" />
                  : <Icon name="Calculator" size={16} color="#060A14" />
                }
                <Text style={s.calcButtonText}>
                  {computing ? 'Calculating…' : 'Calculate Settlement'}
                </Text>
              </TouchableOpacity>
            )}

            {/* ─── Pre-transaction preview ─── */}
            {preTransactions.length > 0 && (
              <>
                <View style={s.preTxHeader} {...uiProps(uiPath('settlements', 'pre_tx_header', 'container'))}>
                  <Icon name="ArrowRightLeft" size={14} color="#53E3A6" />
                  <Text style={s.preTxHeaderText}>
                    Settlement preview — {preTransactions.length} transfer{preTransactions.length > 1 ? 's' : ''}
                  </Text>
                </View>

                {preTransactions.map((ptx, i) => (
                  <View key={i} style={s.preTxRow} {...uiProps(uiPath('settlements', 'pre_tx_row', 'container', i))}>
                    <Text style={s.preTxFrom} {...uiProps(uiPath('settlements', 'pre_tx_row', 'from', i))}>{nameFor(ptx.fromParticipantId)}</Text>
                    <Icon name="ArrowRight" size={14} color="#64748B" />
                    <Text style={s.preTxTo} {...uiProps(uiPath('settlements', 'pre_tx_row', 'to', i))}>{nameFor(ptx.toParticipantId)}</Text>
                    <Text style={s.preTxAmount} {...uiProps(uiPath('settlements', 'pre_tx_row', 'amount', i))}>{ptx.amount.toFixed(2)}</Text>
                  </View>
                ))}

                <View style={s.preTxActions}>
                  <TouchableOpacity
                    style={s.discardButton}
                    onPress={() => {
                      logUI(uiPath('settlements', 'action_button', 'discard'), 'press');
                      handleDiscard();
                    }}
                    {...uiProps(uiPath('settlements', 'action_button', 'discard'))}
                  >
                    <Icon name="X" size={14} color="#f87171" />
                    <Text style={s.discardButtonText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.commitButton}
                    onPress={() => {
                      logUI(uiPath('settlements', 'action_button', 'commit'), 'press');
                      void handleCommit();
                    }}
                    disabled={committing}
                    {...uiProps(uiPath('settlements', 'action_button', 'commit'))}
                  >
                    {committing
                      ? <ActivityIndicator color="#060A14" size="small" />
                      : <Icon name="Check" size={14} color="#060A14" />
                    }
                    <Text style={s.commitButtonText}>
                      {committing ? 'Committing…' : 'Commit & close pool'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.preTxHint}>
                  Committing will create {preTransactions.length} pending debt{preTransactions.length > 1 ? 's' : ''} and close the pool.
                </Text>
              </>
            )}
          </>
        )}

        {/* ═══════════════ DEBTS ═══════════════ */}
        <View style={s.divider} />
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle} {...uiProps(uiPath('settlements', 'section_title', 'debts'))}>Debts</Text>
        </View>

        {/* Net balance */}
        <View style={s.balanceCard} {...uiProps(uiPath('settlements', 'balance_card', 'container'))}>
          <Text style={s.balanceLabel} {...uiProps(uiPath('settlements', 'balance_card', 'label'))}>Net balance</Text>
          <Text
            style={[s.balanceValue, { color: netBalance >= 0 ? '#4ade80' : '#f87171' }]}
            {...uiProps(uiPath('settlements', 'balance_card', 'value'))}
          >
            {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}
          </Text>
          <Text style={s.balanceHint} {...uiProps(uiPath('settlements', 'balance_card', 'hint'))}>
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
            <Text style={s.subSectionTitle} {...uiProps(uiPath('settlements', 'sub_section_title', 'pending'))}>Pending ({pendingDebts.length})</Text>
            {pendingDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onMarkPaid={markPaid} />
            ))}
          </>
        )}

        {confirmedDebts.length > 0 && (
          <>
            <Text style={s.subSectionTitle} {...uiProps(uiPath('settlements', 'sub_section_title', 'confirmed'))}>Confirmed ({confirmedDebts.length})</Text>
            {confirmedDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onMarkPaid={markPaid} />
            ))}
          </>
        )}

        {paidDebts.length > 0 && (
          <>
            <Text style={s.subSectionTitle} {...uiProps(uiPath('settlements', 'sub_section_title', 'paid'))}>Paid ({paidDebts.length})</Text>
            {paidDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onMarkPaid={markPaid} />
            ))}
          </>
        )}

      </ScrollView>
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
  // Prefer participant name from settlement, fall back to truncated UUID
  const otherName = iOwe
    ? (debt.to_participant_name ?? otherUserId.slice(0, 8))
    : (debt.from_participant_name ?? otherUserId.slice(0, 8));

  const statusColor =
    debt.status === 'paid' ? '#4ade80' :
    debt.status === 'confirmed' ? '#53E3A6' :
    '#f59e0b';

  return (
    <View style={s.debtRow} {...uiProps(uiPath('settlements', 'debt_row', 'container', debt.id))}>
      <View style={s.debtIcon} {...uiProps(uiPath('settlements', 'debt_row', 'icon', debt.id))}>
        <Icon
          name={iOwe ? 'ArrowUpRight' : 'ArrowDownLeft'}
          size={18}
          color={iOwe ? '#f87171' : '#4ade80'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.debtText} {...uiProps(uiPath('settlements', 'debt_row', 'text', debt.id))}>
          {iOwe ? `You owe ${otherName}` : `${otherName} owes you`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <View
            style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}
            {...uiProps(uiPath('settlements', 'debt_row', 'status_badge', debt.id))}
          >
            <Text style={[s.statusText, { color: statusColor }]}>{debt.status}</Text>
          </View>
          {debt.pool_id && <Text style={s.debtMeta}>pool</Text>}
          {myConfirmed && <Text style={s.debtMeta}>you confirmed</Text>}
          {otherConfirmed && <Text style={s.debtMeta}>they confirmed</Text>}
        </View>
      </View>
      <Text
        style={[s.debtAmount, { color: iOwe ? '#f87171' : '#4ade80' }]}
        {...uiProps(uiPath('settlements', 'debt_row', 'amount', debt.id))}
      >
        {iOwe ? '-' : '+'}{Number(debt.amount).toFixed(2)}
      </Text>
      <View style={s.debtActions}>
        {debt.status === 'pending' && !myConfirmed && (
          <TouchableOpacity
            style={s.confirmBtn}
            onPress={() => {
              logUI(uiPath('settlements', 'debt_row', 'confirm_button', debt.id), 'press');
              onConfirm(debt.id);
            }}
            {...uiProps(uiPath('settlements', 'debt_row', 'confirm_button', debt.id))}
          >
            <Icon name="Check" size={14} color="#060A14" />
          </TouchableOpacity>
        )}
        {debt.status === 'confirmed' && (
          <TouchableOpacity
            style={s.paidBtn}
            onPress={() => {
              logUI(uiPath('settlements', 'debt_row', 'paid_button', debt.id), 'press');
              onMarkPaid(debt.id);
            }}
            {...uiProps(uiPath('settlements', 'debt_row', 'paid_button', debt.id))}
          >
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
  iconBtn: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    color: '#EAF3FF',
    fontSize: 18,
    fontWeight: '700',
  },

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
  sectionHint: {
    color: '#334155',
    fontSize: 11,
    fontStyle: 'italic',
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
  poolCardActive: {
    borderColor: '#53E3A6',
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

  // Empty states
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

  // Summary
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

  // Member chips
  chipsRow: {
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F3A59',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipExternal: {
    backgroundColor: '#2D1A40',
  },
  chipText: {
    color: '#EAF3FF',
    fontSize: 12,
    fontWeight: '500',
  },
  chipExt: {
    color: '#a855f7',
    fontSize: 10,
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

  // Calculate button
  calcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#53E3A6',
    borderRadius: 10,
    paddingVertical: 12,
  },
  calcButtonText: {
    color: '#060A14',
    fontSize: 14,
    fontWeight: '600',
  },

  // Pre-transaction preview
  preTxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  preTxHeaderText: {
    color: '#53E3A6',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  preTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#101A2A',
  },
  preTxFrom: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  preTxTo: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  preTxAmount: {
    color: '#EAF3FF',
    fontSize: 14,
    fontWeight: '700',
  },
  preTxActions: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
  },
  discardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#f8717133',
  },
  discardButtonText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  commitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#53E3A6',
    borderRadius: 10,
    paddingVertical: 11,
  },
  commitButtonText: {
    color: '#060A14',
    fontSize: 13,
    fontWeight: '600',
  },
  preTxHint: {
    color: '#334155',
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 16,
    marginTop: 8,
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
});
