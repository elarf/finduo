import React, { useCallback, useEffect, useMemo } from 'react';
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
import { useDebts } from '../../hooks/useDebts';
import Icon from '../Icon';
import ContextBar from '../dashboard/layout/ContextBar';
import type { AppDebt } from '../../types/pools';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

function DebtRow({ debt, userId, onConfirm, onConvert }: {
  debt: AppDebt;
  userId: string;
  onConfirm: (id: string) => void;
  onConvert: (debt: AppDebt) => void;
}) {
  const iOwe = debt.from_user === userId;
  const myConfirmed = iOwe ? debt.from_confirmed : debt.to_confirmed;
  const otherConfirmed = iOwe ? debt.to_confirmed : debt.from_confirmed;
  const otherUserId = iOwe ? debt.to_user : debt.from_user;
  const otherName = iOwe
    ? (debt.to_participant_name ?? otherUserId.slice(0, 8))
    : (debt.from_participant_name ?? otherUserId.slice(0, 8));

  const statusColor =
    debt.status === 'paid' ? '#4ade80' :
    debt.status === 'confirmed' ? '#53E3A6' :
    '#f59e0b';

  return (
    <View style={s.debtRow} {...uiProps(uiPath('lending', 'debt_row', 'container', debt.id))}>
      <View style={s.debtIcon} {...uiProps(uiPath('lending', 'debt_row', 'icon', debt.id))}>
        <Icon name={iOwe ? 'ArrowUpRight' : 'ArrowDownLeft'} size={18} color={iOwe ? '#f87171' : '#4ade80'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.debtText} {...uiProps(uiPath('lending', 'debt_row', 'text', debt.id))}>
          {iOwe ? `You owe ${otherName}` : `${otherName} owes you`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <View style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}
            {...uiProps(uiPath('lending', 'debt_row', 'status_badge', debt.id))}>
            <Text style={[s.statusText, { color: statusColor }]}>{debt.status}</Text>
          </View>
          {debt.pool_id && <Text style={s.debtMeta}>pool</Text>}
          {myConfirmed && <Text style={s.debtMeta}>you confirmed</Text>}
          {otherConfirmed && <Text style={s.debtMeta}>they confirmed</Text>}
        </View>
      </View>
      <Text style={[s.debtAmount, { color: iOwe ? '#f87171' : '#4ade80' }]}
        {...uiProps(uiPath('lending', 'debt_row', 'amount', debt.id))}>
        {iOwe ? '-' : '+'}{Number(debt.amount).toFixed(2)}
      </Text>
      <View style={s.debtActions}>
        {debt.status === 'pending' && !myConfirmed && (
          <TouchableOpacity style={s.confirmBtn} onPress={() => {
            logUI(uiPath('lending', 'debt_row', 'confirm_button', debt.id), 'press');
            onConfirm(debt.id);
          }} {...uiProps(uiPath('lending', 'debt_row', 'confirm_button', debt.id))}>
            <Icon name="Check" size={14} color="#060A14" />
          </TouchableOpacity>
        )}
        {debt.status === 'confirmed' && (
          <TouchableOpacity style={s.convertBtn} onPress={() => {
            logUI(uiPath('lending', 'debt_row', 'convert_button', debt.id), 'press');
            onConvert(debt);
          }} {...uiProps(uiPath('lending', 'debt_row', 'convert_button', debt.id))}>
            <Icon name="ArrowRightLeft" size={13} color="#060A14" />
            <Text style={s.convertBtnText}>Record</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function LendingSection() {
  const { user } = useAuth();
  const { navigation, setActiveSection } = useDashboard();
  const { debts, loading, getUserDebts, confirmDebt } = useDebts(user);

  useEffect(() => {
    void getUserDebts();
  }, [getUserDebts]);

  const convertToTransaction = useCallback((debt: AppDebt) => {
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
  }, [navigation, setActiveSection, user?.id]);

  const pendingDebts = useMemo(() => debts.filter((d) => d.status === 'pending'), [debts]);
  const confirmedDebts = useMemo(() => debts.filter((d) => d.status === 'confirmed'), [debts]);
  const paidDebts = useMemo(() => debts.filter((d) => d.status === 'paid'), [debts]);

  const netBalance = useMemo(() => {
    if (!user) return 0;
    return debts.filter((d) => d.status !== 'paid').reduce((sum, d) => {
      if (d.to_user === user.id) return sum + Number(d.amount);
      if (d.from_user === user.id) return sum - Number(d.amount);
      return sum;
    }, 0);
  }, [debts, user]);

  if (!user) return null;

  return (
    <View style={s.container}>
      <ContextBar label="Lending" onDismiss={() => setActiveSection(null)} />

      <View style={s.balanceCard} {...uiProps(uiPath('lending', 'balance_card', 'container'))}>
        <Text style={s.balanceLabel} {...uiProps(uiPath('lending', 'balance_card', 'label'))}>Net balance</Text>
        <Text style={[s.balanceValue, { color: netBalance >= 0 ? '#4ade80' : '#f87171' }]}
          {...uiProps(uiPath('lending', 'balance_card', 'value'))}>
          {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}
        </Text>
        <Text style={s.balanceHint} {...uiProps(uiPath('lending', 'balance_card', 'hint'))}>
          {netBalance > 0 ? 'Others owe you' : netBalance < 0 ? 'You owe others' : 'All settled'}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}
        {...uiProps(uiPath('lending', 'scroll_view', 'root'))}>
        {loading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 24 }} />}

        {!loading && debts.length === 0 && (
          <View style={s.emptyContainer} {...uiProps(uiPath('lending', 'empty_state', 'container'))}>
            <Icon name="Handshake" size={40} color="#1F3A59" />
            <Text style={s.emptyText}>No debts</Text>
            <Text style={s.emptyHint}>Settle a pool to create debts</Text>
          </View>
        )}

        {pendingDebts.length > 0 && (
          <>
            <Text style={s.sectionTitle} {...uiProps(uiPath('lending', 'section_title', 'pending'))}>
              Pending ({pendingDebts.length})
            </Text>
            {pendingDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onConvert={convertToTransaction} />
            ))}
          </>
        )}

        {confirmedDebts.length > 0 && (
          <>
            <Text style={s.sectionTitle} {...uiProps(uiPath('lending', 'section_title', 'confirmed'))}>
              Ready to record ({confirmedDebts.length})
            </Text>
            {confirmedDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onConvert={convertToTransaction} />
            ))}
          </>
        )}

        {paidDebts.length > 0 && (
          <>
            <Text style={s.sectionTitle} {...uiProps(uiPath('lending', 'section_title', 'paid'))}>
              Paid ({paidDebts.length})
            </Text>
            {paidDebts.map((d) => (
              <DebtRow key={d.id} debt={d} userId={user.id} onConfirm={confirmDebt} onConvert={convertToTransaction} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A14' },
  balanceCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#0E1A2B', borderRadius: 12,
    borderWidth: 1, borderColor: '#1F3A59',
    padding: 16, alignItems: 'center', gap: 4,
  },
  balanceLabel: { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { fontSize: 28, fontWeight: '700' },
  balanceHint: { color: '#475569', fontSize: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 12 },
  emptyHint: { color: '#475569', fontSize: 12, textAlign: 'center' },
  sectionTitle: {
    color: '#64748B', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: 16, marginTop: 20, marginBottom: 6,
  },
  debtRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#101A2A', gap: 10,
  },
  debtIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0E1A2B', alignItems: 'center', justifyContent: 'center' },
  debtText: { color: '#EAF3FF', fontSize: 14 },
  debtMeta: { color: '#475569', fontSize: 10 },
  debtAmount: { fontSize: 15, fontWeight: '600' },
  debtActions: { flexDirection: 'row', gap: 6 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#53E3A6', borderRadius: 6, padding: 6 },
  convertBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#53E3A6', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  convertBtnText: { color: '#060A14', fontSize: 11, fontWeight: '700' },
});
