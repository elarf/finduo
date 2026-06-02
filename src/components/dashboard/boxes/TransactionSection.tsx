import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';
import { todayIso } from '../../../types/dashboard';
import type { AppTransaction, AppCategory, TransactionSplit } from '../../../types/dashboard';

// ── Daily summary helpers ────────────────────────────────────────────────────

type DailyListItem =
  | { kind: 'tx'; tx: AppTransaction }
  | { kind: 'summary'; date: string; expense: number; income: number; endBalance: number };

function formatDayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function buildDailyList(
  txs: AppTransaction[],         // newest-first
  openingBalance: number,
  snapshotCutoff: string | null, // transactions at/before this date are baked into openingBalance
  todayStr: string,
): DailyListItem[] {
  // Group transactions by date, preserving original (newest-first) order
  const datesNewestFirst: string[] = [];
  const datesSeen = new Set<string>();
  const byDate = new Map<string, AppTransaction[]>();
  for (const tx of txs) {
    if (!datesSeen.has(tx.date)) {
      datesSeen.add(tx.date);
      datesNewestFirst.push(tx.date);
      byDate.set(tx.date, []);
    }
    byDate.get(tx.date)!.push(tx);
  }

  // Walk oldest-to-newest to compute running end-of-day balances
  let running = openingBalance;
  const dayStats = new Map<string, { expense: number; income: number; endBalance: number }>();
  for (const date of [...datesNewestFirst].reverse()) {
    if (snapshotCutoff && date <= snapshotCutoff) continue;
    let expense = 0;
    let income = 0;
    for (const tx of byDate.get(date)!) {
      const n = Number(tx.amount) || 0;
      if (tx.type === 'income') { income += n; running += n; }
      else { expense += n; running -= n; }
    }
    dayStats.set(date, { expense, income, endBalance: running });
  }

  // Build render list: summary above each qualifying past day, then its transactions
  const result: DailyListItem[] = [];
  for (const date of datesNewestFirst) {
    const stats = dayStats.get(date);
    if (stats && date < todayStr) {
      result.push({ kind: 'summary', date, ...stats });
    }
    for (const tx of byDate.get(date)!) {
      result.push({ kind: 'tx', tx });
    }
  }
  return result;
}

