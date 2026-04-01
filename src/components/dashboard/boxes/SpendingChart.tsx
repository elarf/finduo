import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useDashboard } from '../../../context/DashboardContext';
import { styles } from '../../../screens/DashboardScreen.styles';
import { uiPath, uiProps, logUI } from '../../../lib/devtools';

export default function SpendingChart() {
  const {
    spendingCollapsed, setSpendingCollapsed,
    categorySpendData,
    selectedCategoryFilter, setSelectedCategoryFilter,
    desktopView,
    overviewSummary,
    formatCurrency,
  } = useDashboard();

  return (
    <>
      <View {...uiProps(uiPath('dashboard', 'spending_chart', 'container'))} style={[styles.cardStrong, { marginBottom: 18 }]}>
        <TouchableOpacity
          {...uiProps(uiPath('dashboard', 'spending_chart', 'header'))}
          style={[styles.cardCollapseHeader, { marginBottom: spendingCollapsed ? 0 : 12 }]}
          onPress={() => setSpendingCollapsed((p) => !p)}
          activeOpacity={0.7}
        >
          <Text style={styles.cardStrongLabel}>SPENDING BY CATEGORY</Text>
          <View style={styles.cardCollapseHeaderRight}>
            {selectedCategoryFilter && !spendingCollapsed && (
              <TouchableOpacity
                {...uiProps(uiPath('dashboard', 'spending_chart', 'clear_filter_btn'))}
                onPress={(e) => { e.stopPropagation?.(); setSelectedCategoryFilter(null); }}
              >
                <Text style={styles.linkAction}>✕ Clear</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.collapseChevron}>{spendingCollapsed ? '▸' : '▾'}</Text>
          </View>
        </TouchableOpacity>
        {!spendingCollapsed && (
          categorySpendData.length === 0 ? (
            <Text style={styles.emptyText}>No expense data in this interval.</Text>
          ) : (
            <>
              {categorySpendData.map((row) => {
                const isActive = selectedCategoryFilter === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    {...uiProps(uiPath('dashboard', 'spending_chart', 'category_row', row.id))}
                    style={[styles.spendRow, isActive && styles.spendRowActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      logUI(uiPath('dashboard', 'spending_chart', 'category_row', row.id), 'press');
                      setSelectedCategoryFilter(isActive ? null : row.id);
                    }}
                  >
                    <View style={styles.spendLabelRow}>
                      <Text style={[styles.spendName, isActive && styles.spendNameActive]}>{row.name}</Text>
                      <Text style={styles.spendAmount}>{formatCurrency(row.total)}</Text>
                    </View>
                    <View style={styles.spendBarTrack}>
                      <View style={[styles.spendBarFill, { width: `${row.widthPercent}%` }, row.color ? { backgroundColor: row.color } : undefined, isActive && styles.spendBarFillActive]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )
        )}
      </View>

      {/* Desktop battery chart */}
      {desktopView && (() => {
        const totalAvailable = overviewSummary.openingBalance + overviewSummary.income;
        const spent = overviewSummary.expense;
        const transferred = overviewSummary.transferOut;
        const remaining = totalAvailable - spent - transferred;
        const spentPct = totalAvailable > 0 ? Math.min(100, Math.round((spent / totalAvailable) * 100)) : 0;
        const transferPct = totalAvailable > 0 ? Math.min(100 - spentPct, Math.round((transferred / totalAvailable) * 100)) : 0;
        const unspentPct = 100 - spentPct - transferPct;
        return (
          <View {...uiProps(uiPath('dashboard', 'spending_chart', 'battery_bar'))} style={styles.batteryWrap}>
            <View style={styles.batteryTrack}>
              {totalAvailable <= 0 ? (
                <View style={[styles.batterySegmentUnspent, { flex: 1 }]}>
                  <Text style={styles.batterySegLabel}>No data</Text>
                </View>
              ) : (
                <>
                  {spentPct > 0 && (
                    <View style={[styles.batterySegmentSpent, { flex: spentPct }]}>
                      {spentPct >= 12 && <Text style={styles.batterySegLabel}>{spentPct}%</Text>}
                    </View>
                  )}
                  {transferPct > 0 && (
                    <View style={[styles.batterySegmentTransfer, { flex: transferPct }]}>
                      {transferPct >= 12 && <Text style={styles.batterySegLabel}>{transferPct}%</Text>}
                    </View>
                  )}
                  {unspentPct > 0 && (
                    <View style={[styles.batterySegmentUnspent, { flex: unspentPct }]}>
                      {unspentPct >= 12 && <Text style={styles.batterySegLabel}>{unspentPct}%</Text>}
                    </View>
                  )}
                </>
              )}
            </View>
            <View {...uiProps(uiPath('dashboard', 'spending_chart', 'battery_legend'))} style={styles.batteryLegend}>
              <View style={styles.batteryLegendItem}>
                <View style={[styles.batteryLegendDot, { backgroundColor: '#f87171' }]} />
                <Text style={styles.batteryLegendText}>Spent {formatCurrency(spent)} ({spentPct}%)</Text>
              </View>
              {transferred > 0 && (
                <View style={styles.batteryLegendItem}>
                  <View style={[styles.batteryLegendDot, { backgroundColor: '#a855f7' }]} />
                  <Text style={styles.batteryLegendText}>Transferred {formatCurrency(transferred)} ({transferPct}%)</Text>
                </View>
              )}
              <View style={styles.batteryLegendItem}>
                <View style={[styles.batteryLegendDot, { backgroundColor: '#53E3A6' }]} />
                <Text style={styles.batteryLegendText}>Remaining {formatCurrency(Math.max(0, remaining))} ({unspentPct}%)</Text>
              </View>
            </View>
          </View>
        );
      })()}
    </>
  );
}
