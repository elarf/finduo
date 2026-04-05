import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    tags,
    hasMoreTransactions,
    txDisplayLabel,
    formatCurrency,
    openEditTransaction,
    openEntryModal,
    filterIsExpense,
    inviteToken,
    shareInvite,
  } = useDashboard();

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Find matching tags
  const matchingTags = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(query));
  }, [searchQuery, tags]);

  // Filter transactions based on search
  const searchedTransactions = useMemo(() => {
    if (!searchMode || !searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const txSource = showAccountOverviewPicker
      ? filteredIncludedTxs
      : visibleSelectedTxs;

    return txSource.filter((tx) => {
      // Search in note
      if (tx.note?.toLowerCase().includes(query)) return true;

      // Search in category name
      const cat = tx.category_id ? categoriesById[tx.category_id] : null;
      if (cat?.name.toLowerCase().includes(query)) return true;

      // Search in tag names
      if (tx.tag_ids?.length) {
        const txTags = tags.filter((t) => tx.tag_ids.includes(t.id));
        if (txTags.some((t) => t.name.toLowerCase().includes(query))) return true;
      }

      // Search in amount
      if (tx.amount.toString().includes(query)) return true;

      return false;
    });
  }, [searchMode, searchQuery, showAccountOverviewPicker, filteredIncludedTxs, visibleSelectedTxs, categoriesById, tags]);

  const handleTagChipPress = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (tag) {
      setSearchQuery(tag.name);
    }
  };

  return (
    <>
      {/* Section header */}
      <View style={styles.sectionHeader} {...uiProps(uiPath('dashboard', 'tx_section', 'header'))}>
        {searchMode ? (
          <View style={searchStyles.searchInputContainer}>
            <Icon name="Search" size={16} color="#4A6280" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search transactions…"
              placeholderTextColor="#4A6280"
              style={searchStyles.searchInput}
              autoFocus
              returnKeyType="search"
              {...uiProps(uiPath('dashboard', 'tx_section', 'search_input'))}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Icon name="X" size={16} color="#4A6280" />
              </TouchableOpacity>
            )}
          </View>
        ) : selectedCategoryFilter ? (
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
          {searchMode && (
            <TouchableOpacity
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'close_search_button'), 'press');
                setSearchMode(false);
                setSearchQuery('');
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'close_search_button'))}
            >
              <Text style={styles.linkAction}>Cancel</Text>
            </TouchableOpacity>
          )}
          {!searchMode && selectedCategoryFilter && (
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
          {!searchMode && showOnlyTransfers && !selectedCategoryFilter && (
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
          {!searchMode && !showAccountOverviewPicker && (
            <TouchableOpacity
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'search_button'), 'press');
                setSearchMode(true);
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'search_button'))}
            >
              <Icon name="Search" size={20} color="#6ED8A5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Matching tags chips */}
      {searchMode && matchingTags.length > 0 && (
        <View style={searchStyles.tagsChipsRow}>
          {matchingTags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={[searchStyles.tagChip, tag.color ? { borderColor: tag.color } : undefined]}
              onPress={() => {
                logUI(uiPath('dashboard', 'tx_section', 'tag_chip', tag.id), 'press');
                handleTagChipPress(tag.id);
              }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'tag_chip', tag.id))}
            >
              {tag.icon && <Icon name={tag.icon as any} size={12} color={tag.color ?? '#8FA8C9'} />}
              <Text style={[searchStyles.tagChipText, tag.color ? { color: tag.color } : undefined]}>
                #{tag.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Transaction list */}
      <View style={styles.listCard} {...uiProps(uiPath('dashboard', 'tx_section', 'list'))}>
        {(() => {
          const txSource = searchedTransactions !== null
            ? searchedTransactions
            : showAccountOverviewPicker
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
          const txLen = searchedTransactions !== null
            ? searchedTransactions.length
            : showAccountOverviewPicker
            ? filteredIncludedTxs.slice(0, visibleTransactionsCount).length
            : showOnlyTransfers
            ? visibleSelectedTxs.filter((tx) => tx.category_id != null && transferCategoryIds.includes(tx.category_id)).length
            : (selectedCategoryFilter ? (categoryFilteredTxsVisible?.length ?? 0) : visibleSelectedTxs.length);
          return txLen === 0 ? (
            <Text style={styles.emptyText} {...uiProps(uiPath('dashboard', 'tx_section', 'empty_text'))}>
              {searchMode ? 'No matching transactions found.' : 'No transactions in this interval.'}
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

const searchStyles = StyleSheet.create({
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D1F31',
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#EAF3FF',
    fontSize: 14,
    paddingVertical: 0,
  },
  tagsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#060A14',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 999,
    backgroundColor: '#0D1F31',
  },
  tagChipText: {
    color: '#8FA8C9',
    fontSize: 12,
    fontWeight: '600',
  },
});
