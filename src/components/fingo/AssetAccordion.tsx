import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform, Image, ImageSourcePropType, Modal,
} from 'react-native';
import ComponentIcon from './ComponentIcon';
import AssetJournal from './AssetJournal';
import ServiceRecordSheet from './ServiceRecordSheet';
import type { User } from '@supabase/supabase-js';
import type {
  FinGoAsset, AssetPart, AssetType, ComponentNode,
  ComponentServiceInterval, ServiceIntervalType, Component, UsageLog, UsageEntry, ComponentServiceRecord,
} from '../../types/fingo';import type { AppCategory, AppTransaction } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import UsageLogModal from './UsageLogModal';
import AssetCategoryPicker from './AssetCategoryPicker';
import ComponentActionSheet from './ComponentActionSheet';
import type { ComponentActionType } from './ComponentActionSheet';
import {
  computeIntervalHealthFromLogs, healthColor, formatIntervalRemaining, worstIntervalHealth,
} from '../../lib/fingo/health';
import { getComponentIcon } from '../../lib/fingo/componentIcons';
import { FINGO_ASSETS } from '../../lib/fingo/fingoAssets';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

const ASSET_ICONS: Record<AssetType, ImageSourcePropType> = {
  vehicle:   require('../../../assets/car.png'),
  motorbike: require('../../../assets/emoto.png'),
  bike:      require('../../../assets/ebike.png'),
  shoe:      require('../../../assets/shoes.png'),
  other:     require('../../../assets/car.png'),
};

