import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { usePools } from '../../hooks/usePools';
import { usePoolTransactions } from '../../hooks/usePoolTransactions';
import { useDebts } from '../../hooks/useDebts';
import Icon from '../Icon';
import ContextBar from '../dashboard/layout/ContextBar';
import DebtListSection from './DebtListSection';
import type { Pool, PoolMember, AppDebt, PreTransaction } from '../../types/pools';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

export default function SettlementsSection() {
  const { user } = useAuth();
  const { navigation, setActiveSection, reloadKey } = useDashboard();

  const { pools, members, loading: poolsLoading, getUserPools, loadPoolMembers } = usePools(user);
  const { transactions, loading: txLoading, getPoolTransactions } = usePoolTransactions(user);
  const { debts, loading: debtsLoading, getUserDebts, computePoolSettlement, commitPoolSettlement, confirmDebt, markRecorded, archiveDebt, deleteDebt } = useDebts(user);

  const [debtsOpen, setDebtsOpen] = useState(false);
  const [poolsOpen, setPoolsOpen] = useState(true);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [poolPreTxs, setPoolPreTxs] = useState<Record<string, PreTransaction[]>>({});
  const [poolCalculating, setPoolCalculating] = useState<Record<string, boolean>>({});
  const [poolCommitting, setPoolCommitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void getUserPools();
    void getUserDebts();
  }, [getUserPools, getUserDebts]);

  useEffect(() => {
    if (reloadKey === 0) return;
    void getUserPools();
    void getUserDebts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const expandPool = useCallback(async (pool: Pool) => {
    const isOpening = expandedPoolId !== pool.id;
    setExpandedPoolId(isOpening ? pool.id : null);
    if (!isOpening) return;
    void getPoolTransactions(pool.id);
    void loadPoolMembers(pool.id);
    if (pool.status === 'active') {
      setPoolCalculating((prev) => ({ ...prev, [pool.id]: true }));
      try {
        const preTxs = await computePoolSettlement(pool.id);
        setPoolPreTxs((prev) => ({ ...prev, [pool.id]: preTxs }));
      } catch {
        setPoolPreTxs((prev) => ({ ...prev, [pool.id]: [] }));
      } finally {
        setPoolCalculating((prev) => ({ ...prev, [pool.id]: false }));
      }
    }
  }, [computePoolSettlement, expandedPoolId, getPoolTransactions, loadPoolMembers]);

  const handleCommit = useCallback(async (pool: Pool) => {
    const preTxs = poolPreTxs[pool.id] ?? [];
    if (preTxs.length === 0) return;
    setPoolCommitting((prev) => ({ ...prev, [pool.id]: true }));
    try {
      await commitPoolSettlement(pool.id, preTxs);
      await getUserPools();
      await getUserDebts();
      setExpandedPoolId(null);
      setPoolPreTxs((prev) => ({ ...prev, [pool.id]: [] }));
    } finally {
      setPoolCommitting((prev) => ({ ...prev, [pool.id]: false }));
    }
  }, [commitPoolSettlement, getUserDebts, getUserPools, poolPreTxs]);

  const convertToTransaction = useCallback(async (debt: AppDebt) => {
    await markRecorded(debt.id);
    const iOwe = debt.from_user === user?.id;
    const otherName = iOwe
      ? (debt.to_participant_name ?? 'counterpart')
      : (debt.from_participant_name ?? 'counterpart');
    setActiveSection(null);
    navigation.navigate('Dashboard' as never, {
      prefillEntry: {
        type: iOwe ? 'expense' : 'income',
        amount: Number(debt.amount),
        note: iOwe ? `Settlement to ${otherName}` : `Settlement from ${otherName}`,
        _key: debt.id,
      },
    } as never);
  }, [markRecorded, navigation, setActiveSection, user?.id]);

  const netBalance = useMemo(() => {
    if (!user) return 0;
    return debts
      .filter((d) => d.status === 'pending' || d.status === 'confirmed')
      .reduce((sum, d) => {
        if (d.to_user === user.id) return sum + Number(d.amount);
        if (d.from_user === user.id) return sum - Number(d.amount);
        return sum;
      }, 0);
  }, [debts, user]);

  const poolTotal = useMemo(() => transactions.reduce((sum, tx) => sum + Number(tx.amount), 0), [transactions]);

  const resolveName = (id: string, mems: PoolMember[], fallback: string) => {
    if (id === user?.id) return 'You';
    const m = mems.find((pm) => pm.user_id === id || pm.id === id);
    return m?.display_name ?? fallback;
  };

  if (!user) return null;

  return (
    <View style={s.container}>
      <ContextBar label="Settlements" onDismiss={() => setActiveSection(null)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}
        {...uiProps(uiPath('settlements', 'scroll_view', 'root'))}>

        {/* ═══ DEBTS ═══ */}
        <TouchableOpacity style={s.sectionHeader} onPress={() => setDebtsOpen((o) => !o)}
          {...uiProps(uiPath('settlements', 'section_title', 'debts'))}>
          <Text style={s.sectionTitle}>Debts</Text>
          {netBalance !== 0 && (
            <Text style={[s.sectionBadge, { color: netBalance >= 0 ? '#4ade80' : '#f87171' }]}>
              {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}
            </Text>
          )}
          <Icon name={debtsOpen ? 'ChevronUp' : 'ChevronDown'} size={16} color="#64748B" />
        </TouchableOpacity>

        {debtsOpen && (
          <>
            <View style={s.balanceCard} {...uiProps(uiPath('settlements', 'balance_card', 'container'))}>
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

            <DebtListSection
              debts={debts}
              userId={user.id}
              onConfirm={confirmDebt}
              onConvert={convertToTransaction}
              onArchive={archiveDebt}
              onDelete={deleteDebt}
              screen="settlements"
            />
          </>
        )}

        <View style={s.divider} />

        {/* ═══ POOLS ═══ */}
        <TouchableOpacity style={s.sectionHeader} onPress={() => setPoolsOpen((o) => !o)}
          {...uiProps(uiPath('settlements', 'section_title', 'pools'))}>
          <Text style={s.sectionTitle}>Pools</Text>
          <Icon name={poolsOpen ? 'ChevronUp' : 'ChevronDown'} size={16} color="#64748B" />
        </TouchableOpacity>

        {poolsOpen && (
          <>
            {poolsLoading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 12 }} />}

            {!poolsLoading && pools.length === 0 && (
              <View style={s.emptyContainer}>
                <Icon name="Users" size={32} color="#1F3A59" />
                <Text style={s.emptyText}>No pools yet</Text>
                <Text style={s.emptyHint}>Create a pool in the Pool tab to start splitting expenses</Text>
              </View>
            )}

            {pools.map((pool) => {
              const isExpanded = expandedPoolId === pool.id;
              const preTxs = poolPreTxs[pool.id] ?? [];
              const calculating = poolCalculating[pool.id] ?? false;
              const committing = poolCommitting[pool.id] ?? false;
              const poolMems: PoolMember[] = members[pool.id] ?? [];
              const mCount = poolMems.length || 1;
              const perPerson = poolTotal / mCount;
              const isCreator = pool.created_by === user.id;
              const poolDebts = debts.filter((d) => d.pool_id === pool.id);
              const authMems = poolMems.filter((m) => m.user_id);
              const committedCount = authMems.filter((m) => {
                const involvedDebts = poolDebts.filter((d) => d.from_user === m.user_id || d.to_user === m.user_id);
                if (involvedDebts.length === 0) return true;
                return involvedDebts.every((d) => d.from_user === m.user_id ? d.from_confirmed : d.to_confirmed);
              }).length;
              const allCommitted = authMems.length > 0 && committedCount >= authMems.length;

              return (
                <View key={pool.id}>
                  <TouchableOpacity style={[s.poolCard, isExpanded && s.poolCardActive]}
                    onPress={() => { logUI(uiPath('settlements', 'pool_card', 'container', pool.id), 'press'); void expandPool(pool); }}
                    {...uiProps(uiPath('settlements', 'pool_card', 'container', pool.id))}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[s.poolIcon, pool.status === 'closed' && { opacity: 0.4 }]}>
                        <Icon name={pool.type === 'event' ? 'CalendarDays' : 'Repeat'} size={18} color="#53E3A6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.poolName, pool.status === 'closed' && { color: '#475569' }]}>{pool.name}</Text>
                        <Text style={s.poolMeta}>
                          {pool.type === 'event' ? 'Event' : 'Continuous'}
                          {pool.status === 'closed' ? ' · Closed' : ' · Active'}
                        </Text>
                      </View>
                      <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} color="#475569" />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.poolDetail} {...uiProps(uiPath('settlements', 'pool_detail', 'header'))}>
                      <View style={s.summaryCard}>
                        <View style={s.summaryRow}><Text style={s.summaryLabel}>Total</Text><Text style={s.summaryValue}>{txLoading ? '…' : poolTotal.toFixed(2)}</Text></View>
                        <View style={s.summaryRow}><Text style={s.summaryLabel}>Members</Text><Text style={s.summaryValue}>{poolMems.length}</Text></View>
                        <View style={s.summaryRow}><Text style={s.summaryLabel}>Per person</Text><Text style={s.summaryValue}>{txLoading ? '…' : perPerson.toFixed(2)}</Text></View>
                      </View>

                      {poolMems.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}
                          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                          {poolMems.map((m) => (
                            <View key={m.id} style={[s.chip, !m.user_id && s.chipExternal]}>
                              <Text style={s.chipText}>{m.user_id === user.id ? 'You' : (m.display_name ?? m.id.slice(0, 8))}</Text>
                              {!m.user_id && <Text style={s.chipExt}> ext</Text>}
                            </View>
                          ))}
                        </ScrollView>
                      )}

                      {pool.status === 'active' && (
                        <View style={{ marginTop: 14 }}>
                          {calculating && (
                            <View style={s.calcRow}>
                              <ActivityIndicator color="#53E3A6" size="small" />
                              <Text style={s.calcHint}>Calculating settlement…</Text>
                            </View>
                          )}
                          {!calculating && preTxs.length === 0 && (
                            <Text style={s.balancedText}>Everyone paid their fair share — no transfers needed.</Text>
                          )}
                          {!calculating && preTxs.length > 0 && (
                            <>
                              <View style={s.preTxHeader}>
                                <Icon name="ArrowRightLeft" size={14} color="#53E3A6" />
                                <Text style={s.preTxHeaderText}>{preTxs.length} transfer{preTxs.length > 1 ? 's' : ''} needed</Text>
                              </View>
                              {preTxs.map((ptx, i) => (
                                <View key={i} style={s.preTxRow} {...uiProps(uiPath('settlements', 'pre_tx_row', 'container', i))}>
                                  <Text style={s.preTxFrom} numberOfLines={1}>{resolveName(ptx.fromParticipantId, poolMems, ptx.metadata.fromParticipantName ?? '?')}</Text>
                                  <Icon name="ArrowRight" size={14} color="#64748B" />
                                  <Text style={s.preTxTo} numberOfLines={1}>{resolveName(ptx.toParticipantId, poolMems, ptx.metadata.toParticipantName ?? '?')}</Text>
                                  <Text style={s.preTxAmount}>{ptx.amount.toFixed(2)}</Text>
                                </View>
                              ))}
                              {isCreator && (
                                <TouchableOpacity style={s.commitButton} onPress={() => void handleCommit(pool)}
                                  disabled={committing} {...uiProps(uiPath('settlements', 'action_button', 'commit'))}>
                                  {committing ? <ActivityIndicator color="#060A14" size="small" /> : <Icon name="Check" size={14} color="#060A14" />}
                                  <Text style={s.commitButtonText}>{committing ? 'Committing…' : 'Commit & close pool'}</Text>
                                </TouchableOpacity>
                              )}
                              <Text style={s.preTxHint}>
                                {isCreator ? `Committing creates ${preTxs.length} pending debt${preTxs.length > 1 ? 's' : ''} and closes the pool.` : 'Only the pool creator can commit the settlement.'}
                              </Text>
                            </>
                          )}
                        </View>
                      )}

                      {pool.status === 'closed' && (
                        <View style={{ marginTop: 14 }}>
                          <View style={s.committedBanner}>
                            <Icon name={allCommitted ? 'CheckCircle' : 'Clock'} size={16} color={allCommitted ? '#53E3A6' : '#f59e0b'} />
                            <Text style={[s.committedText, { color: allCommitted ? '#53E3A6' : '#f59e0b' }]}>
                              {allCommitted ? 'All members committed — ready to record' : `Settlement committed by ${committedCount}/${authMems.length}`}
                            </Text>
                          </View>
                          {poolDebts.length > 0 && (
                            <>
                              <Text style={s.poolDebtLabel}>Settlement debts</Text>
                              <DebtListSection
                                debts={poolDebts}
                                userId={user.id}
                                onConfirm={confirmDebt}
                                onConvert={convertToTransaction}
                                onArchive={archiveDebt}
                                onDelete={deleteDebt}
                                screen="settlements"
                              />
                            </>
                          )}
                          {poolDebts.length === 0 && <Text style={s.balancedText}>No settlement debts visible for this pool.</Text>}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A14' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 20, marginBottom: 6, gap: 8 },
  sectionTitle: { flex: 1, color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionBadge: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1F3A59', marginHorizontal: 16, marginTop: 20 },
  balanceCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#0E1A2B', borderRadius: 12, borderWidth: 1, borderColor: '#1F3A59', padding: 16, alignItems: 'center', gap: 4 },
  balanceLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { fontSize: 28, fontWeight: '700' },
  balanceHint: { color: '#475569', fontSize: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 24, gap: 6 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 },
  emptyHint: { color: '#475569', fontSize: 12, textAlign: 'center' },
  poolCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#0E1A2B', borderRadius: 12, borderWidth: 1, borderColor: '#1F3A59', padding: 14 },
  poolCardActive: { borderColor: '#53E3A6', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  poolIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0D2818', alignItems: 'center', justifyContent: 'center' },
  poolName: { color: '#EAF3FF', fontSize: 15, fontWeight: '600' },
  poolMeta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  poolDetail: { marginHorizontal: 16, backgroundColor: '#0A1525', borderWidth: 1, borderTopWidth: 0, borderColor: '#53E3A6', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingBottom: 16 },
  summaryCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#0E1A2B', borderRadius: 10, borderWidth: 1, borderColor: '#1F3A59', padding: 12, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#64748B', fontSize: 13 },
  summaryValue: { color: '#EAF3FF', fontSize: 13, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F3A59', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipExternal: { backgroundColor: '#2D1A40' },
  chipText: { color: '#EAF3FF', fontSize: 12, fontWeight: '500' },
  chipExt: { color: '#a855f7', fontSize: 10 },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16 },
  calcHint: { color: '#64748B', fontSize: 12 },
  balancedText: { color: '#475569', fontSize: 13, textAlign: 'center', marginHorizontal: 16 },
  preTxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 8 },
  preTxHeaderText: { color: '#53E3A6', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  preTxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#101A2A' },
  preTxFrom: { color: '#f87171', fontSize: 13, fontWeight: '600', flex: 1 },
  preTxTo: { color: '#4ade80', fontSize: 13, fontWeight: '600', flex: 1 },
  preTxAmount: { color: '#EAF3FF', fontSize: 14, fontWeight: '700' },
  commitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#53E3A6', borderRadius: 10, paddingVertical: 11, marginHorizontal: 16, marginTop: 14 },
  commitButtonText: { color: '#060A14', fontSize: 13, fontWeight: '600' },
  preTxHint: { color: '#334155', fontSize: 11, textAlign: 'center', marginHorizontal: 16, marginTop: 8 },
  committedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4 },
  committedText: { fontSize: 13, fontWeight: '600' },
  poolDebtLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
});
