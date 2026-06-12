import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform, Modal, Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useServiceIntervals } from '../hooks/useServiceIntervals';
import { useServiceRecords } from '../hooks/useServiceRecords';
import ServiceRecordSheet from '../components/fingo/ServiceRecordSheet';
import ServiceIntervalSheet from '../components/fingo/ServiceIntervalSheet';
import AppHeader from '../components/AppHeader';
import { supabase } from '../lib/supabase';
import {
  computeIntervalHealthFromLogs, formatIntervalRemaining, formatTimeHours, healthColor, getTrackingValue,
  trackingMethodLabel, trackingMethodUnit,
} from '../lib/fingo/health';
import { FINGO_ASSETS } from '../lib/fingo/fingoAssets';
import { bottomInset } from '../lib/safeArea';
import { registerBackHandler } from '../lib/capacitorBack';
import { uiPath, uiProps } from '../lib/devtools';
import type { RootStackParamList } from '../navigation';
import type { Component, ComponentServiceInterval, ServiceIntervalType, ComponentServiceRecord, UsageLog } from '../types/fingo';

const SERVICE_TYPE_ICONS: Record<ServiceIntervalType, any> = {
  general:  FINGO_ASSETS.fix,
  replace:  FINGO_ASSETS.change,
  cleaning: FINGO_ASSETS.wipe,
  charge:   FINGO_ASSETS.charge,
  pump:     FINGO_ASSETS.pressure,
};

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceIntervalDetail'>;

