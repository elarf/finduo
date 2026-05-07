import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform,
} from 'react-native';
import type { User } from '@supabase/supabase-js';
import type { FinGoAsset, AssetPart, ComponentNode, ComponentServiceInterval, Component, UsageLog, UsageEntry } from '../../types/fingo';
import type { AppCategory, AppTransaction } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import PartHealthBar from './PartHealthBar';
import UsageLogModal from './UsageLogModal';
import AssetCategoryPicker from './AssetCategoryPicker';
import ComponentRow from './ComponentRow';
import ComponentActionSheet from './ComponentActionSheet';
import type { ComponentActionType } from './ComponentActionSheet';
import { computePartHealth } from '../../lib/fingo/health';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type Props = {
  asset: FinGoAsset;
  user: User | null;
  parts: AssetPart[];
  componentTree: ComponentNode[];
  intervals: Record<string, ComponentServiceInterval[]>;
  linkedCategoryIds: string[];
  transactions: AppTransaction[];
  usageLogs: UsageLog[];
  categories: AppCategory[];
  onLogUsage: (entry: UsageEntry) => Promise<void>;
  onServicePart: (part: AssetPart) => void;
  onLinkCategory: (categoryId: string) => void;
  onUnlinkCategory: (categoryId: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onEditAsset: (asset: FinGoAsset) => void;
  onComponentAction: (action: ComponentActionType, component: Component) => void;
  onAddComponent: (parentId: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
};

type ActiveTab = 'parts' | 'stats' | 'logs';

export default function AssetAccordion({
  asset,
  user,
  parts,
  componentTree,
  intervals,
  linkedCategoryIds,
  transactions,
  usageLogs,
  categories,
  onLogUsage,
  onServicePart,
  onLinkCategory,
  onUnlinkCategory,
  onDeleteAsset,
  onEditAsset,
  onComponentAction,
  onAddComponent,
  expanded,
  onToggle,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('parts');
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [actionSheetComp, setActionSheetComp] = useState<Component | null>(null);

  const isOwner = asset.created_by === user?.id;
  const { formatCurrency } = useDashboard();

  // Total money spent via linked categories
  const totalSpent = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleDeleteAsset = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${asset.name}"? This cannot be undone.`)) {
        onDeleteAsset(asset.id);
      }
    } else {
      Alert.alert('Delete asset', `Delete "${asset.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteAsset(asset.id) },
      ]);
    }
  };

  return (
    <View {...uiProps(uiPath('fingo', 'asset_accordion', 'container', asset.id))}>
      {/* Header row */}
      <TouchableOpacity
        {...uiProps(uiPath('fingo', 'asset_accordion', 'header', asset.id))}
        style={styles.header}
        onPress={() => {
          logUI(uiPath('fingo', 'asset_accordion', 'header', asset.id), 'press');
          onToggle();
        }}
      >
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.assetName}>{asset.name}</Text>
          <Text style={styles.assetMeta}>
            {asset.type} · {asset.current_usage.toLocaleString()} {asset.usage_unit}
          </Text>
        </View>
        <TouchableOpacity
          {...uiProps(uiPath('fingo', 'asset_accordion', 'log_button', asset.id))}
          style={styles.logButton}
          onPress={(e) => {
            e.stopPropagation?.();
            logUI(uiPath('fingo', 'asset_accordion', 'log_button', asset.id), 'press');
            setShowUsageModal(true);
          }}
        >
          <Text style={styles.logButtonText}>＋</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.body}>
          {/* Tab bar */}
          <View style={styles.tabs}>
            {(['parts', 'stats', 'logs'] as ActiveTab[]).map((tab) => (
              <TouchableOpacity
                {...uiProps(uiPath('fingo', 'asset_accordion', 'tab', tab))}
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => {
                  logUI(uiPath('fingo', 'asset_accordion', 'tab', tab), 'press');
                  setActiveTab(tab);
                }}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'parts' ? 'Parts' : tab === 'stats' ? 'Stats' : 'Logs'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab: Parts */}
          {activeTab === 'parts' && (
            <View>
              {componentTree.length === 0 ? (
                <Text style={styles.emptyText}>No components yet.</Text>
              ) : (
                componentTree.map((node) => (
                  <ComponentRow
                    key={node.component.id}
                    node={node}
                    depth={0}
                    assetId={asset.id}
                    assetType={asset.type}
                    intervals={intervals}
                    onShowActions={setActionSheetComp}
                    onAddChild={(parentId) => onAddComponent(parentId)}
                  />
                ))
              )}
              <TouchableOpacity
                {...uiProps(uiPath('fingo', 'asset_accordion', 'add_component', asset.id))}
                style={styles.addComponentBtn}
                onPress={() => {
                  logUI(uiPath('fingo', 'asset_accordion', 'add_component', asset.id), 'press');
                  onAddComponent(null);
                }}
              >
                <Text style={styles.addComponentText}>+ Add Component</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab: Stats */}
          {activeTab === 'stats' && (
            <View>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {asset.current_usage.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>{asset.usage_unit} total</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {formatCurrency(totalSpent)}
                  </Text>
                  <Text style={styles.statLabel}>total spent</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{transactions.length}</Text>
                  <Text style={styles.statLabel}>transactions</Text>
                </View>
              </View>

              <TouchableOpacity
                {...uiProps(uiPath('fingo', 'asset_accordion', 'manage_categories_button', asset.id))}
                style={styles.manageCatButton}
                onPress={() => {
                  logUI(uiPath('fingo', 'asset_accordion', 'manage_categories_button', asset.id), 'press');
                  setShowCategoryPicker(true);
                }}
              >
                <Text style={styles.manageCatText}>
                  Linked categories: {linkedCategoryIds.length} · Manage
                </Text>
              </TouchableOpacity>

              {transactions.slice(0, 10).map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <Text style={styles.txDate}>{tx.date}</Text>
                  <Text style={styles.txNote} numberOfLines={1}>{tx.note ?? '—'}</Text>
                  <Text style={[styles.txAmount, tx.type === 'income' ? styles.income : styles.expense]}>
                    {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Tab: Owner actions */}
          {activeTab === 'logs' && (
            <View>
              <Text style={styles.sectionLabel}>Usage History</Text>
              {usageLogs.length === 0 ? (
                <Text style={styles.emptyText}>No usage logged yet.</Text>
              ) : (
                usageLogs.map((log) => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={styles.logLeft}>
                      <Text style={styles.logDate}>
                        {new Date(log.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      {log.notes ? <Text style={styles.logNotes} numberOfLines={1}>{log.notes}</Text> : null}
                    </View>
                    <View style={styles.logRight}>
                      {asset.type === 'shoe' ? (
                        <>
                          <Text style={styles.logDelta}>+{log.usage_delta.toLocaleString()} steps</Text>
                          <Text style={styles.logTotal}>{log.usage_after.toLocaleString()} total</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.logDelta}>+{log.usage_delta.toLocaleString()} km</Text>
                          {log.moving_time_delta != null && (
                            <Text style={styles.logMeta}>
                              {log.moving_time_delta < 60
                                ? `${log.moving_time_delta} min`
                                : `${Math.floor(log.moving_time_delta / 60)}h ${log.moving_time_delta % 60 > 0 ? `${log.moving_time_delta % 60}m` : ''}`}
                            </Text>
                          )}
                          {asset.type === 'bike' && log.elevation_delta != null && (
                            <Text style={styles.logMeta}>+{log.elevation_delta.toLocaleString()} m elev</Text>
                          )}
                          <Text style={styles.logTotal}>{log.usage_after.toLocaleString()} km total</Text>
                        </>
                      )}
                    </View>
                  </View>
                ))
              )}
              {isOwner && (
                <View style={styles.ownerActions}>
                  <TouchableOpacity
                    {...uiProps(uiPath('fingo', 'asset_accordion', 'edit_button', asset.id))}
                    style={styles.editButton}
                    onPress={() => {
                      logUI(uiPath('fingo', 'asset_accordion', 'edit_button', asset.id), 'press');
                      onEditAsset(asset);
                    }}
                  >
                    <Text style={styles.editButtonText}>✎ Edit Asset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    {...uiProps(uiPath('fingo', 'asset_accordion', 'delete_button', asset.id))}
                    style={styles.deleteButton}
                    onPress={() => {
                      logUI(uiPath('fingo', 'asset_accordion', 'delete_button', asset.id), 'press');
                      handleDeleteAsset();
                    }}
                  >
                    <Text style={styles.deleteButtonText}>✕ Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <UsageLogModal
        visible={showUsageModal}
        asset={asset}
        onClose={() => setShowUsageModal(false)}
        onSubmit={onLogUsage}
      />

      <AssetCategoryPicker
        visible={showCategoryPicker}
        categories={categories}
        linkedCategoryIds={linkedCategoryIds}
        onLink={onLinkCategory}
        onUnlink={onUnlinkCategory}
        onClose={() => setShowCategoryPicker(false)}
      />

      <ComponentActionSheet
        visible={!!actionSheetComp}
        component={actionSheetComp}
        onAction={(action: ComponentActionType, component: Component) => {
          setActionSheetComp(null);
          onComponentAction(action, component);
        }}
        onClose={() => setActionSheetComp(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1A2B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 12,
    marginBottom: 2,
    gap: 8,
  },
  chevron: {
    color: '#8FA8C9',
    fontSize: 12,
    fontWeight: '700',
    width: 14,
  },
  headerInfo: {
    flex: 1,
  },
  assetName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  assetMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 1,
  },
  logButton: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#0D2137',
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonText: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  body: {
    backgroundColor: '#07111F',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#1F3A59',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0D2137',
    borderColor: '#3B6A9E',
  },
  tabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#8FA8C9',
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 8,
    alignItems: 'center',
  },
  statValue: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
  manageCatButton: {
    borderWidth: 1,
    borderStyle: 'dashed' as any,
    borderColor: '#1F3A59',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  manageCatText: {
    color: '#3B6A9E',
    fontSize: 12,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  txDate: {
    color: '#475569',
    fontSize: 11,
    width: 72,
  },
  txNote: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
  },
  txAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  income: { color: '#4ade80' },
  expense: { color: '#f87171' },
  sectionLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  logLeft: {
    flex: 1,
  },
  logDate: {
    color: '#64748B',
    fontSize: 12,
  },
  logNotes: {
    color: '#475569',
    fontSize: 11,
    marginTop: 1,
  },
  logRight: {
    alignItems: 'flex-end',
  },
  logDelta: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  logMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  logTotal: {
    color: '#475569',
    fontSize: 11,
    marginTop: 1,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#8FA8C9',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  addComponentBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  addComponentText: {
    color: '#3B6A9E',
    fontSize: 13,
    fontWeight: '600',
  },
});
