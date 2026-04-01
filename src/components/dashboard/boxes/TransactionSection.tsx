import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
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
      <View style={styles.sectionHeader} {...uiProps(uiPath('dashboard', 'tx_section', 'header'))}>
        {selectedCategoryFilter ? (
          <View style={styles.filterLabelRow}>
            <Text style={styles.sectionTitle} {...uiProps(uiPath('dashboard', 'tx_section', 'title'))}>
              {categorySpendData.find((r) => r.id === selectedCategoryFilter)?.name ?? 'Category'}
            </Text>
            <Text style={styles.filterLabelSub}> transactions</Text>
          </View>
        ) : showOnlyTransfers ? (
          <Text
            style={[styles.sectionTitle, { color: '#a855f7' }]}
            {...uiProps(uiPath('dashboard', 'tx_section', 'title'))}
          >
            ↔ Transfers
          </Text>
        ) : (
          <Text style={styles.sectionTitle} {...uiProps(uiPath('dashboard', 'tx_section', 'title'))}>
            {showAccountOverviewPicker ? 'Included Transactions' : 'Recent Transactions'}
          </Text>
        )}
        <View style={styles.sectionHeaderActions}>
          {selectedCategoryFilter && (
            <TouchableOpacity
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'clear_category_button'), 'press');
                setSelectedCategoryFilter(null);
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'clear_category_button'))}
            >
              <Text style={styles.linkAction}>✕ All</Text>
            </TouchableOpacity>
          )}
          {showOnlyTransfers && !selectedCategoryFilter && (
            <TouchableOpacity
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'clear_transfers_button'), 'press');
                setShowOnlyTransfers(false);
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'clear_transfers_button'))}
            >
              <Text style={styles.linkAction}>✕ All</Text>
            </TouchableOpacity>
          )}
          {!showAccountOverviewPicker && (
            <TouchableOpacity
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'add_button'), 'press');
                openEntryModal('expense', filterIsExpense ? selectedCategoryFilter : null);
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'add_button'))}
            >
              <Icon name={"add_circle" as any} size={22} color="#6ED8A5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Transaction list */}
      <View style={styles.listCard} {...uiProps(uiPath('dashboard', 'tx_section', 'list'))}>
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
              <TouchableOpacity
                key={tx.id}
                style={styles.transactionRow}
                onPress={() => {
                  logUI(uiPath('dashboard', 'tx_section', 'row', tx.id), 'press');
                  openEditTransaction(tx);
                }}
                {...uiProps(uiPath('dashboard', 'tx_section', 'row', tx.id))}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {txCat?.icon && <Icon name={txCat.icon} size={14} color={titleColor ?? '#F0F6FF'} />}
                    <Text
                      style={titleColor ? [styles.transactionTitle, { color: titleColor }] : styles.transactionTitle}
                      {...uiProps(uiPath('dashboard', 'tx_section', 'row_title', tx.id))}
                    >
                      {txDisplayLabel(tx, isTransfer ? 'Transfer' : 'Untitled transaction')}
                    </Text>
                  </View>
                  <Text style={styles.transactionMeta} {...uiProps(uiPath('dashboard', 'tx_section', 'row_meta', tx.id))}>
                    {tx.date}{acct ? ` · ${acct.name}` : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    isTransfer ? styles.transferAmount : (tx.type === 'income' ? styles.positive : styles.negative),
                  ]}
                  {...uiProps(uiPath('dashboard', 'tx_section', 'row_amount', tx.id))}
                >
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
            <Text style={styles.emptyText} {...uiProps(uiPath('dashboard', 'tx_section', 'empty_text'))}>
              No transactions in this interval.
            </Text>
          ) : null;
        })()}
        {!showAccountOverviewPicker && hasMoreTransactions && !selectedCategoryFilter && (
          <Text style={styles.transactionMeta} {...uiProps(uiPath('dashboard', 'tx_section', 'load_more_hint'))}>
            Scroll down to load more transactions
          </Text>
        )}
        {showAccountOverviewPicker && visibleTransactionsCount < filteredIncludedTxs.length && (
          <Text style={styles.transactionMeta} {...uiProps(uiPath('dashboard', 'tx_section', 'load_more_hint'))}>
            Scroll down to load more transactions
          </Text>
        )}
      </View>

      {/* Pending invite token card */}
      {!!inviteToken && (
        <View style={styles.pendingCard} {...uiProps(uiPath('dashboard', 'tx_section', 'invite_card'))}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.pendingTitle} {...uiProps(uiPath('dashboard', 'tx_section', 'invite_title'))}>
              Latest invite token
            </Text>
            <TouchableOpacity
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'invite_share_button'), 'press');
                void shareInvite(inviteToken);
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'invite_share_button'))}
            >
              <Icon name="share" size={18} color="#8FA8C9" />
            </TouchableOpacity>
          </View>
          <Text style={styles.pendingAccountName} {...uiProps(uiPath('dashboard', 'tx_section', 'invite_token'))}>
            {inviteToken}
          </Text>
        </View>
      )}
    </>
  );
}
