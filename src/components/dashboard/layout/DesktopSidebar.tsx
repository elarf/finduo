import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function DesktopSidebar() {
  const {
    includedAccountSummaries,
    totalIncludedSummary,
    formatCurrency,
    selectedAccountId,
    setSelectedAccountId,
    allIncludedCategorySpendData,
    sidebarCategoryFilter,
    setSidebarCategoryFilter,
    sidebarFilteredTxs,
    sidebarTxCount,
    setSidebarTxCount,
    transferCategoryIds,
    categoriesById,
    accountsById,
    txDisplayLabel,
    openEditTransaction,
  } = useDashboard();

  return (
    <View style={styles.desktopSidebar}>
      {/* Fixed total card */}
      <View style={{ padding: 12, paddingBottom: 0 }}>
        <View style={styles.cardStrong}>
          <Text style={styles.cardStrongLabel}>ALL ACCOUNTS</Text>
          <Text style={[styles.cardStrongValue, totalIncludedSummary.net < 0 && styles.negative]}>
            {formatCurrency(totalIncludedSummary.net)}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, styles.positive]}>In {formatCurrency(totalIncludedSummary.income)}</Text>
            <Text style={[styles.summaryText, styles.negative]}>Out {formatCurrency(totalIncludedSummary.expense)}</Text>
          </View>
        </View>
      </View>
      {/* Scrollable rest */}
      <ScrollView
        contentContainerStyle={styles.desktopSidebarContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Included Accounts</Text>
        </View>
        <View style={styles.accountOverviewGrid}>
          {includedAccountSummaries.map((item) => (
            <TouchableOpacity
              key={item.account.id}
              style={[
                styles.accountOverviewCard,
                selectedAccountId === item.account.id && styles.accountOverviewCardActive,
              ]}
              onPress={() => setSelectedAccountId(item.account.id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {item.account.icon && <Icon name={item.account.icon} size={16} color="#8FA8C9" />}
                <Text style={styles.accountOverviewName}>{item.account.name}</Text>
              </View>
              <Text style={[styles.accountOverviewValue, item.balance < 0 && styles.negative]}>
                {formatCurrency(item.balance, item.account.currency)}
              </Text>
              <Text style={styles.accountOverviewMetaIncome}>In {formatCurrency(item.income, item.account.currency)}</Text>
              <Text style={styles.accountOverviewMetaExpense}>Out {formatCurrency(item.expense, item.account.currency)}</Text>
              {(item.transferIn > 0 || item.transferOut > 0) && (
                <Text style={{ color: '#a855f7', fontSize: 11, marginTop: 1 }}>↔ {formatCurrency(item.transferIn + item.transferOut, item.account.currency)}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.cardStrong, { marginTop: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={styles.cardStrongLabel}>SPENDING (ALL ACCOUNTS)</Text>
            {sidebarCategoryFilter && (
              <TouchableOpacity onPress={() => setSidebarCategoryFilter(null)}>
                <Text style={styles.linkAction}>✕ Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {allIncludedCategorySpendData.length === 0 ? (
            <Text style={styles.emptyText}>No expense data.</Text>
          ) : (
            allIncludedCategorySpendData.map((row) => {
              const isActive = sidebarCategoryFilter === row.id;
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.spendRow, isActive && styles.spendRowActive]}
                  activeOpacity={0.7}
                  onPress={() => setSidebarCategoryFilter(isActive ? null : row.id)}
                >
                  <View style={styles.spendLabelRow}>
                    <Text style={[styles.spendName, isActive && styles.spendNameActive]}>{row.name}</Text>
                    <Text style={styles.spendAmount}>{formatCurrency(row.total)}</Text>
                  </View>
                  <View style={styles.spendBarTrack}>
                    <View style={[styles.spendBarFill, { width: `${row.widthPercent}%` as any }, row.color ? { backgroundColor: row.color } : undefined, isActive && styles.spendBarFillActive]} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={[styles.sectionHeader, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>
            {sidebarCategoryFilter
              ? `${allIncludedCategorySpendData.find((r) => r.id === sidebarCategoryFilter)?.name ?? 'Category'} Transactions`
              : 'Included Transactions'}
          </Text>
        </View>
        <View style={styles.listCard}>
          {sidebarFilteredTxs.slice(0, sidebarTxCount).map((tx) => {
            const isSidebarTransfer = tx.category_id != null && transferCategoryIds.includes(tx.category_id);
            const sidebarTxCat = tx.category_id ? categoriesById[tx.category_id] : null;
            const sidebarTitleColor = isSidebarTransfer ? '#a855f7' : (sidebarTxCat?.color ?? undefined);
            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.sidebarTxRow}
                onPress={() => openEditTransaction(tx)}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 8 }}>
                  {sidebarTxCat?.icon && <Icon name={sidebarTxCat.icon} size={12} color={sidebarTitleColor ?? '#C5D9F3'} />}
                  <Text style={[styles.sidebarTxNote, { flex: 1, marginRight: 0 }, sidebarTitleColor ? { color: sidebarTitleColor } : null]} numberOfLines={1}>
                    {txDisplayLabel(tx, isSidebarTransfer ? 'Transfer' : 'Untitled')}
                  </Text>
                </View>
                <Text style={[styles.sidebarTxAmount, isSidebarTransfer ? styles.transferAmount : (tx.type === 'income' ? styles.positive : styles.negative)]}>
                  {isSidebarTransfer ? '↔' : (tx.type === 'income' ? '+' : '-')}{formatCurrency(Math.abs(Number(tx.amount)), accountsById[tx.account_id]?.currency)}
                </Text>
              </TouchableOpacity>
            );
          })}
          {sidebarFilteredTxs.length > sidebarTxCount && (
            <TouchableOpacity onPress={() => setSidebarTxCount((c) => c + 12)} style={{ paddingVertical: 8 }}>
              <Text style={styles.linkAction}>Load more</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
