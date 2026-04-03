import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useDebts } from '../../hooks/useDebts';
import Icon from '../Icon';
import ContextBar from '../dashboard/layout/ContextBar';
import DebtListSection from './DebtListSection';
import type { AppDebt } from '../../types/pools';
import { uiPath, uiProps } from '../../lib/devtools';

export default function LendingSection() {
  const { user } = useAuth();
  const { navigation, setActiveSection } = useDashboard();
  const { debts, loading, getUserDebts, confirmDebt, markRecorded, archiveDebt, deleteDebt } = useDebts(user);

  useEffect(() => {
    void getUserDebts();
  }, [getUserDebts]);

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

        <DebtListSection
          debts={debts}
          userId={user.id}
          onConfirm={confirmDebt}
          onConvert={convertToTransaction}
          onArchive={archiveDebt}
          onDelete={deleteDebt}
          screen="lending"
        />
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
});