export default function ServiceIntervalDetailScreen({ route }: Props) {
  const { intervalId, componentId, assetId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { bottom } = useSafeAreaInsets();

  const { intervals, loadIntervals, deleteInterval, markServiced, updateInterval } = useServiceIntervals();
  const { records, createRecord, loadRecords, updateRecord } = useServiceRecords(user);

  const [component, setComponent] = useState<Component | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetLogs, setAssetLogs] = useState<UsageLog[]>([]);
  const [showRecordSheet, setShowRecordSheet] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ComponentServiceRecord | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showIntervalSheet, setShowIntervalSheet] = useState(false);
  const [, setTick] = useState(0);

  // Android back button: close internal modals before navigating away
  const modalRef = useRef({ showRecordSheet, showActionsModal, showIntervalSheet, editingRecord });
  useEffect(() => {
    modalRef.current = { showRecordSheet, showActionsModal, showIntervalSheet, editingRecord };
  });
  useEffect(() => registerBackHandler(() => {
    const m = modalRef.current;
    if (m.showIntervalSheet) { setShowIntervalSheet(false); return true; }
    if (m.showRecordSheet) { setShowRecordSheet(false); return true; }
    if (m.editingRecord) { setEditingRecord(null); return true; }
    if (m.showActionsModal) { setShowActionsModal(false); return true; }
    navigation.goBack(); return true;
  }), []);

  const interval: ComponentServiceInterval | undefined = (intervals[componentId] ?? []).find((i) => i.id === intervalId);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, logsRes] = await Promise.all([
        supabase.from('components').select('*').eq('id', componentId).single(),
        supabase.from('usage_logs').select('*').eq('asset_id', assetId).order('recorded_at', { ascending: false }),
      ]);
      if (compRes.data) setComponent(compRes.data as Component);
      setAssetLogs((logsRes.data ?? []) as UsageLog[]);
      await loadIntervals(componentId);
      await loadRecords(assetId);
    } finally {
      setLoading(false);
    }
  }, [componentId, assetId, loadIntervals, loadRecords]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Reload logs on focus so edits made to rides elsewhere are reflected immediately
  useFocusEffect(useCallback(() => {
    supabase.from('usage_logs').select('*').eq('asset_id', assetId)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => { if (data) setAssetLogs(data as UsageLog[]); });
  }, [assetId]));

  const handleDelete = useCallback(() => {
    if (!interval) return;
    const doDelete = async () => {
      await deleteInterval(interval.id, componentId);
      navigation.goBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${interval.name}"? This cannot be undone.`)) void doDelete();
    } else {
      Alert.alert('Delete interval', `Delete "${interval.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
      ]);
    }
  }, [interval, componentId, deleteInterval, navigation]);

  if (loading || !interval || !component) {
    return (
      <View style={styles.screen}>
      <AppHeader onBack={() => navigation.goBack()} />
        <Text style={styles.loadingText}>{loading ? 'Loading…' : 'Interval not found'}</Text>
      </View>
    );
  }

  const health = computeIntervalHealthFromLogs(interval, component, assetLogs, interval.last_serviced_at ?? null);
  const healthRatio = Math.max(0, Math.min(1, health.remaining / interval.interval_value));
  const color = healthColor(health.remaining / interval.interval_value);
  const barWidth = `${healthRatio * 100}%` as any;

  return (
    <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'screen', intervalId))} style={styles.screen}>
      <AppHeader onBack={() => navigation.goBack()} />

      <ScrollView
        {...uiProps(uiPath('fingo', 'service_interval_detail', 'scroll'))}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset(24, bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity ──────────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'identity_header'))} style={styles.identityHeader}>
          <Image
            source={SERVICE_TYPE_ICONS[interval.service_type ?? 'general']}
            style={styles.identityIcon}
            resizeMode="contain"
          />
          <View style={styles.identityText}>
            <Text style={styles.componentLabel}>{component.name}</Text>
            <Text style={styles.intervalName}>{interval.name}</Text>
          </View>
        </View>

        {/* ── Progress bar ──────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'progress_card'))} style={styles.progressCard}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: barWidth, backgroundColor: color }]} />
          </View>

          <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'progress_footer'))} style={styles.progressFooter}>
            <Text style={[styles.progressRemaining, { color }]}>
              {formatIntervalRemaining(health)}
            </Text>
            <Text style={styles.progressInterval}>
              / {(interval.tracking_method === 'moving_time' || interval.tracking_method === 'elapsed_time')
                ? formatTimeHours(interval.interval_value)
                : `${interval.interval_value.toLocaleString()} ${trackingMethodUnit(interval.tracking_method)}`}
            </Text>
            {health.isOverdue && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueBadgeText}>OVERDUE</Text>
              </View>
            )}
          </View>

          <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'progress_meta'))} style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              Tracked by: {trackingMethodLabel(interval.tracking_method)}
            </Text>
            <Text style={styles.progressMetaText}>
              Since service: {(interval.tracking_method === 'moving_time' || interval.tracking_method === 'elapsed_time')
                ? formatTimeHours(health.totalSinceService)
                : `${health.totalSinceService.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${trackingMethodUnit(interval.tracking_method)}`}
            </Text>
          </View>
        </View>

        {/* ── Action buttons ─────────────────────────────────────────────────── */}
        <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'action_row'))} style={styles.actionRow}>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'service_interval_detail', 'add_service_button'))}
            style={styles.addServiceBtn}
            onPress={() => setShowRecordSheet(true)}
          >
            <Image source={FINGO_ASSETS.fix} style={styles.addServiceIcon} resizeMode="contain" />
            <Text style={styles.addServiceText}>Add Service</Text>
          </TouchableOpacity>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'service_interval_detail', 'actions_button'))}
            style={styles.actionsBtn}
            onPress={() => setShowActionsModal(true)}
          >
            <Text style={styles.actionsBtnText}>•••</Text>
          </TouchableOpacity>
        </View>

        {/* ── Service history ────────────────────────────────────────────────── */}
        {(() => {
          const componentRecords = records.filter((r) => r.component_id === componentId);

          // Calculate stats for each service record
          const serviceStats = componentRecords.map((rec, i) => {
            const prevRecord = componentRecords[i + 1];
            const prevDate = prevRecord
              ? new Date(prevRecord.serviced_at)
              : component?.installed_at ? new Date(component.installed_at) : null;
            const recDate = new Date(rec.serviced_at);

            // Logs in this period (between previous service and this service)
            const logsInPeriod = prevDate
              ? assetLogs.filter((l) => {
                  const d = new Date(l.recorded_at);
                  return d > prevDate && d <= recDate;
                })
              : [];

            // Delta stats (since last service)
            const deltaKm = logsInPeriod.reduce((s, l) => s + (l.usage_delta ?? 0), 0);
            const deltaMovingTimeMin = logsInPeriod.reduce((s, l) => s + (l.moving_time_delta ?? 0), 0);
            const deltaMovingTimeH = deltaMovingTimeMin / 60.0;
            const elapsedDays = prevDate
              ? Math.floor((recDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const elapsedHours = prevDate
              ? Math.floor(((recDate.getTime() - prevDate.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
              : null;

            // Total stats (since component beginning)
            const logsUntilNow = assetLogs.filter((l) => {
              if (!component?.installed_at) return false;
              const d = new Date(l.recorded_at);
              return d >= new Date(component.installed_at) && d <= recDate;
            });
            const totalKm = logsUntilNow.reduce((s, l) => s + (l.usage_delta ?? 0), 0);
            const totalMovingTimeMin = logsUntilNow.reduce((s, l) => s + (l.moving_time_delta ?? 0), 0);
            const totalMovingTimeH = totalMovingTimeMin / 60.0;

            return {
              deltaKm,
              deltaMovingTimeH,
              elapsedDays,
              elapsedHours,
              totalKm,
              totalMovingTimeH,
            };
          });

          return (
            <>
              <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'section_services'))} style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Services</Text>
              </View>
              {componentRecords.length === 0 ? (
                <Text style={styles.emptyText}>No services logged yet.</Text>
              ) : (
                componentRecords.map((rec, i) => {
                  const stats = serviceStats[i];
                  return (
                    <TouchableOpacity
                      key={rec.id}
                      {...uiProps(uiPath('fingo', 'service_interval_detail', 'service_record_row', rec.id))}
                      style={styles.serviceCard}
                      onPress={() => setEditingRecord(rec)}
                      activeOpacity={0.7}
                    >
                      <Image source={SERVICE_TYPE_ICONS[interval.service_type ?? 'general']} style={styles.serviceCardIcon} resizeMode="contain" />
                      <View style={styles.serviceCardBody}>
                        <Text style={styles.serviceCardName}>{rec.name}</Text>
                        <Text style={styles.serviceCardDate}>
                          {new Date(rec.serviced_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </Text>
                        {rec.notes ? <Text style={styles.serviceCardNotes} numberOfLines={2}>{rec.notes}</Text> : null}

                        {/* Stats */}
                        <View style={styles.serviceStatsSection}>
                          {stats && stats.totalKm > 0 && (
                            <View style={styles.serviceStatRow}>
                              <Text style={styles.serviceStatLabel}>Distance:</Text>
                              <Text style={styles.serviceStatValue}>
                                {stats.totalKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km
                                {stats.deltaKm > 0 && (
                                  <Text style={styles.serviceStatDelta}> (+{stats.deltaKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km)</Text>
                                )}
                              </Text>
                            </View>
                          )}
                          {stats && stats.totalMovingTimeH > 0 && (
                            <View style={styles.serviceStatRow}>
                              <Text style={styles.serviceStatLabel}>Ride Time:</Text>
                              <Text style={styles.serviceStatValue}>
                                {formatTimeHours(stats.totalMovingTimeH)}
                                {stats.deltaMovingTimeH > 0 && (
                                  <Text style={styles.serviceStatDelta}> (+{formatTimeHours(stats.deltaMovingTimeH)})</Text>
                                )}
                              </Text>
                            </View>
                          )}
                          {stats && stats.elapsedDays !== null && stats.elapsedDays >= 0 && (
                            <View style={styles.serviceStatRow}>
                              <Text style={styles.serviceStatLabel}>Days until service:</Text>
                              <Text style={styles.serviceStatValue}>
                                {stats.elapsedDays > 0 && `${stats.elapsedDays}d `}
                                {stats.elapsedHours !== null && stats.elapsedHours > 0 && `${stats.elapsedHours}h`}
                                {stats.elapsedDays === 0 && stats.elapsedHours === 0 && '<1h'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {rec.cost != null && (
                          <Text style={styles.serviceCardCost}>
                            Cost: {rec.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        )}
                        <Text style={styles.serviceCardEditHint}>tap to edit</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          );
        })()}
      </ScrollView>

      {/* ── Service record sheet ──────────────────────────────────────────────── */}
      <ServiceRecordSheet
        visible={showRecordSheet || !!editingRecord}
        editingRecord={editingRecord ?? undefined}
        componentName={component.name}
        intervals={editingRecord ? undefined : [interval]}
        component={editingRecord ? undefined : component}
        onSave={async (name, servicedAt, notes, cost, selectedIntervalIds, serviceType) => {
          if (editingRecord) {
            await updateRecord(editingRecord.id, assetId, { name, serviced_at: servicedAt, notes: notes ?? null, cost: cost ?? null, service_type: serviceType ?? editingRecord.service_type ?? 'general' });
            // Re-derive last_serviced_at from the most recent service record after the edit
            const { data: freshRecords } = await supabase
              .from('component_service_records')
              .select('serviced_at')
              .eq('component_id', componentId)
              .order('serviced_at', { ascending: false })
              .limit(1);
            const newLatestDate = (freshRecords as { serviced_at: string }[] | null)?.[0]?.serviced_at ?? null;
            await supabase
              .from('component_service_intervals')
              .update({ last_serviced_at: newLatestDate })
              .eq('id', interval.id);
            await loadIntervals(componentId);
          } else {
            await createRecord(assetId, componentId, name, servicedAt, notes, cost, interval.service_type);
            if (selectedIntervalIds.includes(interval.id)) {
              const currentValue = getTrackingValue(component, interval.tracking_method);
              await markServiced(interval.id, componentId, currentValue, servicedAt);
              await loadIntervals(componentId);
            }
          }
          const [logsRes] = await Promise.all([
            supabase.from('usage_logs').select('*').eq('asset_id', assetId).order('recorded_at', { ascending: false }),
            loadRecords(assetId),
          ]);
          setAssetLogs((logsRes.data ?? []) as UsageLog[]);
        }}
        onClose={() => { setShowRecordSheet(false); setEditingRecord(null); }}
      />

      <ServiceIntervalSheet
        visible={showIntervalSheet}
        componentName={component.name}
        editingInterval={interval}
        onSave={async (name, method, value, serviceType) => {
          await updateInterval(interval.id, componentId, {
            name, tracking_method: method, interval_value: value, service_type: serviceType,
          });
          await loadIntervals(componentId);
        }}
        onClose={() => setShowIntervalSheet(false)}
      />

      {/* ── Actions modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.actionsBackdrop}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        />
        <View {...uiProps(uiPath('fingo', 'service_interval_detail', 'actions_sheet'))} style={styles.actionsSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.actionsTitle} numberOfLines={1}>{interval.name}</Text>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'service_interval_detail', 'edit_interval_button'))}
            style={styles.actionSheetRow}
            onPress={() => { setShowActionsModal(false); setShowIntervalSheet(true); }}
          >
            <Text style={styles.actionSheetText}>✎  Edit interval</Text>
          </TouchableOpacity>
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'service_interval_detail', 'delete_interval_button'))}
            style={styles.actionSheetRow}
            onPress={() => { setShowActionsModal(false); handleDelete(); }}
          >
            <Text style={[styles.actionSheetText, styles.destructiveText]}>🗑️  Delete interval</Text>
          </TouchableOpacity>
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
  scrollContent: { paddingTop: 5, paddingHorizontal: 16 },
  // Identity
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  identityIcon: {
    width: 75,
    height: 75,
    flexShrink: 0,
    marginLeft: -11,
  },
  identityText: {
    flex: 1,
    paddingTop: 4,
  },
  componentLabel: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 4,
  },
  intervalName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  // Progress card
  progressCard: {
    backgroundColor: '#131c23',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 16,
    marginBottom: 20,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#1F3A59',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: 10,
    borderRadius: 5,
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  progressRemaining: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressInterval: {
    color: '#475569',
    fontSize: 13,
  },
  overdueBadge: {
    backgroundColor: '#7f1d1d',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 'auto' as any,
  },
  overdueBadgeText: {
    color: '#fca5a5',
    fontSize: 10,
    fontWeight: '700',
  },
  progressMeta: {
    gap: 4,
  },
  progressMetaText: {
    color: '#475569',
    fontSize: 12,
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addServiceBtn: {
    flex: 3,
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
    fontSize: 16,
    letterSpacing: 2,
  },
  // Actions modal
  actionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionsSheet: {
    backgroundColor: '#131c23',
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
  actionsTitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  actionSheetRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionSheetText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '500',
  },
  destructiveText: { color: '#f87171' },
  // Service history
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
  // Service card (expanded view with stats)
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    marginBottom: 12,
    overflow: 'hidden',
  },
  serviceCardIcon: {
    width: 60,
    height: 60,
    flexShrink: 0,
  },
  serviceCardBody: {
    flex: 1,
    padding: 12,
  },
  serviceCardName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  serviceCardDate: {
    color: '#475569',
    fontSize: 11,
    marginBottom: 4,
  },
  serviceCardNotes: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
  },
  serviceStatsSection: {
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  serviceStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  serviceStatLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 85,
  },
  serviceStatValue: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  serviceStatDelta: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  serviceCardCost: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  serviceCardEditHint: {
    color: '#334155',
    fontSize: 9,
    marginTop: 6,
  },
});
