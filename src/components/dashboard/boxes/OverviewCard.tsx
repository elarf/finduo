import React from 'react';
import { Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { type IntervalKey } from '../../../types/dashboard';
import { styles } from '../../../screens/DashboardScreen.styles';

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
    totalIncludedBalance,
    includedAccountSummaries,
    selectedAccountId, setSelectedAccountId,
  } = useDashboard();

  return (
    <>
      <View style={styles.cardStrong}>
        <Pressable
          disabled={desktopView}
          onPress={() => {
            setShowAccountOverviewPicker((prev) => !prev);
            setSelectedCategoryFilter(null);
          }}
        >
          <View style={styles.cardCollapseHeader}>
            <Text style={styles.cardStrongLabel}>
              {showAccountOverviewPicker ? 'Included Accounts Total' : 'Selected Account Balance'}
            </Text>
            <TouchableOpacity onPress={() => setOverviewCollapsed((p) => !p)}>
              <Text style={styles.collapseChevron}>{overviewCollapsed ? '▸' : '▾'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.cardStrongValue, overviewSummary.net < 0 && styles.negative]}>
            {formatCurrency(overviewSummary.net)}
          </Text>
        </Pressable>
        {!overviewCollapsed && (
          <>
            <Text style={styles.summaryText}>
              Account: {showAccountOverviewPicker ? 'All Included Accounts' : (selectedAccount?.name ?? 'No account selected')}
            </Text>
            {/* Interval pill inline selector */}
            <View style={styles.intervalPillRow}>
              <TouchableOpacity
                style={styles.intervalPill}
                onPress={() => setShowIntervalPicker((p) => !p)}
              >
                <Text style={styles.intervalPillText}>{interval.toUpperCase()} {showIntervalPicker ? '▾' : '▸'}</Text>
              </TouchableOpacity>
            </View>
            {showIntervalPicker && (
              <View style={styles.intervalPickerWrap}>
                <View style={styles.menuChipWrap}>
                  {(['day', 'week', 'month', 'year', 'all', 'custom'] as IntervalKey[]).map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.menuChip, interval === key && styles.menuChipActive]}
                      onPress={() => { setInterval(key); if (key !== 'custom') setShowIntervalPicker(false); }}
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
            <Text style={styles.summaryText}>Opening: <Text style={overviewSummary.openingBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(overviewSummary.openingBalance)}</Text></Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryText, styles.positive]}>Income {formatCurrency(overviewSummary.income)}</Text>
              <Text style={[styles.summaryText, styles.negative]}>Expenses {formatCurrency(overviewSummary.expense)}</Text>
            </View>
            {(overviewSummary.transferIn > 0 || overviewSummary.transferOut > 0) && (
              <View style={styles.summaryRow}>
                {overviewSummary.transferIn > 0 && (
                  <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer in ↔ {formatCurrency(overviewSummary.transferIn)}</Text>
                )}
                {overviewSummary.transferOut > 0 && (
                  <Text style={[styles.summaryText, { color: '#a855f7' }]}>Transfer out ↔ {formatCurrency(overviewSummary.transferOut)}</Text>
                )}
              </View>
            )}
            <Text style={styles.summaryText}>Total Included Balance: <Text style={totalIncludedBalance >= 0 ? styles.positive : styles.negative}>{formatCurrency(totalIncludedBalance)}</Text></Text>
            {!desktopView && includedAccountSummaries.length > 1 && (
              <Text style={styles.summaryText}>
                Tap to {showAccountOverviewPicker ? 'hide accounts' : 'change account'}
              </Text>
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
          <View style={styles.accountOverviewGrid}>
            {includedAccountSummaries.map((item) => (
              <TouchableOpacity
                key={item.account.id}
                style={[
                  styles.accountOverviewCard,
                  selectedAccountId === item.account.id && styles.accountOverviewCardActive,
                ]}
                onPress={() => {
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
