import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform, Image, ImageSourcePropType, Modal,
} from 'react-native';
import ComponentIcon from './ComponentIcon';
import type { User } from '@supabase/supabase-js';
  FinGoAsset, AssetPart, AssetType, ComponentNode,
  ComponentServiceInterval, Component, UsageLog, UsageEntry,
} from '../../types/fingo';
import type { AppCategory, AppTransaction } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import UsageLogModal from './UsageLogModal';
import AssetCategoryPicker from './AssetCategoryPicker';
import ComponentActionSheet from './ComponentActionSheet';
import type { ComponentActionType } from './ComponentActionSheet';
import {
  computeIntervalHealth, healthColor, formatIntervalRemaining, worstIntervalHealth,
} from '../../lib/fingo/health';
import { getComponentIcon } from '../../lib/fingo/componentIcons';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

const ASSET_ICONS: Record<AssetType, ImageSourcePropType> = {
  vehicle:   require('../../../assets/car.png'),
  motorbike: require('../../../assets/emoto.png'),
  bike:      require('../../../assets/ebike.png'),
  shoe:      require('../../../assets/shoes.png'),
  other:     require('../../../assets/car.png'),
};

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
  onIntervalAction: (action: 'edit' | 'delete', interval: ComponentServiceInterval, component: Component) => void;
  onAddComponent: (parentId: string | null) => void;
  onComponentPress: (component: Component) => void;
  onIntervalPress: (interval: ComponentServiceInterval, component: Component) => void;
  onAddService: () => void;
  expanded: boolean;
  onToggle: () => void;
  headerOnly?: boolean;
  bodyOnly?: boolean;
};

function formatMovingTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function flattenTree(nodes: ComponentNode[]): { component: Component; depth: number }[] {
  const result: { component: Component; depth: number }[] = [];
  const walk = (ns: ComponentNode[], depth: number) => {
    for (const n of ns) {
      result.push({ component: n.component, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return result;
}

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
  onIntervalAction,
  onAddComponent,
  onComponentPress,
  onIntervalPress,
  onAddService,
  expanded,
  onToggle,
  headerOnly = false,
  bodyOnly = false,
}: Props) {
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAssetActions, setShowAssetActions] = useState(false);
  const [actionSheetComp, setActionSheetComp] = useState<Component | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);

  const isOwner = asset.created_by === user?.id;
  const { formatCurrency } = useDashboard();

  const totalSpent = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // All intervals flat, each paired with their component
  const allIntervals: { interval: ComponentServiceInterval; component: Component }[] = [];
  for (const { component } of flattenTree(componentTree)) {
    for (const interval of (intervals[component.id] ?? [])) {
      allIntervals.push({ interval, component });
    }
  }

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
      {!bodyOnly && (
      <TouchableOpacity
        {...uiProps(uiPath('fingo', 'asset_accordion', 'header', asset.id))}
        style={[styles.header, expanded && styles.headerExpanded]}
        onPress={() => {
          logUI(uiPath('fingo', 'asset_accordion', 'header', asset.id), 'press');
          onToggle();
        }}
      >
        <Image source={ASSET_ICONS[asset.type]} style={styles.assetTypeIcon} resizeMode="contain" />
        <View style={styles.headerInfo}>
          <Text style={styles.assetName}>{asset.name}</Text>
          <View style={styles.headerStats}>
            {asset.type === 'shoe' ? (
              <>
                {asset.total_steps > 0 && (
                  <Text style={styles.statChip}>👟 {asset.total_steps.toLocaleString()} steps</Text>
                )}
                {asset.total_moving_time > 0 && (
                  <Text style={styles.statChip}>⏱ {formatMovingTime(asset.total_moving_time)}</Text>
                )}
              </>
            ) : (
              <>
                {asset.total_distance > 0 && (
                  <Text style={styles.statChip}>↔ {asset.total_distance.toLocaleString()} km</Text>
                )}
                {asset.total_moving_time > 0 && (
                  <Text style={styles.statChip}>⏱ {formatMovingTime(asset.total_moving_time)}</Text>
                )}
                {asset.total_rides > 0 && (
                  <Text style={styles.statChip}>↺ {asset.total_rides.toLocaleString()}</Text>
                )}
                {asset.total_elevation > 0 && (
                  <Text style={styles.statChip}>▲ {asset.total_elevation.toLocaleString()} m</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Asset "..." actions */}
        {isOwner && (
          <TouchableOpacity
            style={styles.dotsButton}
            onPress={(e) => {
              e.stopPropagation?.();
              setShowAssetActions(true);
            }}
            hitSlop={8}
          >
            <Text style={styles.dotsText}>•••</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>

        {/* Quick log usage button */}
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
      )}

      {/* Expanded body — section-based layout (no tabs) */}
      {!headerOnly && expanded && (
        <View style={styles.body}>

          {/* ── Components ─────────────────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Components</Text>
            <TouchableOpacity
              style={styles.sectionAddBtn}
              onPress={() => onAddComponent(null)}
            >
              <Text style={styles.sectionAddText}>＋</Text>
            </TouchableOpacity>
          </View>

          {componentTree.length === 0 ? (
            <Text style={styles.emptyText}>No components yet. Tap + to add one.</Text>
          ) : (
            componentTree.map((node) => {
              const comp = node.component;
              const compIntervals = intervals[comp.id] ?? [];
              const worst = worstIntervalHealth(compIntervals, comp);
              const dotColor = worst ? healthColor(worst.remaining / worst.interval.interval_value) : '#4ade80';
              const childCount = node.children.length;
              return (
                <TouchableOpacity
                  key={comp.id}
                  style={styles.componentRow}
                  onPress={() => onComponentPress(comp)}
                  activeOpacity={0.7}
                >
                  {worst && (
                    <View style={[styles.healthDot, { backgroundColor: dotColor }]} />
                  )}
                  <ComponentIcon
                    name={getComponentIcon(comp.name, comp.template_key)}
                    size={16}
                    color="#3B6A9E"
                  />
                  <View style={styles.componentRowBody}>
                    <Text style={styles.componentName}>{comp.name}</Text>
                    {childCount > 0 && (
                      <Text style={styles.componentMeta}>{childCount} part{childCount > 1 ? 's' : ''}</Text>
                    )}
                    {compIntervals.length > 0 && (
                      <Text style={styles.componentMeta}>{compIntervals.length} interval{compIntervals.length > 1 ? 's' : ''}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.componentActionBtn}
                    onPress={(e) => { e.stopPropagation?.(); setActionSheetComp(comp); }}
                    hitSlop={8}
                  >
                    <Text style={styles.componentActionText}>•••</Text>
                  </TouchableOpacity>
                  <Text style={styles.componentChevron}>›</Text>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Service Intervals ──────────────────────────────────────────────── */}
          <View style={[styles.sectionHeader, styles.sectionHeaderMt]}>
            <Text style={styles.sectionTitle}>Service Intervals</Text>
            {allIntervals.length > 0 && (
              <TouchableOpacity
                style={styles.addServiceBtn}
                onPress={onAddService}
              >
                <Text style={styles.addServiceText}>+ Add Service</Text>
              </TouchableOpacity>
            )}
          </View>

          {allIntervals.length === 0 ? (
            <Text style={styles.emptyText}>No intervals yet. Add them per component.</Text>
          ) : (
            allIntervals.map(({ interval, component }) => {
              const health = computeIntervalHealth(interval, component);
              const color = healthColor(health.remaining / interval.interval_value);
              return (
                <TouchableOpacity
                  key={interval.id}
                  style={styles.intervalRow}
                  onPress={() => onIntervalPress(interval, component)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.healthDot, { backgroundColor: color }]} />
                  <View style={styles.intervalRowBody}>
                    <Text style={styles.intervalName}>{interval.name}</Text>
                    <Text style={styles.intervalComponentLabel}>{component.name}</Text>
                  </View>
                  <Text style={[styles.intervalRemaining, { color }]}>
                    {formatIntervalRemaining(health)}
                  </Text>
                  <Text style={styles.componentChevron}>›</Text>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Stats (collapsible) ────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.sectionHeader, styles.sectionHeaderMt]}
            onPress={() => setStatsExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Stats</Text>
            <Text style={styles.chevron}>{statsExpanded ? '▾' : '▸'}</Text>
          </TouchableOpacity>

          {statsExpanded && (
            <View>
              <View style={styles.statBoxRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{asset.current_usage.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>{asset.usage_unit} total</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{formatCurrency(totalSpent)}</Text>
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

              {transactions.length === 0 ? (
                <Text style={styles.emptyText}>No transactions linked yet.</Text>
              ) : (
                transactions.map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <Text style={styles.txDate}>{tx.date}</Text>
                    <Text style={styles.txNote} numberOfLines={1}>{tx.note ?? '—'}</Text>
                    <Text style={[styles.txAmount, tx.type === 'income' ? styles.income : styles.expense]}>
                      {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── Rides ─────────────────────────────────────────────────────────── */}
          <View style={[styles.sectionHeader, styles.sectionHeaderMt]}>
            <Text style={styles.sectionTitle}>Rides</Text>
            <TouchableOpacity
              style={styles.sectionAddBtn}
              onPress={() => setShowUsageModal(true)}
            >
              <Text style={styles.sectionAddText}>＋</Text>
            </TouchableOpacity>
          </View>

          {usageLogs.length === 0 ? (
            <Text style={styles.emptyText}>No rides logged yet.</Text>
          ) : (
            usageLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <Text style={styles.logDate}>
                    {new Date(log.recorded_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </Text>
                  {log.notes ? (
                    <Text style={styles.logNotes} numberOfLines={1}>{log.notes}</Text>
                  ) : null}
                </View>
                <View style={styles.logRight}>
                  {asset.type === 'shoe' ? (
                    <Text style={styles.logDelta}>+{log.usage_delta.toLocaleString()} steps</Text>
                  ) : (
                    <>
                      <Text style={styles.logDelta}>+{log.usage_delta.toLocaleString()} km</Text>
                      {log.moving_time_delta != null && (
                        <Text style={styles.logMeta}>{formatMovingTime(log.moving_time_delta)}</Text>
                      )}
                      {asset.type === 'bike' && log.elevation_delta != null && (
                        <Text style={styles.logMeta}>+{log.elevation_delta.toLocaleString()} m</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────────── */}
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

      {/* Asset actions sheet */}
      <Modal
        visible={showAssetActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssetActions(false)}
      >
        <TouchableOpacity
          style={styles.assetActionsBackdrop}
          activeOpacity={1}
          onPress={() => setShowAssetActions(false)}
        />
        <View style={styles.assetActionsSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.assetActionsTitle} numberOfLines={1}>{asset.name}</Text>
          <TouchableOpacity
            style={styles.assetActionRow}
            onPress={() => { setShowAssetActions(false); onEditAsset(asset); }}
          >
            <Text style={styles.assetActionText}>✎  Edit Asset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.assetActionRow}
            onPress={() => { setShowAssetActions(false); handleDeleteAsset(); }}
          >
            <Text style={[styles.assetActionText, styles.destructiveText]}>✕  Delete Asset</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    marginBottom: 2,
    overflow: 'hidden',
    maxHeight: 80,
  },
  headerExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  assetTypeIcon: {
    width: 64,
    alignSelf: 'stretch',
    maxHeight: 80,
  },
  headerInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
    justifyContent: 'center',
  },
  assetName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statChip: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  dotsButton: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  dotsText: {
    color: '#475569',
    fontSize: 12,
    letterSpacing: 1,
    transform: [{ rotate: '90deg' }],
  },
  chevron: {
    color: '#8FA8C9',
    fontSize: 12,
    fontWeight: '700',
    width: 14,
    textAlign: 'center',
    alignSelf: 'center',
    marginRight: 4,
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
    alignSelf: 'center',
    marginRight: 10,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderMt: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectionAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#0D2137',
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAddText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
  // Component rows
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 5,
    gap: 8,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  componentRowBody: {
    flex: 1,
  },
  componentName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  componentMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  componentActionBtn: {
    paddingHorizontal: 4,
  },
  componentActionText: {
    color: '#475569',
    fontSize: 12,
    letterSpacing: 1,
    transform: [{ rotate: '90deg' }],
  },
  componentChevron: {
    color: '#3B6A9E',
    fontSize: 18,
    fontWeight: '300',
  },
  // Interval rows
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 5,
    gap: 8,
  },
  intervalRowBody: {
    flex: 1,
  },
  intervalName: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  intervalComponentLabel: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  intervalRemaining: {
    fontSize: 11,
    fontWeight: '700',
  },
  addServiceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  addServiceText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  // Stats section
  statBoxRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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
    fontSize: 15,
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
  // Ride log rows
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  logLeft: { flex: 1 },
  logDate: { color: '#64748B', fontSize: 12 },
  logNotes: { color: '#475569', fontSize: 11, marginTop: 1 },
  logRight: { alignItems: 'flex-end' },
  logDelta: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  logMeta: { color: '#64748B', fontSize: 11, marginTop: 1 },
  // Asset actions modal
  assetActionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  assetActionsSheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    paddingBottom: 40,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginTop: 8,
    marginBottom: 4,
  },
  assetActionsTitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  assetActionRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  assetActionText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#f87171',
  },
});
