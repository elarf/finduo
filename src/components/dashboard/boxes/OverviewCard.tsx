import React, { useEffect, useMemo } from 'react';
import { Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { type IntervalKey } from '../../../types/dashboard';
import { styles } from '../../../screens/DashboardScreen.styles';
import { uiPath, uiProps, logUI } from '../../../lib/devtools';

const ALL_INTERVALS: IntervalKey[] = ['day', 'week', 'month', 'year', 'all', 'custom'];

export default function OverviewCard() {
  const {
    desktopView,
    showAccountOverviewPicker, setShowAccountOverviewPicker,
    setSelectedCategoryFilter,
    overviewCollapsed, setOverviewCollapsed,
    overviewSummary,
    formatCurrency,
    selectedAccount,
    interval, setInterval,
    showIntervalPicker, setShowIntervalPicker,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    setTimeCursorOffset,
    intervalVisibility,
    intervalLabel,
    navigateInterval,
    totalIncludedBalance,
    includedAccountSummaries,
    selectedAccountId, setSelectedAccountId,
  } = useDashboard();

  const visibleIntervals = ALL_INTERVALS.filter((k) => intervalVisibility[k]);
  const canNavigate = interval !== 'all' && interval !== 'custom';

  type CurrencyGroup = {
    balance: number; openingBalance: number;
    income: number; expense: number;
    transferIn: number; transferOut: number;
  };

  // Group all included account fields by currency — always, not just in overview mode
  const currencyTotals = useMemo((): [string, CurrencyGroup][] => {
    const groups: Record<string, CurrencyGroup> = {};
    for (const item of includedAccountSummaries) {
      const c = item.account.currency ?? 'USD';
      const g = groups[c] ?? { balance: 0, openingBalance: 0, income: 0, expense: 0, transferIn: 0, transferOut: 0 };
      g.balance += item.balance;
      g.openingBalance += item.openingBalance;
      g.income += item.income;
      g.expense += item.expense;
      g.transferIn += item.transferIn;
      g.transferOut += item.transferOut;
      groups[c] = g;
    }
    return Object.entries(groups);
  }, [includedAccountSummaries]);
  const isMultiCurrency = showAccountOverviewPicker && currencyTotals.length > 1;
  // When showing included accounts total in a single currency that differs from selectedAccount,
  // force all formatCurrency calls to use that currency.
  const displayCurrency = (showAccountOverviewPicker && currencyTotals.length === 1)
    ? currencyTotals[0][0]
    : undefined;

  useEffect(() => {
    logUI(uiPath('dashboard', 'overview_card', 'container'), 'mounted');
  }, []);

  return (
    <>
      <View {...uiProps(uiPath('dashboard', 'overview_card', 'container'))} style={styles.cardStrong}>
        <Pressable
          {...uiProps(uiPath('dashboard', 'overview_card', 'balance_toggle'))}
          disabled={desktopView}
          onPress={() => {
            setShowAccountOverviewPicker((prev) => !prev);
            setSelectedCategoryFilter(null);
          }}
        >
          <View {...uiProps(uiPath('dashboard', 'overview_card', 'header'))} style={styles.cardCollapseHeader}>
            <Text style={styles.cardStrongLabel}>
              {showAccountOverviewPicker ? 'Included Accounts Total' : `${selectedAccount?.name ?? 'Account'} Balance`}
            </Text>
            <TouchableOpacity
              {...uiProps(uiPath('dashboard', 'overview_card', 'collapse_btn'))}
              onPress={() => setOverviewCollapsed((p) => !p)}
            >
              <Text style={styles.collapseChevron}>{overviewCollapsed ? '▸' : '▾'}</Text>
            </TouchableOpacity>
          </View>
          {isMultiCurrency ? (
            currencyTotals.map(([currency, g]) => (
              <Text key={currency} {...uiProps(uiPath('dashboard', 'overview_card', 'net_value'))} style={[styles.cardStrongValue, g.balance < 0 && styles.negative]}>
                {formatCurrency(g.balance, currency)}
              </Text>
            ))
          ) : (
            <Text {...uiProps(uiPath('dashboard', 'overview_card', 'net_value'))} style={[styles.cardStrongValue, overviewSummary.net < 0 && styles.negative]}>
              {formatCurrency(overviewSummary.net, displayCurrency)}
            </Text>
          )}
        </Pressable>
        {!overviewCollapsed && (
          <>
            {/* Interval navigation row */}
            <View {...uiProps(uiPath('dashboard', 'overview_card', 'interval_nav'))} style={styles.intervalNavRow}>
              {canNavigate ? (
                <TouchableOpacity
                  {...uiProps(uiPath('dashboard', 'overview_card', 'interval_prev'))}
                  style={styles.intervalNavArrow}
                  onPress={() => {
                    logUI(uiPath('dashboard', 'overview_card', 'interval_prev'), 'press');
                    navigateInterval('prev');
                  }}
                >
                  <Text style={styles.intervalNavArrowText}>◀</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.intervalNavArrow} />
              )}

              <TouchableOpacity
                {...uiProps(uiPath('dashboard', 'overview_card', 'interval_label'))}
                style={styles.intervalNavCenter}
                onPress={() => setShowIntervalPicker((p) => !p)}
              >
                <Text style={styles.intervalNavLabel}>{intervalLabel}</Text>
                <Text style={styles.intervalNavType}>{interval.toUpperCase()} {showIntervalPicker ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {canNavigate ? (
                <TouchableOpacity
                  {...uiProps(uiPath('dashboard', 'overview_card', 'interval_next'))}
                  style={styles.intervalNavArrow}
                  onPress={() => {
                    logUI(uiPath('dashboard', 'overview_card', 'interval_next'), 'press');
                    navigateInterval('next');
                  }}
                >
                  <Text style={styles.intervalNavArrowText}>▶</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.intervalNavArrow} />
              )}
            </View>

            {/* Filter chip selector */}
            {showIntervalPicker && (
              <View {...uiProps(uiPath('dashboard', 'overview_card', 'interval_picker'))} style={styles.intervalPickerWrap}>
                <View style={styles.menuChipWrap}>
                  {visibleIntervals.map((key) => (
                    <TouchableOpacity
                      key={key}
                      {...uiProps(uiPath('dashboard', 'overview_card', 'interval_chip', key))}
                      style={[styles.menuChip, interval === key && styles.menuChipActive]}
                      onPress={() => {
                        if (key === interval) {
                          // Re-select same: reset to current period
                          setTimeCursorOffset(0);
                        } else {
                          setInterval(key);
                          setTimeCursorOffset(0);
                        }
                        if (key !== 'custom') setShowIntervalPicker(false);
                      }}
                    >
                      <Text style={styles.menuChipText}>{key.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {interval === 'custom' && (
                  <View style={styles.customRangeStack}>
                    <TextInput
                      value={customStart}
                      onChangeText={setCustomStart}
                      placeholder="Start YYYY-MM-DD"
                      placeholderTextColor="#64748B"
                      style={styles.input}
                    />
                    <TextInput
                      value={customEnd}
                      onChangeText={setCustomEnd}
                      placeholder="End YYYY-MM-DD"
                      placeholderTextColor="#64748B"
                      style={styles.input}
                    />
                  </View>
                )}
              </View>
            )}

            {isMultiCurrency ? (
              currencyTotals.map(([currency, g]) => (
                <View key={currency} style={{ marginTop: 4 }}>
                  <Text style={[styles.summaryText, { color: '#8FA8C9', marginBottom: 1 }]}>{currency}</Text>
                  <Text style={styles.summaryText}>Opening: <Text style={g.openingBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(g.openingBalance, currency)}</Text></Text>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryText, styles.positive]}>Income {formatCurrency(g.income, currency)}</Text>
                    <Text style={[styles.summaryText, styles.negative]}>Expenses {formatCurrency(g.expense, currency)}</Text>
                  </View>
                  {(g.transferIn > 0 || g.transferOut > 0) && (
                    <View style={styles.summaryRow}>
                      {g.transferIn > 0 && <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer in ↔ {formatCurrency(g.transferIn, currency)}</Text>}
                      {g.transferOut > 0 && <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer out ↔ {formatCurrency(g.transferOut, currency)}</Text>}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <>
                <Text style={styles.summaryText}>Opening: <Text style={overviewSummary.openingBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(overviewSummary.openingBalance, displayCurrency)}</Text></Text>
                <View style={styles.summaryRow}>
                  <Text {...uiProps(uiPath('dashboard', 'overview_card', 'income_label'))} style={[styles.summaryText, styles.positive]}>Income {formatCurrency(overviewSummary.income, displayCurrency)}</Text>
                  <Text {...uiProps(uiPath('dashboard', 'overview_card', 'expense_label'))} style={[styles.summaryText, styles.negative]}>Expenses {formatCurrency(overviewSummary.expense, displayCurrency)}</Text>
                </View>
                {(overviewSummary.transferIn > 0 || overviewSummary.transferOut > 0) && (
                  <View style={styles.summaryRow}>
                    {overviewSummary.transferIn > 0 && (
                      <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer in ↔ {formatCurrency(overviewSummary.transferIn, displayCurrency)}</Text>
                    )}
                    {overviewSummary.transferOut > 0 && (
                      <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer out ↔ {formatCurrency(overviewSummary.transferOut, displayCurrency)}</Text>
                    )}
                  </View>
                )}
                {currencyTotals.length > 1 ? (
                  currencyTotals.map(([currency, g]) => (
                    <Text key={currency} style={styles.summaryText}>
                      Total {currency}: <Text style={g.balance >= 0 ? styles.positive : styles.negative}>{formatCurrency(g.balance, currency)}</Text>
                    </Text>
                  ))
                ) : (
                  <Text style={styles.summaryText}>Total Included Balance: <Text style={totalIncludedBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(totalIncludedBalance, displayCurrency)}</Text></Text>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* Mobile account overview grid */}
      {!desktopView && includedAccountSummaries.length > 1 && showAccountOverviewPicker && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Included Accounts Overview</Text>
          </View>
          <View {...uiProps(uiPath('dashboard', 'overview_card', 'account_grid'))} style={styles.accountOverviewGrid}>
            {includedAccountSummaries.map((item) => (
              <TouchableOpacity
                key={item.account.id}
                {...uiProps(uiPath('dashboard', 'overview_card', 'account_card', item.account.id))}
                style={[
                  styles.accountOverviewCard,
                  selectedAccountId === item.account.id && styles.accountOverviewCardActive,
                ]}
                onPress={() => {
                  logUI(uiPath('dashboard', 'overview_card', 'account_card', item.account.id), 'press');
                  setSelectedAccountId(item.account.id);
                  setShowAccountOverviewPicker(false);
                }}
              >
                <Text style={styles.accountOverviewName}>{item.account.name}</Text>
                <Text style={[styles.accountOverviewValue, item.balance < 0 && styles.negative]}>
                  {formatCurrency(item.balance, item.account.currency)}
                </Text>
                <Text style={styles.accountOverviewMeta}>In {formatCurrency(item.income, item.account.currency)}</Text>
                <Text style={styles.accountOverviewMeta}>Out {formatCurrency(item.expense, item.account.currency)}</Text>
                {(item.transferIn > 0 || item.transferOut > 0) && (
                  <Text style={{ color: '#a855f7', fontSize: 11, marginTop: 1 }}>↔ {formatCurrency(item.transferIn + item.transferOut, item.account.currency)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </>
  );
}