function DailySummaryRow({
  date, expense, income, endBalance, formatCurrency,
}: {
  date: string;
  expense: number;
  income: number;
  endBalance: number;
  formatCurrency: (n: number) => string;
}) {
  const showNet = expense > 0 && income > 0;
  const net = income - expense;
  return (
    <View style={dailyRowStyles.row}>
      <Text style={dailyRowStyles.date}>{formatDayDate(date)}</Text>
      <View style={dailyRowStyles.right}>
        {expense > 0 && <Text style={dailyRowStyles.expense}>−{formatCurrency(expense)}</Text>}
        {income > 0 && <Text style={dailyRowStyles.income}>+{formatCurrency(income)}</Text>}
        {showNet && (
          <Text style={net >= 0 ? dailyRowStyles.income : dailyRowStyles.expense}>
            {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
          </Text>
        )}
        <View style={dailyRowStyles.divider} />
        <Text style={endBalance < 0 ? dailyRowStyles.expense : dailyRowStyles.balance}>
          {formatCurrency(endBalance)}
        </Text>
      </View>
    </View>
  );
}

function SplitChips({
  tx,
  splits,
  categoriesById,
  formatCurrency,
}: {
  tx: AppTransaction;
  splits: TransactionSplit[];
  categoriesById: Record<string, AppCategory>;
  formatCurrency: (n: number) => string;
}) {
  const splitTotal = splits.reduce((s, r) => s + r.amount, 0);
  const remainder = (Number(tx.amount) || 0) - splitTotal;
  const parentCat = tx.category_id ? categoriesById[tx.category_id] : null;

  return (
    <View style={splitChipStyles.row}>
      {splits.map((s) => {
        const cat = categoriesById[s.category_id];
        return (
          <View key={s.id} style={[splitChipStyles.chip, cat?.color ? { borderColor: cat.color } : undefined]}>
            {cat?.icon && <Icon name={cat.icon} size={10} color={cat?.color ?? '#8FA8C9'} />}
            <Text style={[splitChipStyles.chipText, cat?.color ? { color: cat.color } : undefined]}>
              {cat?.name ?? '—'} {formatCurrency(s.amount)}
            </Text>
          </View>
        );
      })}
      {remainder > 0.005 && (
        <View style={[splitChipStyles.chip, parentCat?.color ? { borderColor: parentCat.color } : undefined]}>
          {parentCat?.icon && <Icon name={parentCat.icon} size={10} color={parentCat?.color ?? '#8FA8C9'} />}
          <Text style={[splitChipStyles.chipText, parentCat?.color ? { color: parentCat.color } : undefined]}>
            {parentCat?.name ?? '—'} {formatCurrency(remainder)}
          </Text>
        </View>
      )}
    </View>
  );
}

function TransactionRow({
  tx,
  isTransfer,
  acctName,
  txCat,
  splits,
  titleColor,
  formatCurrency,
  categoriesById,
  txDisplayLabel,
  openEditTransaction,
}: {
  tx: AppTransaction;
  isTransfer: boolean;
  acctName: string | null;
  txCat: AppCategory | null;
  splits: TransactionSplit[];
  titleColor: string | undefined;
  formatCurrency: (n: number) => string;
  categoriesById: Record<string, AppCategory>;
  txDisplayLabel: (tx: AppTransaction, fallback: string) => React.ReactNode;
  openEditTransaction: (tx: AppTransaction) => void;
}) {
  return (
    <TouchableOpacity
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
        {splits.length > 0 && (
          <SplitChips tx={tx} splits={splits} categoriesById={categoriesById} formatCurrency={formatCurrency} />
        )}
        <Text style={styles.transactionMeta} {...uiProps(uiPath('dashboard', 'tx_section', 'row_meta', tx.id))}>
          {tx.date}{acctName ? ` · ${acctName}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text
          style={[
            styles.transactionAmount,
            isTransfer ? styles.transferAmount : (tx.type === 'income' ? styles.positive : styles.negative),
          ]}
          {...uiProps(uiPath('dashboard', 'tx_section', 'row_amount', tx.id))}
        >
          {isTransfer ? '↔' : (tx.type === 'income' ? '+' : '-')}{formatCurrency(Number(tx.amount) || 0)}
        </Text>
        {splits.length > 0 && (
          <Icon name="GitBranch" size={11} color="#8FA8C9" />
        )}
      </View>
    </TouchableOpacity>
  );
}

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
    setVisibleTransactionsCount,
    txDisplayLabel,
    formatCurrency,
    openEditTransaction,
    inviteToken,
    shareInvite,
    selectedSummary,
    splitsByParentTx,
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
              style={{ alignSelf: 'stretch', justifyContent: 'center' }}
              {...uiProps(uiPath('dashboard', 'tx_section', 'search_button'))}
            >
              <Image
                source={require('../../../../assets/searchicon.webp')}
                style={{ height: 50, width: 50 }}
                resizeMode="contain"
              />
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

          const showDailySummaries = searchedTransactions === null
            && !showAccountOverviewPicker
            && !showOnlyTransfers
            && !selectedCategoryFilter;

          const items: DailyListItem[] = showDailySummaries
            ? buildDailyList(txSource, selectedSummary.openingBalance, selectedSummary.snapshotCutoff, todayIso())
            : txSource.map((tx) => ({ kind: 'tx' as const, tx }));

          return items.map((item) => {
            if (item.kind === 'summary') {
              return (
                <DailySummaryRow
                  key={`daily-${item.date}`}
                  date={item.date}
                  expense={item.expense}
                  income={item.income}
                  endBalance={item.endBalance}
                  formatCurrency={formatCurrency}
                />
              );
            }
            const tx = item.tx;
            const isTransfer = tx.category_id != null && transferCategoryIds.includes(tx.category_id);
            const acct = showAccountOverviewPicker ? accountsById[tx.account_id] : null;
            const txCat = tx.category_id ? categoriesById[tx.category_id] : null;
            const titleColor = isTransfer ? '#a855f7' : (txCat?.color ?? undefined);
            const splits = tx.has_splits ? (splitsByParentTx[tx.id] ?? []) : [];
            return (
              <TransactionRow
                key={tx.id}
                tx={tx}
                isTransfer={isTransfer}
                acctName={acct?.name ?? null}
                txCat={txCat}
                splits={splits}
                titleColor={titleColor}
                formatCurrency={formatCurrency}
                categoriesById={categoriesById}
                txDisplayLabel={txDisplayLabel}
                openEditTransaction={openEditTransaction}
              />
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
            Tap to load more transactions
          </Text>
        )}
        {showAccountOverviewPicker && visibleTransactionsCount < filteredIncludedTxs.length && (
          <TouchableOpacity
            onPress={() => {
              logUI(uiPath('dashboard', 'tx_section', 'load_more_hint'), 'press');
              setVisibleTransactionsCount((prev) => Math.min(prev + 12, filteredIncludedTxs.length));
            }}
            {...uiProps(uiPath('dashboard', 'tx_section', 'load_more_hint'))}
          >
            <Text style={styles.transactionMeta}>
              Tap to load more transactions
            </Text>
          </TouchableOpacity>
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

const splitChipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
    marginBottom: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 999,
    backgroundColor: '#0D1F31',
  },
  chipText: {
    color: '#8FA8C9',
    fontSize: 10,
    fontWeight: '600',
  },
});

const dailyRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: '#0B1825',
    borderBottomColor: '#263E5F',
    borderBottomWidth: 1,
  },
  date: {
    color: '#5E789A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expense: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  income: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: '#2D4A68',
    marginHorizontal: 2,
  },
  balance: {
    color: '#8FA8C9',
    fontSize: 11,
    fontWeight: '700',
  },
});

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