const SERVICE_TYPE_ICONS: Record<ServiceIntervalType, any> = {
  general:  FINGO_ASSETS.fix,
  replace:  FINGO_ASSETS.change,
  cleaning: FINGO_ASSETS.wipe,
  charge:   FINGO_ASSETS.charge,
  pump:     FINGO_ASSETS.pressure,
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
  serviceRecords?: ComponentServiceRecord[];
  categories: AppCategory[];
  onLogUsage: (entry: UsageEntry) => Promise<void>;
  onEditLog: (log: UsageLog, entry: UsageEntry) => Promise<void>;
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
  onEditServiceRecord?: (record: ComponentServiceRecord, name: string, servicedAt: string, notes: string | null, cost: number | null) => Promise<void>;
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
  serviceRecords = [],
  categories,
  onLogUsage,
  onEditLog,
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
  onEditServiceRecord,
  expanded,
  onToggle,
  headerOnly = false,
  bodyOnly = false,
}: Props) {
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [editingLog, setEditingLog] = useState<UsageLog | null>(null);
  const [editingServiceRecord, setEditingServiceRecord] = useState<ComponentServiceRecord | null>(null);
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
    <View {...uiProps(uiPath('fingo', 'asset_accordion', 'container', asset.id))} style={styles.container}>
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
          <View style={styles.assetNameRow}>
            <Text style={styles.assetName}>{asset.name}</Text>
            {asset.is_active && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>active</Text>
              </View>
            )}
          </View>
          <View style={styles.headerStats}>
            {asset.type === 'shoe' ? (
              <>
                {asset.total_steps > 0 && (
                  <View style={styles.statChip}>
                    <Image source={FINGO_ASSETS.step} style={styles.statChipIcon} resizeMode="contain" />
                    <Text style={styles.statChipText}>{asset.total_steps.toLocaleString()} steps</Text>
                  </View>
                )}
                {asset.total_moving_time > 0 && (
                  <View style={styles.statChip}>
                    <Image source={FINGO_ASSETS.time} style={styles.statChipIcon} resizeMode="contain" />
                    <Text style={styles.statChipText}>{formatMovingTime(asset.total_moving_time)}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {asset.total_distance > 0 && (
                  <View style={styles.statChip}>
                    <Image source={FINGO_ASSETS.route} style={styles.statChipIcon} resizeMode="contain" />
                    <Text style={styles.statChipText}>{asset.total_distance.toLocaleString()} km</Text>
                  </View>
                )}
                {asset.total_moving_time > 0 && (
                  <View style={styles.statChip}>
                    <Image source={FINGO_ASSETS.time} style={styles.statChipIcon} resizeMode="contain" />
                    <Text style={styles.statChipText}>{formatMovingTime(asset.total_moving_time)}</Text>
                  </View>
                )}
                {asset.total_rides > 0 && (
                  <View style={styles.statChip}>
                    <Image source={FINGO_ASSETS.ride} style={styles.statChipIcon} resizeMode="contain" />
                    <Text style={styles.statChipText}>{asset.total_rides.toLocaleString()}</Text>
                  </View>
                )}
                {asset.total_elevation > 0 && (
                  <Text style={styles.statChipText}>▲ {asset.total_elevation.toLocaleString()} m</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Asset "..." actions */}
        {isOwner && (
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'asset_accordion', 'asset_dots_button', asset.id))}
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
          <Image source={FINGO_ASSETS.add} style={styles.logButtonIcon} resizeMode="contain" />
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
              {...uiProps(uiPath('fingo', 'asset_accordion', 'add_component_button', asset.id))}
              style={styles.sectionAddBtn}
              onPress={() => onAddComponent(null)}
            >
              <Image source={FINGO_ASSETS.add} style={styles.sectionAddIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          {componentTree.length === 0 ? (
            <Text style={styles.emptyText}>No components yet. Tap + to add one.</Text>
          ) : (
            componentTree.map((node) => {
              const comp = node.component;
              const compIntervals = intervals[comp.id] ?? [];
              const worst = worstIntervalHealth(compIntervals, comp, usageLogs);
              const dotColor = worst ? healthColor(worst.remaining / worst.interval.interval_value) : '#4ade80';
              const childCount = node.children.length;
              return (
                <TouchableOpacity
                  key={comp.id}
                  {...uiProps(uiPath('fingo', 'asset_accordion', 'component_card', comp.id))}
                  style={styles.componentRow}
                  onPress={() => onComponentPress(comp)}
                  activeOpacity={0.7}
                >
                  <View style={styles.componentIconWrap}>
                    <ComponentIcon
                      name={getComponentIcon(comp.name, comp.template_key)}
                      size={44}
                      color="#3B6A9E"
                      stretch
                    />
                  </View>
                  {worst && (
                    <View style={[styles.healthDot, { backgroundColor: dotColor }]} />
                  )}
                  <View style={styles.componentRowBody}>
                    <Text style={styles.componentName}>{comp.name}</Text>
                  </View>
                  <View style={styles.componentMetaCounts}>
                    <View style={styles.componentMetaChip}>
                      <Text style={styles.componentMeta}>{childCount}</Text>
                      <Image source={FINGO_ASSETS.gear} style={styles.componentMetaIcon} resizeMode="contain" />
                    </View>
                    <View style={styles.componentMetaChip}>
                      <Text style={styles.componentMeta}>{compIntervals.length}</Text>
                      <Image source={FINGO_ASSETS.fix} style={styles.componentMetaIcon} resizeMode="contain" />
                    </View>
                  </View>
                  <TouchableOpacity
                    {...uiProps(uiPath('fingo', 'asset_accordion', 'component_action_button', comp.id))}
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
                {...uiProps(uiPath('fingo', 'asset_accordion', 'add_service_button', asset.id))}
                style={styles.addServiceBtn}
                onPress={onAddService}
              >
                <Image source={FINGO_ASSETS.fix} style={styles.addServiceIcon} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>

          {allIntervals.length === 0 ? (
            <Text style={styles.emptyText}>No intervals yet. Add them per component.</Text>
          ) : (
            allIntervals.map(({ interval, component }) => {
              const health = computeIntervalHealthFromLogs(interval, component, usageLogs, interval.last_serviced_at ?? null);
              const color = healthColor(health.remaining / interval.interval_value);
              return (
                <TouchableOpacity
                  key={interval.id}
                  {...uiProps(uiPath('fingo', 'asset_accordion', 'interval_card', interval.id))}
                  style={styles.intervalRow}
                  onPress={() => onIntervalPress(interval, component)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={SERVICE_TYPE_ICONS[interval.service_type ?? 'general']}
                    style={styles.intervalTypeIcon}
                    resizeMode="contain"
                  />
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
            {...uiProps(uiPath('fingo', 'asset_accordion', 'stats_toggle', asset.id))}
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

          {/* ── Journal (Rides & Services) ───────────────────────────────── */}
          <View style={[styles.sectionHeader, styles.sectionHeaderMt]}>
            <Text style={styles.sectionTitle}>Journal</Text>
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'asset_accordion', 'add_ride_button', asset.id))}
              style={styles.sectionAddBtn}
              onPress={() => setShowUsageModal(true)}
            >
              <Image source={FINGO_ASSETS.add} style={styles.sectionAddIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          <AssetJournal
            usageLogs={usageLogs}
            serviceRecords={serviceRecords}
            assetType={asset.type}
            onRidePress={(log) => setEditingLog(log)}
            onServicePress={(rec) => setEditingServiceRecord(rec)}
          />
        </View>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────────── */}
      <UsageLogModal
        visible={showUsageModal || !!editingLog}
        asset={asset}
        editingLog={editingLog}
        onClose={() => { setShowUsageModal(false); setEditingLog(null); }}
        onSubmit={async (entry) => {
          if (editingLog) {
            await onEditLog(editingLog, entry);
          } else {
            await onLogUsage(entry);
          }
        }}
      />

      <ServiceRecordSheet
        visible={!!editingServiceRecord}
        editingRecord={editingServiceRecord ?? undefined}
        onSave={async (name, servicedAt, notes, cost) => {
          if (editingServiceRecord && onEditServiceRecord) {
            await onEditServiceRecord(editingServiceRecord, name, servicedAt, notes ?? null, cost ?? null);
          }
          setEditingServiceRecord(null);
        }}
        onClose={() => setEditingServiceRecord(null)}
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
  container: {
    backgroundColor: '#000000',
  },
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
  assetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetName: {
    color: '#3fe3f2',
    fontSize: 14,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: '#053d1e',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4ade80',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  activeBadgeText: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statChipIcon: {
    width: 11,
    height: 11,
  },
  statChipText: {
    color: '#3fe3f2',
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
    color: '#3fe3f2',
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
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginRight: 10,
  },
  logButtonIcon: {
    width: 22,
    height: 22,
  },
  body: {
    backgroundColor: '#000000',
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
    color: '#3fe3f2',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectionAddBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAddIcon: {
    width: 20,
    height: 20,
  },
  emptyText: {
    color: '#3fe3f2',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
  // Component rows
  componentIconWrap: {
    width: 44,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingRight: 10,
    overflow: 'hidden',
    marginBottom: 5,
    gap: 8,
    minHeight: 44,
    maxHeight: 65,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
    alignSelf: 'center',
  },
  componentRowBody: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  componentMetaCounts: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  componentMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
  },
  componentMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  componentMetaIcon: {
    width: 30,
    height: 30,
  },
  componentName: {
    color: '#3fe3f2',
    fontSize: 14,
    fontWeight: '600',
  },
  componentMeta: {
    color: '#3fe3f2',
    fontSize: 11,
    marginTop: 2,
  },
  componentActionBtn: {
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  componentActionText: {
    color: '#3fe3f2',
    fontSize: 12,
    letterSpacing: 1,
    transform: [{ rotate: '90deg' }],
  },
  componentChevron: {
    color: '#3B6A9E',
    fontSize: 18,
    fontWeight: '300',
    alignSelf: 'center',
  },
  // Interval rows
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingRight: 10,
    overflow: 'hidden',
    marginBottom: 5,
    gap: 8,
    minHeight: 44,
    maxHeight: 65,
  },
  intervalRowBody: {
    flex: 1,
    paddingVertical: 10,
  },
  intervalName: {
    color: '#3fe3f2',
    fontSize: 13,
    fontWeight: '600',
  },
  intervalComponentLabel: {
    color: '#3fe3f2',
    fontSize: 11,
    marginTop: 2,
  },
  intervalRemaining: {
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'center',
  },
  intervalTypeIcon: {
    width: 44,
    alignSelf: 'stretch',
    flexShrink: 0,
    maxHeight: 65,
  },
  addServiceBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addServiceIcon: {
    width: 22,
    height: 22,
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
    color: '#3fe3f2',
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    color: '#3fe3f2',
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
    color: '#3fe3f2',
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
    alignItems: 'stretch',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    maxHeight: 65,
  },
  logRideImage: {
    width: 44,
    alignSelf: 'stretch',
    backgroundColor: '#000000',
    maxHeight: 65,
  },
  logRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    gap: 8,
  },
  logLeft: { flex: 1 },
  logDate: { color: '#64748B', fontSize: 12 },
  logNotes: { color: '#475569', fontSize: 11, marginTop: 1 },
  logRight: { alignItems: 'flex-end' },
  logDelta: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  logMeta: { color: '#64748B', fontSize: 11, marginTop: 1 },
  logEditHint: { color: '#334155', fontSize: 9, marginTop: 2 },
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
    color: '#3fe3f2',
    fontSize: 15,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#f87171',
  },
});
