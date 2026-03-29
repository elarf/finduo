import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function TransactionSection() {
  const {
    selectedCategoryFilter, setSelectedCategoryFilter,
    showOnlyTransfers, setShowOnlyTransfers,
    showAccountOverviewPicker,
    categorySpendData,
    filteredIncludedTxs,
    visibleSelectedTxs,
    visibleTransactionsCount,
    categoryFilteredTxsVisible,
    transferCategoryIds,
    accountsById,
    categoriesById,
    hasMoreTransactions,
    txDisplayLabel,
    formatCurrency,
    openEditTransaction,
    openEntryModal,
    filterIsExpense,
    inviteToken,
    shareInvite,
  } = useDashboard();

  return (
    <>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        {selectedCategoryFilter ? (
          <View style={styles.filterLabelRow}>
            <Text style={styles.sectionTitle}>
              {categorySpendData.find((r) => r.id === selectedCategoryFilter)?.name ?? 'Category'}
            </Text>
            <Text style={styles.filterLabelSub}> transactions</Text>
          </View>
        ) : showOnlyTransfers ? (
          <Text style={[styles.sectionTitle, { color: '#a855f7' }]}>↔ Transfers</Text>
        ) : (
          <Text style={styles.sectionTitle}>
            {showAccountOverviewPicker ? 'Included Transactions' : 'Recent Transactions'}
          </Text>
        )}
        <View style={styles.sectionHeaderActions}>
          {selectedCategoryFilter && (
            <TouchableOpacity onPress={() => setSelectedCategoryFilter(null)}>
              <Text style={styles.linkAction}>✕ All</Text>
            </TouchableOpacity>
          )}
          {showOnlyTransfers && !selectedCategoryFilter && (
            <TouchableOpacity onPress={() => setShowOnlyTransfers(false)}>
              <Text style={styles.linkAction}>✕ All</Text>
            </TouchableOpacity>
          )}
          {!showAccountOverviewPicker && (
            <TouchableOpacity onPress={() => openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null)}>
              <Icon name={"add_circle" as any} size={22} color="#6ED8A5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Transaction list */}
      <View style={styles.listCard}>
        {(() => {
          const txSource = showAccountOverviewPicker
            ? filteredIncludedTxs.slice(0, visibleTransactionsCount)
            : showOnlyTransfers
            ? visibleSelectedTxs.filter((tx) => tx.category_id != null && transferCategoryIds.includes(tx.category_id))
            : (selectedCategoryFilter ? categoryFilteredTxsVisible ?? [] : visibleSelectedTxs);
          return txSource.map((tx) => {
            const isTransfer = tx.category_id != null && transferCategoryIds.includes(tx.category_id);
            const acct = showAccountOverviewPicker ? accountsById[tx.account_id] : null;
            const txCat = tx.category_id ? categoriesById[tx.category_id] : null;
            const titleColor = isTransfer ? '#a855f7' : (txCat?.color ?? undefined);
            return (
              <TouchableOpacity key={tx.id} style={styles.transactionRow} onPress={() => openEditTransaction(tx)}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {txCat?.icon && <Icon name={txCat.icon} size={14} color={titleColor ?? '#F0F6FF'} />}
                    <Text style={titleColor ? [styles.transactionTitle, { color: titleColor }] : styles.transactionTitle}>
                      {txDisplayLabel(tx, isTransfer ? 'Transfer' : 'Untitled transaction')}
                    </Text>
                  </View>
                  <Text style={styles.transactionMeta}>
                    {tx.date}{acct ? ` · ${acct.name}` : ''}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  isTransfer ? styles.transferAmount : (tx.type === 'income' ? styles.positive : styles.negative),
                ]}>
                  {isTransfer ? '↔' : (tx.type === 'income' ? '+' : '-')}{formatCurrency(Number(tx.amount) || 0)}
                </Text>
              </TouchableOpacity>
            );
          });
        })()}
        {(() => {
          const txLen = showAccountOverviewPicker
            ? filteredIncludedTxs.slice(0, visibleTransactionsCount).length
            : showOnlyTransfers
            ? visibleSelectedTxs.filter((tx) => tx.category_id != null && transferCategoryIds.includes(tx.category_id)).length
            : (selectedCategoryFilter ? (categoryFilteredTxsVisible?.length ?? 0) : visibleSelectedTxs.length);
          return txLen === 0 ? (
            <Text style={styles.emptyText}>No transactions in this interval.</Text>
          ) : null;
        })()}
        {!showAccountOverviewPicker && hasMoreTransactions && !selectedCategoryFilter && (
          <Text style={styles.transactionMeta}>Scroll down to load more transactions</Text>
        )}
        {showAccountOverviewPicker && visibleTransactionsCount < filteredIncludedTxs.length && (
          <Text style={styles.transactionMeta}>Scroll down to load more transactions</Text>
        )}
      </View>

      {/* Pending invite token card */}
      {!!inviteToken && (
        <View style={styles.pendingCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.pendingTitle}>Latest invite token</Text>
            <TouchableOpacity onPress={() => void shareInvite(inviteToken)}>
              <Icon name="share" size={18} color="#8FA8C9" />
            </TouchableOpacity>
          </View>
          <Text style={styles.pendingAccountName}>{inviteToken}</Text>
        </View>
      )}
    </>
  );
}
