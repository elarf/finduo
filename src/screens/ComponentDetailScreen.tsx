import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Platform, Modal, TextInput, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useComponentSwaps, calcSpeeds } from '../hooks/useComponentSwaps';
import { useServiceIntervals } from '../hooks/useServiceIntervals';
import { useServiceRecords } from '../hooks/useServiceRecords';
import ComponentActionSheet from '../components/fingo/ComponentActionSheet';
import type { ComponentActionType } from '../components/fingo/ComponentActionSheet';
import ComponentLibrarySheet from '../components/fingo/ComponentLibrarySheet';
import ComponentFormSheet from '../components/fingo/ComponentFormSheet';
import ServiceIntervalSheet from '../components/fingo/ServiceIntervalSheet';
import ServiceRecordSheet from '../components/fingo/ServiceRecordSheet';
import { supabase } from '../lib/supabase';
import { logAPI, uiPath, uiProps } from '../lib/devtools';
import { findTemplate } from '../lib/fingo/componentTemplates';
import { getComponentIcon } from '../lib/fingo/componentIcons';
import { computeIntervalHealth, formatIntervalRemaining, healthColor, getTrackingValue } from '../lib/fingo/health';
import { FINGO_ASSETS } from '../lib/fingo/fingoAssets';
import { bottomInset } from '../lib/safeArea';
import { registerBackHandler } from '../lib/capacitorBack';
import type { RootStackParamList } from '../navigation';
import AppHeader from '../components/AppHeader';
import ComponentIcon from '../components/fingo/ComponentIcon';
import type {
  Component, ComponentServiceInterval, ComponentServiceRecord,
  ComponentSwap, UsageLog, FinGoAsset, ComponentTemplate,
} from '../types/fingo';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'>;

function formatMovingTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatLogTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toLocalDateString(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function toInputDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Filter usage logs to only those that fall within a component's swap periods. */
function filterLogsForComponent(logs: UsageLog[], component: Component, swaps: ComponentSwap[]): UsageLog[] {
  if (swaps.length === 0) {
    // No swap history recorded yet — show logs from current installation date onwards
    if (!component.installed_at) return [];
    const since = new Date(component.installed_at);
    return logs.filter((l) => new Date(l.recorded_at) >= since);
  }
  return logs.filter((log) =>
    swaps.some((s) => {
      if (s.asset_id !== log.asset_id) return false;
      const logDate = new Date(log.recorded_at);
      const installedDate = new Date(s.installed_at);
      const removedDate = s.removed_at ? new Date(s.removed_at) : null;
      return logDate >= installedDate && (!removedDate || logDate <= removedDate);
    }),
  );
}

export default function ComponentDetailScreen({ route }: Props) {
  const { componentId, assetId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { bottom } = useSafeAreaInsets();

  // ─── Local data state ────────────────────────────────────────────────────────
  const [component, setComponent] = useState<Component | null>(null);
  const [asset, setAsset] = useState<FinGoAsset | null>(null);
  const [allAssetLogs, setAllAssetLogs] = useState<UsageLog[]>([]);
  const [subComponents, setSubComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Hooks ───────────────────────────────────────────────────────────────────
  const { swaps, loadSwaps, addSwap, updateSwap, deleteSwap } = useComponentSwaps();
  const { intervals, loadIntervals, createInterval, updateInterval, deleteInterval, markServiced } = useServiceIntervals();
  const { records, loadRecords, createRecord } = useServiceRecords(user);

  // ─── Sheet visibility ────────────────────────────────────────────────────────
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showIntervalSheet, setShowIntervalSheet] = useState(false);
  const [editingInterval, setEditingInterval] = useState<ComponentServiceInterval | null>(null);
  const [showRecordSheet, setShowRecordSheet] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ComponentTemplate | null>(null);
  const [pendingCustomName, setPendingCustomName] = useState('');
  const [storageComponents, setStorageComponents] = useState<Component[]>([]);

  // ─── Swap editor state ───────────────────────────────────────────────────────
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [editingSwap, setEditingSwap] = useState<ComponentSwap | null>(null);
  const [swapInstalledAt, setSwapInstalledAt] = useState('');
  const [swapRemovedAt, setSwapRemovedAt] = useState('');
  const [swapNotes, setSwapNotes] = useState('');
  const [swapSaving, setSwapSaving] = useState(false);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllRides, setShowAllRides] = useState(false);

  // Android back button: close internal modals before navigating away
  const modalRef = useRef({ showActionSheet, showIntervalSheet, showRecordSheet, showLibrary, showComponentForm, showSwapModal });
  useEffect(() => {
    modalRef.current = { showActionSheet, showIntervalSheet, showRecordSheet, showLibrary, showComponentForm, showSwapModal };
  });
  useEffect(() => registerBackHandler(() => {
    const m = modalRef.current;
    if (m.showComponentForm) { setShowComponentForm(false); return true; }
    if (m.showLibrary) { setShowLibrary(false); return true; }
    if (m.showSwapModal) { setShowSwapModal(false); return true; }
    if (m.showIntervalSheet) { setShowIntervalSheet(false); return true; }
    if (m.showRecordSheet) { setShowRecordSheet(false); return true; }
    if (m.showActionSheet) { setShowActionSheet(false); return true; }
    navigation.goBack(); return true;
  }), []);

  // ─── Fetch base data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, assetRes, logsRes, subsRes] = await Promise.all([
        supabase.from('components').select('*').eq('id', componentId).single(),
        supabase.from('assets').select('*').eq('id', assetId).single(),
        supabase.from('usage_logs').select('*').eq('asset_id', assetId)
          .order('recorded_at', { ascending: false }).limit(200),
        supabase.from('components').select('*').eq('parent_component_id', componentId)
          .in('status', ['installed', 'storage']).order('position', { ascending: true }),
      ]);
      if (compRes.data) setComponent(compRes.data as Component);
      if (assetRes.data) setAsset(assetRes.data as FinGoAsset);
      setAllAssetLogs((logsRes.data ?? []) as UsageLog[]);
      setSubComponents((subsRes.data ?? []) as Component[]);
    } finally {
      setLoading(false);
    }
  }, [componentId, assetId]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void loadSwaps(componentId); }, [componentId, loadSwaps]);
  useEffect(() => { void loadIntervals(componentId); }, [componentId, loadIntervals]);
  useEffect(() => {
    if (asset) void loadRecords(asset.id);
  }, [asset, loadRecords]);

  // ─── Derived data ────────────────────────────────────────────────────────────
  const componentIntervals = intervals[componentId] ?? [];

  const componentLogs = useMemo(() => {
    if (!component) return [];
    return filterLogsForComponent(allAssetLogs, component, swaps);
  }, [allAssetLogs, component, swaps]);

  // Records for this component only
  const componentRecords = useMemo(
    () => records.filter((r) => r.component_id === componentId),
    [records, componentId],
  );

  // Component totals (from accumulated tracking fields — source of truth)
  const totalDistance = component?.track_distance ?? 0;
  const totalMovingTimeH = component?.track_moving_time ?? 0;
  const totalElevation = component?.track_elevation_gain ?? 0;
  const totalRides = component?.track_rides ?? 0;

  const { avgSpeed, maxSpeed } = useMemo(() => calcSpeeds(componentLogs), [componentLogs]);

  const templateInfo = component?.template_key ? findTemplate(component.template_key) : null;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleComponentAction = useCallback(async (action: ComponentActionType, comp: Component) => {
    if (!asset) return;
    switch (action) {
      case 'edit':
        setPendingTemplate(null);
        setShowComponentForm(true);
        break;
      case 'set_picture':
        setPendingTemplate(null);
        setShowComponentForm(true);
        break;
      case 'add_sub':
        setShowLibrary(true);
        break;
      case 'add_interval':
        setEditingInterval(null);
        setShowIntervalSheet(true);
        break;
      case 'log_service':
        setShowRecordSheet(true);
        break;
      case 'uninstall':
        await supabase.from('components')
          .update({ status: 'storage', installed_on_asset_id: null, parent_component_id: null })
          .eq('id', comp.id);
        navigation.goBack();
        break;
      case 'retire':
        await supabase.from('components')
          .update({ status: 'retired', installed_on_asset_id: null, parent_component_id: null })
          .eq('id', comp.id);
        navigation.goBack();
        break;
      case 'delete': {
        const doDelete = async () => {
          await supabase.from('components').delete().eq('id', comp.id);
          navigation.goBack();
        };
        if (Platform.OS === 'web') {
          if (window.confirm(`Delete "${comp.name}"? This cannot be undone.`)) void doDelete();
        } else {
          Alert.alert('Delete component', `Delete "${comp.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
          ]);
        }
        break;
      }
      default:
        break;
    }
  }, [asset, navigation]);

  const openSwapModal = (swap: ComponentSwap | null) => {
    setEditingSwap(swap);
    setSwapInstalledAt(swap ? toInputDate(swap.installed_at) : toInputDate(new Date().toISOString()));
    setSwapRemovedAt(swap?.removed_at ? toInputDate(swap.removed_at) : '');
    setSwapNotes(swap?.notes ?? '');
    setShowSwapModal(true);
  };

  const handleSaveSwap = async () => {
    if (!swapInstalledAt || !component) return;
    setSwapSaving(true);
    try {
      const installedIso = new Date(swapInstalledAt).toISOString();
      const removedIso = swapRemovedAt ? new Date(swapRemovedAt).toISOString() : null;
      if (editingSwap) {
        await updateSwap(editingSwap.id, componentId, {
          installed_at: installedIso,
          removed_at: removedIso,
          notes: swapNotes || null,
        });
      } else {
        await addSwap(componentId, assetId, installedIso, removedIso, swapNotes || null);
      }
      setShowSwapModal(false);
    } finally {
      setSwapSaving(false);
    }
  };

  const handleDeleteSwap = (swap: ComponentSwap) => {
    const doDelete = () => void deleteSwap(swap.id, componentId);
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this swap record?')) doDelete();
    } else {
      Alert.alert('Remove swap', 'Remove this swap record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────
  if (loading || !component) {
    return (
      <View style={styles.screen}>
        <AppHeader onBack={() => navigation.goBack()} />
        <Text style={styles.loadingText}>{loading ? 'Loading…' : 'Component not found'}</Text>
      </View>
    );
  }

  const visibleServices = showAllServices ? componentRecords : componentRecords.slice(0, 3);
  const visibleRides = showAllRides ? componentLogs : componentLogs.slice(0, 3);

  return (
    <View {...uiProps(uiPath('fingo', 'component_detail', 'screen', componentId))} style={styles.screen}>
      <AppHeader onBack={() => navigation.goBack()} />

      <ScrollView {...uiProps(uiPath('fingo', 'component_detail', 'scroll'))} style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset(24, bottom) }]} showsVerticalScrollIndicator={false}>

        {/* ── Component identity ─────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'identity_header'))} style={styles.identityHeader}>
          <View {...uiProps(uiPath('fingo', 'component_detail', 'identity_icon_wrap'))} style={styles.identityIconWrap}>
            <ComponentIcon
              name={getComponentIcon(component.name, component.template_key)}
              size={72}
              color="#8FA8C9"
            />
          </View>
          <View {...uiProps(uiPath('fingo', 'component_detail', 'identity_text'))} style={styles.identityText}>
            {templateInfo && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{templateInfo.name}</Text>
              </View>
            )}
            <Text style={styles.componentName}>{component.name}</Text>
            {asset && (
              <Text style={styles.assetLabel}>on {asset.name}</Text>
            )}
          </View>
        </View>

        {/* ── Stats summary bar ──────────────────────────────────────────────── */}
        <TouchableOpacity
          {...uiProps(uiPath('fingo', 'component_detail', 'stats_bar', componentId))}
          style={styles.statsSummaryBar}
          onPress={() => setStatsExpanded((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.statsSummaryItem}>
            <Text style={styles.statsSummaryValue}>
              {totalDistance > 0 ? `${totalDistance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : '—'}
            </Text>
            <Text style={styles.statsSummaryLabel}>Distance</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsSummaryItem}>
            <Text style={styles.statsSummaryValue}>
              {totalMovingTimeH > 0 ? formatMovingTime(totalMovingTimeH) : '—'}
            </Text>
            <Text style={styles.statsSummaryLabel}>Moving Time</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsSummaryItem}>
            <Text style={styles.statsSummaryValue}>
              {totalElevation > 0 ? `${totalElevation.toLocaleString(undefined, { maximumFractionDigits: 0 })} m` : '—'}
            </Text>
            <Text style={styles.statsSummaryLabel}>Elev. Gain</Text>
          </View>
          <Text style={styles.statsChevron}>{statsExpanded ? '▾' : '▸'}</Text>
        </TouchableOpacity>

        {statsExpanded && (
          <View style={styles.statsExpanded}>
            <View style={styles.statsGrid}>
              {[
                { label: 'Distance', value: totalDistance > 0 ? `${totalDistance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : '—' },
                { label: 'Moving Time', value: totalMovingTimeH > 0 ? formatMovingTime(totalMovingTimeH) : '—' },
                { label: 'Elev. Gain', value: totalElevation > 0 ? `${totalElevation.toLocaleString(undefined, { maximumFractionDigits: 0 })} m` : '—' },
                { label: 'Rides', value: totalRides.toString() },
                { label: 'Avg Speed', value: avgSpeed > 0 ? `${avgSpeed.toFixed(1)} km/h` : '—' },
                { label: 'Max Speed', value: maxSpeed > 0 ? `${maxSpeed.toFixed(1)} km/h` : '—' },
              ].map(({ label, value }) => (
                <View key={label} style={styles.statsGridItem}>
                  <Text style={styles.statsGridValue}>{value}</Text>
                  <Text style={styles.statsGridLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {componentLogs.length > 0 && (
              <>
                <Text style={styles.breakdownHeader}>Rides Breakdown</Text>
                <View style={styles.breakdownTableHeader}>
                  <Text style={[styles.breakdownCell, styles.breakdownDate]}>Date</Text>
                  <Text style={[styles.breakdownCell, styles.breakdownNum]}>Dist</Text>
                  <Text style={[styles.breakdownCell, styles.breakdownNum]}>Time</Text>
                  <Text style={[styles.breakdownCell, styles.breakdownNum]}>Elev</Text>
                  <Text style={[styles.breakdownCell, styles.breakdownNum]}>Speed</Text>
                </View>
                {componentLogs.map((log) => {
                  const speedKmh = log.moving_time_delta && log.moving_time_delta > 0
                    ? (log.usage_delta / (log.moving_time_delta / 60))
                    : null;
                  return (
                    <View key={log.id} style={styles.breakdownRow}>
                      <Text style={[styles.breakdownCell, styles.breakdownDate, styles.breakdownValue]}>
                        {new Date(log.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                      <Text style={[styles.breakdownCell, styles.breakdownNum, styles.breakdownValue]}>
                        {log.usage_delta > 0 ? `${log.usage_delta.toFixed(1)}` : '—'}
                      </Text>
                      <Text style={[styles.breakdownCell, styles.breakdownNum, styles.breakdownValue]}>
                        {log.moving_time_delta ? formatLogTime(log.moving_time_delta) : '—'}
                      </Text>
                      <Text style={[styles.breakdownCell, styles.breakdownNum, styles.breakdownValue]}>
                        {log.elevation_delta ? `${Math.round(log.elevation_delta)}` : '—'}
                      </Text>
                      <Text style={[styles.breakdownCell, styles.breakdownNum, styles.breakdownValue]}>
                        {speedKmh ? `${speedKmh.toFixed(1)}` : '—'}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── Action buttons ─────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'action_row'))} style={styles.actionRow}>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'component_detail', 'add_service_button', componentId))}
            style={styles.addServiceBtn}
            onPress={() => setShowRecordSheet(true)}
          >
            <Image source={FINGO_ASSETS.fix} style={styles.addServiceIcon} resizeMode="contain" />
            <Text style={styles.addServiceText}>Add Service</Text>
          </TouchableOpacity>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'component_detail', 'actions_button', componentId))}
            style={styles.actionsBtn}
            onPress={() => setShowActionSheet(true)}
          >
            <Text style={styles.actionsBtnText}>••• Actions</Text>
          </TouchableOpacity>
        </View>

        {/* ── Service Intervals ──────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'section_intervals'))} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service Intervals</Text>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'component_detail', 'add_interval_button', componentId))}
            style={styles.sectionAddBtn}
            onPress={() => { setEditingInterval(null); setShowIntervalSheet(true); }}
          >
            <Image source={FINGO_ASSETS.add} style={styles.sectionAddIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        {componentIntervals.length === 0 ? (
          <Text style={styles.emptyText}>No intervals yet.</Text>
        ) : (
          componentIntervals.map((interval) => {
            const health = computeIntervalHealth(interval, component);
            const color = healthColor(health.remaining / interval.interval_value);
            return (
              <TouchableOpacity
                key={interval.id}
                {...uiProps(uiPath('fingo', 'component_detail', 'interval_card', interval.id))}
                style={styles.intervalRow}
                onPress={() => navigation.push('ServiceIntervalDetail', {
                  intervalId: interval.id,
                  componentId,
                  assetId,
                })}
                activeOpacity={0.7}
              >
                <View style={styles.intervalBarTrack}>
                  <View style={[styles.intervalBarFill, {
                    width: `${Math.max(0, Math.min(1, health.remaining / interval.interval_value)) * 100}%` as any,
                    backgroundColor: color,
                  }]} />
                </View>
                <View style={styles.intervalInfo}>
                  <Text style={styles.intervalName}>{interval.name}</Text>
                  <Text style={[styles.intervalRemaining, { color }]}>{formatIntervalRemaining(health)}</Text>
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Parts (sub-components) ─────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'section_parts'))} style={[styles.sectionHeader, styles.sectionMt]}>
          <Text style={styles.sectionTitle}>Parts</Text>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'component_detail', 'add_part_button', componentId))}
            style={styles.sectionAddBtn}
            onPress={() => setShowLibrary(true)}
          >
            <Image source={FINGO_ASSETS.add} style={styles.sectionAddIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        {subComponents.length === 0 ? (
          <Text style={styles.emptyText}>No sub-components yet.</Text>
        ) : (
          subComponents.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              {...uiProps(uiPath('fingo', 'component_detail', 'sub_component_card', sub.id))}
              style={styles.subComponentRow}
              onPress={() => navigation.push('ComponentDetail', { componentId: sub.id, assetId })}
              activeOpacity={0.7}
            >
              <View style={styles.subComponentBody}>
                <Text style={styles.subComponentName}>{sub.name}</Text>
                {sub.status === 'storage' && (
                  <Text style={styles.subComponentMeta}>in storage</Text>
                )}
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          ))
        )}

        {/* ── Swaps ──────────────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'section_swaps'))} style={[styles.sectionHeader, styles.sectionMt]}>
          <Text style={styles.sectionTitle}>Swaps</Text>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'component_detail', 'add_swap_button', componentId))}
            style={styles.sectionAddBtn}
            onPress={() => openSwapModal(null)}
          >
            <Image source={FINGO_ASSETS.add} style={styles.sectionAddIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        {swaps.length === 0 ? (
          <Text style={styles.emptyText}>No swap history recorded. Tap + to add.</Text>
        ) : (
          swaps.map((swap) => (
            <TouchableOpacity
              key={swap.id}
              {...uiProps(uiPath('fingo', 'component_detail', 'swap_card', swap.id))}
              style={styles.swapRow}
              onPress={() => openSwapModal(swap)}
              activeOpacity={0.7}
            >
              <View style={styles.swapBody}>
                <Text style={styles.swapAsset}>{swap.asset_name ?? 'Unknown asset'}</Text>
                <Text style={styles.swapDates}>
                  {toLocalDateString(swap.installed_at)} → {swap.removed_at ? toLocalDateString(swap.removed_at) : 'current'}
                </Text>
                {swap.notes ? <Text style={styles.swapNotes}>{swap.notes}</Text> : null}
              </View>
              <TouchableOpacity
                style={styles.swapDeleteBtn}
                onPress={(e) => { e.stopPropagation?.(); handleDeleteSwap(swap); }}
                hitSlop={8}
              >
                <Text style={styles.swapDeleteText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          ))
        )}

        {/* ── Services ───────────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'section_services'))} style={[styles.sectionHeader, styles.sectionMt]}>
          <Text style={styles.sectionTitle}>Services</Text>
        </View>
        {componentRecords.length === 0 ? (
          <Text style={styles.emptyText}>No services logged yet.</Text>
        ) : (
          <>
            {visibleServices.map((rec) => (
              <View key={rec.id} {...uiProps(uiPath('fingo', 'component_detail', 'service_record_row', rec.id))} style={styles.serviceRow}>
                <Image source={FINGO_ASSETS.fix} style={styles.serviceTypeIcon} resizeMode="contain" />
                <View style={styles.serviceBody}>
                  <Text style={styles.serviceName}>{rec.name}</Text>
                  <Text style={styles.serviceMeta}>{toLocalDateString(rec.serviced_at)}</Text>
                  {rec.notes ? <Text style={styles.serviceNotes} numberOfLines={1}>{rec.notes}</Text> : null}
                </View>
                {rec.cost != null && (
                  <Text style={styles.serviceCost}>{rec.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                )}
              </View>
            ))}
            {componentRecords.length > 3 && (
              <TouchableOpacity
                {...uiProps(uiPath('fingo', 'component_detail', 'show_all_services_button', componentId))}
                style={styles.showAllBtn}
                onPress={() => setShowAllServices((v) => !v)}
              >
                <Text style={styles.showAllText}>
                  {showAllServices ? 'Show less' : `Show all (${componentRecords.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Rides ──────────────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'component_detail', 'section_rides'))} style={[styles.sectionHeader, styles.sectionMt]}>
          <Text style={styles.sectionTitle}>Rides</Text>
        </View>
        {componentLogs.length === 0 ? (
          <Text style={styles.emptyText}>No rides recorded for this component.</Text>
        ) : (
          <>
            {visibleRides.map((log) => (
              <View key={log.id} {...uiProps(uiPath('fingo', 'component_detail', 'ride_row', log.id))} style={styles.rideRow}>
                <View style={styles.rideLeft}>
                  <Text style={styles.rideDate}>
                    {new Date(log.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {log.notes ? <Text style={styles.rideNotes} numberOfLines={1}>{log.notes}</Text> : null}
                </View>
                <View style={styles.rideRight}>
                  <Text style={styles.rideDist}>{log.usage_delta.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</Text>
                  {log.moving_time_delta != null && (
                    <Text style={styles.rideMeta}>{formatLogTime(log.moving_time_delta)}</Text>
                  )}
                  {log.elevation_delta != null && (
                    <Text style={styles.rideMeta}>+{Math.round(log.elevation_delta)} m</Text>
                  )}
                </View>
              </View>
            ))}
            {componentLogs.length > 3 && (
              <TouchableOpacity
                {...uiProps(uiPath('fingo', 'component_detail', 'show_all_rides_button', componentId))}
                style={styles.showAllBtn}
                onPress={() => setShowAllRides((v) => !v)}
              >
                <Text style={styles.showAllText}>
                  {showAllRides ? 'Show less' : `Show all (${componentLogs.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Sheets & modals ──────────────────────────────────────────────────────── */}
      <ComponentActionSheet
        visible={showActionSheet}
        component={component}
        onAction={(action, comp) => {
          setShowActionSheet(false);
          void handleComponentAction(action, comp);
        }}
        onClose={() => setShowActionSheet(false)}
      />

      <ServiceIntervalSheet
        visible={showIntervalSheet}
        componentName={component.name}
        editingInterval={editingInterval}
        onSave={async (name, method, value, serviceType) => {
          if (editingInterval) {
            await updateInterval(editingInterval.id, componentId, { name, tracking_method: method, interval_value: value, service_type: serviceType });
          } else {
            await createInterval(componentId, name, method, value, serviceType);
          }
        }}
        onClose={() => { setShowIntervalSheet(false); setEditingInterval(null); }}
      />

      <ServiceRecordSheet
        visible={showRecordSheet}
        componentName={component.name}
        intervals={componentIntervals}
        component={component}
        onSave={async (name, servicedAt, notes, cost, selectedIntervalIds) => {
          if (!asset) return;
          await createRecord(asset.id, componentId, name, servicedAt, notes, cost);
          if (selectedIntervalIds.length > 0) {
            await Promise.all(
              selectedIntervalIds.map((id) => {
                const interval = componentIntervals.find((i) => i.id === id);
                if (!interval) return Promise.resolve(false);
                const currentValue = getTrackingValue(component, interval.tracking_method);
                return markServiced(id, componentId, currentValue);
              }),
            );
          }
          await loadRecords(asset.id);
        }}
        onClose={() => setShowRecordSheet(false)}
      />

      <ComponentLibrarySheet
        visible={showLibrary}
        assetType={component.asset_type}
        assetName={asset?.name}
        installedComponents={subComponents}
        storageComponents={storageComponents}
        onSelect={async (sel) => {
          setShowLibrary(false);
          if (!asset) return;
          if (sel.type === 'storage') {
            await supabase.from('components').update({
              status: 'installed',
              installed_on_asset_id: assetId,
              parent_component_id: componentId,
              installed_at: new Date().toISOString(),
            }).eq('id', sel.component.id);
            void loadData();
            return;
          }
          if (sel.type === 'custom') {
            setPendingTemplate(null);
            setPendingCustomName(sel.name);
            setShowComponentForm(true);
            return;
          }
          setPendingTemplate(sel.template);
          setPendingCustomName('');
          setShowComponentForm(true);
        }}
        onClose={() => setShowLibrary(false)}
      />

      <ComponentFormSheet
        visible={showComponentForm}
        template={pendingTemplate}
        editingComponent={null}
        initialName={pendingCustomName}
        assetCreatedAt={asset?.created_at}
        assetName={asset?.name}
        assets={asset ? [{ id: asset.id, name: asset.name }] : []}
        currentAssetId={assetId}
        onSave={async (name, notes, installedAt) => {
          if (!user || !asset) return;
          await supabase.from('components').insert({
            created_by: user.id,
            template_key: pendingTemplate?.key ?? null,
            name,
            asset_type: component.asset_type,
            installed_on_asset_id: assetId,
            parent_component_id: componentId,
            status: 'installed',
            installed_at: installedAt ?? new Date().toISOString(),
            notes: notes ?? null,
          });
          logAPI('supabase://components', { source: 'fingo.component_detail', action: 'createSubComponent' });
          void loadData();
        }}
        onClose={() => { setShowComponentForm(false); setPendingTemplate(null); setPendingCustomName(''); }}
      />

      {/* ── Swap editor modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showSwapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSwapModal(false)}
      >
        <TouchableOpacity
          style={styles.swapModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSwapModal(false)}
        />
        <View style={styles.swapModalSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.swapModalTitle}>{editingSwap ? 'Edit Swap' : 'Add Swap'}</Text>

          <Text style={styles.inputLabel}>Installed on</Text>
          <TextInput
            style={styles.input}
            value={swapInstalledAt}
            onChangeText={setSwapInstalledAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#475569"
          />

          <Text style={styles.inputLabel}>Removed on <Text style={styles.inputOptional}>(leave blank if still installed)</Text></Text>
          <TextInput
            style={styles.input}
            value={swapRemovedAt}
            onChangeText={setSwapRemovedAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#475569"
          />

          <Text style={styles.inputLabel}>Notes <Text style={styles.inputOptional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={swapNotes}
            onChangeText={setSwapNotes}
            placeholder="e.g. Moved from old bike"
            placeholderTextColor="#475569"
          />

          <View style={styles.swapModalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSwapModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!swapInstalledAt || swapSaving) && styles.saveBtnDisabled]}
              onPress={() => void handleSaveSwap()}
              disabled={!swapInstalledAt || swapSaving}
            >
              <Text style={styles.saveText}>{swapSaving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#475569',
    textAlign: 'center',
    marginTop: 40,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 5,
    paddingHorizontal: 16,
  },
  // Identity
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  identityIconWrap: {
    width: 75,
    height: 75,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: -11,
  },
  identityText: {
    flex: 1,
    paddingTop: 2,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D2137',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  typeText: {
    color: '#8FA8C9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  componentName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  assetLabel: {
    color: '#475569',
    fontSize: 13,
  },
  // Stats summary bar
  statsSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 2,
    gap: 4,
  },
  statsSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsSummaryValue: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  statsSummaryLabel: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#1F3A59',
  },
  statsChevron: {
    color: '#8FA8C9',
    fontSize: 12,
    marginLeft: 4,
  },
  // Stats expanded
  statsExpanded: {
    backgroundColor: '#0B1728',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#1F3A59',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statsGridItem: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 10,
    alignItems: 'center',
  },
  statsGridValue: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  statsGridLabel: {
    color: '#475569',
    fontSize: 10,
    marginTop: 3,
  },
  breakdownHeader: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  breakdownTableHeader: {
    flexDirection: 'row',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderColor: '#1F3A59',
    marginBottom: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
  },
  breakdownCell: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  breakdownValue: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  breakdownDate: { flex: 2 },
  breakdownNum: { flex: 1.5, textAlign: 'right' },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    marginTop: 14,
  },
  addServiceBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  addServiceIcon: {
    width: 18,
    height: 18,
  },
  addServiceText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  actionsBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  actionsBtnText: {
    color: '#8FA8C9',
    fontSize: 13,
    fontWeight: '600',
  },
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionMt: { marginTop: 20 },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAddIcon: {
    width: 20,
    height: 20,
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
  rowChevron: {
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
    padding: 10,
    marginBottom: 5,
    gap: 10,
  },
  intervalBarTrack: {
    width: 4,
    height: 36,
    backgroundColor: '#1F3A59',
    borderRadius: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  intervalBarFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 2,
  },
  intervalInfo: { flex: 1 },
  intervalName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  intervalRemaining: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  // Sub-components
  subComponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 10,
    marginBottom: 5,
    gap: 8,
  },
  subComponentBody: { flex: 1 },
  subComponentName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  subComponentMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  // Swap rows
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 10,
    marginBottom: 5,
    gap: 8,
  },
  swapBody: { flex: 1 },
  swapAsset: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  swapDates: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  swapNotes: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  swapDeleteBtn: { padding: 4 },
  swapDeleteText: {
    color: '#f87171',
    fontSize: 13,
  },
  // Services
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    maxHeight: 65,
  },
  serviceTypeIcon: {
    width: 44,
    alignSelf: 'stretch',
    flexShrink: 0,
    maxHeight: 65,
  },
  serviceBody: {
    flex: 1,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  serviceName: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  serviceMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  serviceNotes: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  serviceCost: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  // Rides
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  rideLeft: { flex: 1 },
  rideDate: { color: '#64748B', fontSize: 12 },
  rideNotes: { color: '#475569', fontSize: 11, marginTop: 1 },
  rideRight: { alignItems: 'flex-end' },
  rideDist: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  rideMeta: { color: '#64748B', fontSize: 11, marginTop: 1 },
  // Show all
  showAllBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  showAllText: {
    color: '#3B6A9E',
    fontSize: 13,
    fontWeight: '600',
  },
  // Swap editor modal
  swapModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  swapModalSheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginBottom: 14,
  },
  swapModalTitle: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  inputLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  inputOptional: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  swapModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
  },
  saveText: { color: '#4ade80', fontWeight: '700' },
});
