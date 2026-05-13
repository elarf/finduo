import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAssets } from '../hooks/useAssets';
import { useUsageLogs } from '../hooks/useUsageLogs';
import { useHealthConnect } from '../hooks/useHealthConnect';
import type { HCRecord } from '../hooks/useHealthConnect';
import DashboardHeader from '../components/dashboard/layout/DashboardHeader';
import { bottomInset } from '../lib/safeArea';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import type { RootStackParamList } from '../navigation';
import type { FinGoAsset } from '../types/fingo';
import { FINGO_ASSETS } from '../lib/fingo/fingoAssets';

type FilterType = 'all' | 'steps' | 'distance' | 'exercise' | 'calories';
type RangeOption = { label: string; days: number };
type ViewTab = 'aggregated' | 'raw';

type DaySteps = {
  date: string;
  totalSteps: number;
  recordCount: number;
};

type AggregatedWorkout = {
  sessionId: string;
  date: string;
  activityName: string;
  distanceKm: number | null;
  durationMin: number;
  isBiking: boolean;
  dataOrigin?: string;
  rawRecord: HCRecord;
};

const RANGE_OPTIONS: RangeOption[] = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];

const TYPE_ICON_IMAGES: Partial<Record<HCRecord['type'], any>> = {
  steps:    FINGO_ASSETS.step,
  distance: FINGO_ASSETS.route,
  exercise: FINGO_ASSETS.ride,
};

const TYPE_ICON_EMOJIS: Record<HCRecord['type'], string> = {
  steps:    '👟',
  distance: '📏',
  exercise: '🚴',
  calories: '🔥',
};

const TYPE_LABELS: Record<HCRecord['type'], string> = {
  steps: 'Steps',
  distance: 'Distance',
  exercise: 'Workout',
  calories: 'Calories',
};

const HC_EXERCISE_NAMES: Record<number, string> = {
  0: 'Other', 2: 'Back Extension', 4: 'Badminton', 5: 'Barbell Shoulder Press',
  6: 'Baseball', 7: 'Basketball', 8: 'Cycling', 9: 'Cycling (Stationary)',
  10: 'Boot Camp', 11: 'Boxing', 13: 'Cricket', 14: 'Cross Country Skiing',
  15: 'CrossFit', 16: 'Curling', 17: 'Dancing', 18: 'Deadlift',
  26: 'Elliptical', 27: 'Exercise Class', 29: 'Frisbee', 31: 'Golf',
  32: 'Guided Breathing', 33: 'Gymnastics', 34: 'Handball', 35: 'HIIT',
  36: 'Hiking', 37: 'Ice Hockey', 38: 'Ice Skating', 39: 'Jumping Jacks',
  40: 'Jump Rope', 42: 'Lunge', 43: 'Martial Arts', 44: 'Meditation',
  45: 'Paddling', 47: 'Pilates', 48: 'Plank', 49: 'Racquetball',
  50: 'Rock Climbing', 52: 'Rowing', 53: 'Rowing Machine', 54: 'Rugby',
  56: 'Running', 57: 'Treadmill', 58: 'Sailing', 59: 'Scuba Diving',
  60: 'Skating', 61: 'Skiing', 62: 'Snowboarding', 63: 'Snowshoeing',
  64: 'Soccer', 65: 'Softball', 66: 'Squash', 67: 'Stair Climbing',
  68: 'Stair Climbing Machine', 69: 'Strength Training', 70: 'Stretching',
  71: 'Surfing', 72: 'Open Water Swimming', 73: 'Pool Swimming',
  74: 'Table Tennis', 75: 'Tennis', 76: 'Volleyball', 77: 'Walking',
  78: 'Water Polo', 79: 'Weightlifting', 81: 'Wheelchair', 82: 'Yoga',
};

const BIKING_HC_TYPES = new Set([8, 9]);

function getHCActivityName(activityType: string): string {
  const n = parseInt(activityType, 10);
  if (!isNaN(n) && HC_EXERCISE_NAMES[n]) return HC_EXERCISE_NAMES[n]!;
  return activityType || 'Workout';
}

function isBikingHC(activityType: string): boolean {
  return BIKING_HC_TYPES.has(parseInt(activityType, 10));
}

const DATA_ORIGIN_NAMES: Record<string, string> = {
  'com.strava': 'Strava',
  'com.samsung.shealth': 'Samsung Health',
  'com.samsung.android.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.polar.polarbeatapp': 'Polar Beat',
  'com.wahoo.fitness': 'Wahoo',
  'com.suunto.android': 'Suunto',
};

function formatDataOrigin(pkg?: string): string | null {
  if (!pkg) return null;
  return DATA_ORIGIN_NAMES[pkg] ?? (pkg.split('.').pop() ?? pkg);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(startIso: string, endIso: string): string {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDurationMin(mins: number): string {
  const totalSecs = Math.round(mins * 60);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function recordPrimaryValue(r: HCRecord): string {
  switch (r.type) {
    case 'steps':    return r.steps != null ? `${r.steps.toLocaleString()} steps` : '—';
    case 'distance': return r.distanceKm != null ? `${r.distanceKm.toFixed(2)} km` : '—';
    case 'exercise':
      return [
        r.distanceKm != null ? `${r.distanceKm.toFixed(2)} km` : null,
        r.movingTimeMin != null ? formatDuration(r.startTime, r.endTime) : null,
      ].filter(Boolean).join(' · ') || formatDuration(r.startTime, r.endTime);
    case 'calories': return r.calories != null ? `${Math.round(r.calories)} kcal` : '—';
  }
}

function canAttach(r: HCRecord): boolean {
  return r.type !== 'calories';
}

function detectDuplicates(workouts: AggregatedWorkout[]): Set<string> {
  const dupes = new Set<string>();
  for (let i = 0; i < workouts.length; i++) {
    if (dupes.has(workouts[i]!.sessionId)) continue;
    for (let j = i + 1; j < workouts.length; j++) {
      if (dupes.has(workouts[j]!.sessionId)) continue;
      const a = workouts[i]!;
      const b = workouts[j]!;
      const timeDiff = Math.abs(
        new Date(a.rawRecord.startTime).getTime() - new Date(b.rawRecord.startTime).getTime(),
      );
      if (timeDiff > 4 * 60 * 60 * 1000) continue;
      const durationDiff = Math.abs(a.durationMin - b.durationMin);
      if (durationDiff > Math.max(5, Math.min(a.durationMin, b.durationMin) * 0.1)) continue;
      const aDist = a.distanceKm ?? 0;
      const bDist = b.distanceKm ?? 0;
      if (aDist > 0 && bDist > 0) {
        const distDiff = Math.abs(aDist - bDist);
        if (distDiff > Math.max(0.5, Math.min(aDist, bDist) * 0.1)) continue;
      }
      // Keep the one with more distance; on tie keep longer duration
      if (aDist >= bDist && (aDist > bDist || a.durationMin >= b.durationMin)) {
        dupes.add(b.sessionId);
      } else {
        dupes.add(a.sessionId);
      }
    }
  }
  return dupes;
}

export default function HealthConnectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { bottom } = useSafeAreaInsets();

  const { assets, loadAssets } = useAssets(user);
  const { addUsageLog, fetchLoggedExternalIds } = useUsageLogs(user);
  const { isAvailable, records, loading, error, hasPermission, requestPermissions, fetchRecords, checkSdkAvailable } = useHealthConnect();

  const [sdkAvailable, setSdkAvailable] = useState<boolean | null>(null);
  const [selectedDays, setSelectedDays] = useState(7);
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('aggregated');

  // Attach sheet state
  const [attachRecord, setAttachRecord] = useState<HCRecord | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());

  // Workout visibility — manual overrides on top of auto-detected duplicates
  const [manualHiddenIds, setManualHiddenIds] = useState<Set<string>>(new Set());
  const [manualUnhiddenIds, setManualUnhiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    void loadAssets();
    void fetchLoggedExternalIds('health_connect').then(setAttachedIds);
    if (isAvailable) {
      void checkSdkAvailable().then((ok) => {
        setSdkAvailable(ok);
        if (ok) {
          void requestPermissions().then((granted) => {
            if (granted) void fetchRecords(selectedDays);
          });
        }
      });
    } else {
      setSdkAvailable(false);
    }
  }, []);

  const handleRangeChange = useCallback((days: number) => {
    setSelectedDays(days);
    setManualHiddenIds(new Set());
    setManualUnhiddenIds(new Set());
    void fetchRecords(days);
  }, [fetchRecords]);

  const openAttachSheet = useCallback((r: HCRecord) => {
    setAttachRecord(r);
    setSelectedAssetId(assets.length === 1 ? assets[0]!.id : null);
  }, [assets]);

  const handleAttach = useCallback(async () => {
    if (!attachRecord || !selectedAssetId) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    if (!asset) return;

    setAttaching(true);
    try {
      const entry = buildEntry(attachRecord, asset);
      const success = await addUsageLog(asset, entry, null, 'health_connect', attachRecord.id);
      if (success) {
        setAttachedIds((prev) => new Set([...prev, attachRecord.id]));
        setAttachRecord(null);
        logUI(uiPath('fingo', 'health_connect', 'attach_confirm'), 'press');
      }
    } finally {
      setAttaching(false);
    }
  }, [attachRecord, selectedAssetId, assets, addUsageLog]);

  const filteredRecords = filter === 'all' ? records : records.filter((r) => r.type === filter);

  // ─── Aggregated data ──────────────────────────────────────────────────────────
  const aggregatedSteps = useMemo((): DaySteps[] => {
    const map = new Map<string, { total: number; count: number }>();
    records.filter((r) => r.type === 'steps').forEach((r) => {
      const date = r.startTime.slice(0, 10);
      const prev = map.get(date) ?? { total: 0, count: 0 };
      map.set(date, { total: prev.total + (r.steps ?? 0), count: prev.count + 1 });
    });
    return Array.from(map.entries())
      .map(([date, { total, count }]) => ({ date, totalSteps: total, recordCount: count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  const aggregatedWorkouts = useMemo((): AggregatedWorkout[] => {
    const exerciseRecords = records.filter((r) => r.type === 'exercise');
    const distanceRecords = records.filter((r) => r.type === 'distance');

    return exerciseRecords.map((session) => {
      let distanceKm = session.distanceKm ?? null;

      // Fall back to distance records that fall within this session's time window
      if (distanceKm == null) {
        const sessionStart = new Date(session.startTime).getTime();
        const sessionEnd = new Date(session.endTime).getTime();
        const matched = distanceRecords.filter((d) => {
          const dStart = new Date(d.startTime).getTime();
          const dEnd = new Date(d.endTime).getTime();
          return dStart >= sessionStart && dEnd <= sessionEnd;
        });
        if (matched.length > 0) {
          distanceKm = matched.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0);
        }
      }

      const durationMin =
        session.movingTimeMin ??
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000;

      const activityType = session.activityType ?? '';

      return {
        sessionId: session.id,
        date: session.startTime.slice(0, 10),
        activityName: getHCActivityName(activityType),
        distanceKm,
        durationMin,
        isBiking: isBikingHC(activityType),
        dataOrigin: session.dataOrigin,
        rawRecord: session,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  const autoDuplicateIds = useMemo(() => detectDuplicates(aggregatedWorkouts), [aggregatedWorkouts]);

  const effectiveHiddenIds = useMemo(() => {
    const result = new Set<string>();
    for (const id of autoDuplicateIds) {
      if (!manualUnhiddenIds.has(id)) result.add(id);
    }
    for (const id of manualHiddenIds) result.add(id);
    return result;
  }, [autoDuplicateIds, manualHiddenIds, manualUnhiddenIds]);

  // ─── Early exits ─────────────────────────────────────────────────────────────
  if (!isAvailable || sdkAvailable === false) {
    return (
      <View {...uiProps(uiPath('fingo', 'health_connect', 'screen'))} style={[styles.screen, { paddingBottom: bottom }]}>
        <DashboardHeader onBack={() => navigation.goBack()} />
        <View style={styles.unavailableContainer}>
          <Text style={styles.unavailableIcon}>💚</Text>
          <Text style={styles.unavailableTitle}>Health Connect</Text>
          <Text style={styles.unavailableBody}>
            Health Connect is only available on Android devices with the Health Connect app installed.
          </Text>
        </View>
      </View>
    );
  }

  if (sdkAvailable === null) {
    return (
      <View style={[styles.screen, { paddingBottom: bottom }]}>
        <DashboardHeader onBack={() => navigation.goBack()} />
        <View style={styles.centeredRow}>
          <ActivityIndicator color="#4ade80" />
        </View>
      </View>
    );
  }

  return (
    <View {...uiProps(uiPath('fingo', 'health_connect', 'screen'))} style={[styles.screen, { paddingBottom: bottom }]}>
      <DashboardHeader onBack={() => navigation.goBack()} />

      {/* Tab toggle */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, viewTab === 'aggregated' && styles.tabBtnActive]}
          onPress={() => setViewTab('aggregated')}
        >
          <Text style={[styles.tabBtnText, viewTab === 'aggregated' && styles.tabBtnTextActive]}>
            Aggregated
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, viewTab === 'raw' && styles.tabBtnActive]}
          onPress={() => setViewTab('raw')}
        >
          <Text style={[styles.tabBtnText, viewTab === 'raw' && styles.tabBtnTextActive]}>
            Raw
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters row */}
      <View style={styles.filtersBar}>
        {/* Time range (always shown) + visibility toggle for aggregated tab */}
        <View style={styles.filterRowWithToggle}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow} style={{ flex: 1 }}>
            {RANGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.pill, selectedDays === opt.days && styles.pillActive]}
                onPress={() => handleRangeChange(opt.days)}
              >
                <Text style={[styles.pillText, selectedDays === opt.days && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {viewTab === 'aggregated' && effectiveHiddenIds.size > 0 && (
            <TouchableOpacity
              style={[styles.pill, styles.visibilityPill, showHidden && styles.pillActive]}
              onPress={() => setShowHidden((v) => !v)}
            >
              <Text style={[styles.pillText, showHidden && styles.pillTextActive]}>
                {showHidden ? '👁 Showing hidden' : `👁 ${effectiveHiddenIds.size} hidden`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter (raw tab only) */}
        {viewTab === 'raw' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {(['all', 'steps', 'distance', 'exercise', 'calories'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.pill, filter === f && styles.pillActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
                  {f === 'all' ? 'All' : TYPE_LABELS[f as HCRecord['type']]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color="#4ade80" />
          <Text style={styles.loadingText}>Reading Health Connect…</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredRow}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hasPermission === false ? (
        <View style={styles.centeredRow}>
          <Text style={styles.unavailableTitle}>Permission required</Text>
          <Text style={styles.unavailableBody}>
            Grant Health Connect read permissions to see your data here.
          </Text>
          <TouchableOpacity
            style={styles.grantBtn}
            onPress={() => void requestPermissions().then((ok) => { if (ok) void fetchRecords(selectedDays); })}
          >
            <Text style={styles.grantBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : viewTab === 'aggregated' ? (
        <AggregatedView
          steps={aggregatedSteps}
          workouts={aggregatedWorkouts}
          attachedIds={attachedIds}
          onAttach={openAttachSheet}
          hiddenWorkoutIds={effectiveHiddenIds}
          showHidden={showHidden}
          onHideWorkout={(id) => setManualHiddenIds((prev) => new Set([...prev, id]))}
          onUnhideWorkout={(id) => {
            setManualHiddenIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
            if (autoDuplicateIds.has(id)) setManualUnhiddenIds((prev) => new Set([...prev, id]));
          }}
        />
      ) : filteredRecords.length === 0 ? (
        <View style={styles.centeredRow}>
          <Text style={styles.emptyText}>No records found for this range.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredRecords.map((r) => {
            const attached = attachedIds.has(r.id);
            const attachable = canAttach(r);
            return (
              <View key={r.id} style={styles.recordRow}>
                <View style={styles.recordIconPanel}>
                  {TYPE_ICON_IMAGES[r.type]
                    ? <Image source={TYPE_ICON_IMAGES[r.type]} style={styles.recordIcon} resizeMode="contain" />
                    : <Text style={styles.recordIconEmoji}>{TYPE_ICON_EMOJIS[r.type]}</Text>
                  }
                </View>
                <View style={styles.recordBody}>
                  <Text style={styles.recordType}>{TYPE_LABELS[r.type]}</Text>
                  <Text style={styles.recordValue}>{recordPrimaryValue(r)}</Text>
                  <Text style={styles.recordTime}>{formatTime(r.startTime)}</Text>
                </View>
                {attached ? (
                  <View style={styles.attachedBadge}>
                    <Text style={styles.attachedText}>✓ Logged</Text>
                  </View>
                ) : attachable ? (
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => openAttachSheet(r)}
                  >
                    <Text style={styles.attachBtnText}>Attach →</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noAttachBadge}>
                    <Text style={styles.noAttachText}>View only</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Attach bottom sheet */}
      <Modal
        visible={!!attachRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachRecord(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setAttachRecord(null)}
        />
        <View style={[styles.sheetContent, { paddingBottom: bottomInset(24, bottom) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Attach to Asset</Text>
          {attachRecord && (
            <View style={styles.sheetRecordPreview}>
              {TYPE_ICON_IMAGES[attachRecord.type]
                ? <Image source={TYPE_ICON_IMAGES[attachRecord.type]} style={styles.sheetRecordIcon} resizeMode="contain" />
                : <Text style={styles.sheetRecordIconEmoji}>{TYPE_ICON_EMOJIS[attachRecord.type]}</Text>
              }
              <View>
                <Text style={styles.sheetRecordValue}>{recordPrimaryValue(attachRecord)}</Text>
                <Text style={styles.sheetRecordTime}>{formatTime(attachRecord.startTime)}</Text>
              </View>
            </View>
          )}
          <Text style={styles.sheetLabel}>Select asset</Text>
          {assets.length === 0 ? (
            <Text style={styles.emptyText}>No assets found.</Text>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(a) => a.id}
              style={styles.assetList}
              renderItem={({ item: asset }) => (
                <TouchableOpacity
                  style={[styles.assetRow, selectedAssetId === asset.id && styles.assetRowSelected]}
                  onPress={() => setSelectedAssetId(asset.id)}
                >
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetType}>{asset.type}</Text>
                  {selectedAssetId === asset.id && <Text style={styles.assetCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          )}
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAttachRecord(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!selectedAssetId || attaching) && styles.confirmBtnDisabled]}
              onPress={() => void handleAttach()}
              disabled={!selectedAssetId || attaching}
            >
              <Text style={styles.confirmText}>{attaching ? 'Logging…' : 'Log Usage'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Aggregated sub-component ─────────────────────────────────────────────────
type AggregatedViewProps = {
  steps: DaySteps[];
  workouts: AggregatedWorkout[];
  attachedIds: Set<string>;
  onAttach: (r: HCRecord) => void;
  hiddenWorkoutIds: Set<string>;
  showHidden: boolean;
  onHideWorkout: (id: string) => void;
  onUnhideWorkout: (id: string) => void;
};

function AggregatedView({ steps, workouts, attachedIds, onAttach, hiddenWorkoutIds, showHidden, onHideWorkout, onUnhideWorkout }: AggregatedViewProps) {
  if (steps.length === 0 && workouts.length === 0) {
    return (
      <View style={styles.centeredRow}>
        <Text style={styles.emptyText}>No records found for this range.</Text>
      </View>
    );
  }

  const visibleWorkouts = showHidden
    ? workouts
    : workouts.filter((w) => !hiddenWorkoutIds.has(w.sessionId));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {workouts.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Workouts</Text>
          {visibleWorkouts.map((w) => {
            const attached = attachedIds.has(w.sessionId);
            const isHidden = hiddenWorkoutIds.has(w.sessionId);
            const originLabel = formatDataOrigin(w.dataOrigin);
            const avgSpeedKmh =
              w.distanceKm != null && w.distanceKm > 0 && w.durationMin > 0
                ? (w.distanceKm / w.durationMin) * 60
                : null;

            return (
              <View
                key={w.sessionId}
                style={[
                  styles.workoutCard,
                  w.isBiking && styles.workoutCardBike,
                  isHidden && styles.workoutCardHidden,
                ]}
              >
                <View style={styles.workoutCardHeader}>
                  <View style={styles.workoutTitleRow}>
                    <Text style={[styles.workoutActivity, w.isBiking && styles.workoutActivityBike]}>
                      {w.isBiking ? '🚴 ' : '🏃 '}{w.activityName}
                    </Text>
                    {originLabel && (
                      <View style={styles.originBadge}>
                        <Text style={styles.originBadgeText}>{originLabel}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.workoutDate}>{formatDate(w.date)}</Text>
                  <Text style={styles.workoutTime}>{formatTimeOnly(w.rawRecord.startTime)}</Text>
                </View>
                <View style={styles.workoutStats}>
                  {w.distanceKm != null && (
                    <View style={styles.workoutStat}>
                      <Text style={styles.workoutStatValue}>{w.distanceKm.toFixed(2)}</Text>
                      <Text style={styles.workoutStatLabel}>km</Text>
                    </View>
                  )}
                  <View style={styles.workoutStat}>
                    <Text style={styles.workoutStatValue}>{formatDurationMin(w.durationMin)}</Text>
                    <Text style={styles.workoutStatLabel}>duration</Text>
                  </View>
                  {avgSpeedKmh != null && (
                    <View style={styles.workoutStat}>
                      <Text style={styles.workoutStatValue}>{avgSpeedKmh.toFixed(1)}</Text>
                      <Text style={styles.workoutStatLabel}>km/h avg</Text>
                    </View>
                  )}
                </View>
                {w.isBiking && !isHidden && !attached && (
                  <Text style={styles.bikeBadge}>Bike ride — eligible for part tracking</Text>
                )}
                {!attached && (
                  <View style={styles.workoutCardActions}>
                    {!isHidden ? (
                      <TouchableOpacity
                        style={[styles.attachBtn, { marginTop: 8 }]}
                        onPress={() => onAttach({ ...w.rawRecord, distanceKm: w.distanceKm ?? w.rawRecord.distanceKm })}
                      >
                        <Text style={styles.attachBtnText}>Attach →</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.hideBtn, { marginTop: 8 }]}
                      onPress={() => isHidden ? onUnhideWorkout(w.sessionId) : onHideWorkout(w.sessionId)}
                    >
                      <Text style={styles.hideBtnText}>{isHidden ? 'Unhide' : 'Hide'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {steps.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, workouts.length > 0 && { marginTop: 16 }]}>
            Daily Steps
          </Text>
          {steps.map((day) => (
            <View key={day.date} style={styles.stepsRow}>
              <View style={styles.stepsBody}>
                <Text style={styles.stepsDate}>{formatDate(day.date)}</Text>
                {day.recordCount > 1 && (
                  <Text style={styles.stepsCount}>{day.recordCount} records merged</Text>
                )}
              </View>
              <Text style={styles.stepsValue}>{day.totalSteps.toLocaleString()}</Text>
              <Text style={styles.stepsUnit}>steps</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function buildEntry(r: HCRecord, _asset: FinGoAsset) {
  switch (r.type) {
    case 'steps':
      return { steps: r.steps ?? 0 };
    case 'distance':
      return { distance: r.distanceKm ?? 0 };
    case 'exercise':
      return {
        distance: r.distanceKm,
        movingTime: r.movingTimeMin != null ? Math.round(r.movingTimeMin) : undefined,
        elevation: r.elevationGainM,
      };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060D18',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1F3A59',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4ade80',
  },
  tabBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#4ade80',
  },
  filtersBar: {
    paddingTop: 8,
    borderBottomWidth: 1,
    borderColor: '#1F3A59',
    gap: 4,
  },
  filterRowWithToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  visibilityPill: {
    flexShrink: 0,
    marginLeft: 4,
  },
  pillRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  pillActive: {
    backgroundColor: '#0D2137',
    borderColor: '#4ade80',
  },
  pillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#4ade80',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 12,
    gap: 6,
  },
  centeredRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    color: '#475569',
    fontSize: 13,
    marginTop: 8,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
  },
  unavailableContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  unavailableIcon: { fontSize: 48 },
  unavailableTitle: {
    color: '#CBD5E1',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  unavailableBody: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  grantBtn: {
    marginTop: 8,
    backgroundColor: '#053d1e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4ade80',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  grantBtnText: {
    color: '#4ade80',
    fontWeight: '700',
  },
  // Raw records
  recordRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    overflow: 'hidden',
    marginBottom: 6,
  },
  recordIconPanel: {
    width: 56,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIcon: {
    width: 36,
    height: 36,
  },
  recordIconEmoji: { fontSize: 22 },
  recordBody: { flex: 1, padding: 12 },
  recordType: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordValue: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  recordTime: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  attachBtn: {
    alignSelf: 'center',
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4ade80',
    backgroundColor: '#053d1e',
  },
  attachBtnText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  attachedBadge: {
    alignSelf: 'center',
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  attachedText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  noAttachBadge: {
    alignSelf: 'center',
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  noAttachText: {
    color: '#475569',
    fontSize: 11,
  },
  // Aggregated — section header
  sectionHeader: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  // Aggregated — workout cards
  workoutCard: {
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
    marginBottom: 8,
  },
  workoutCardBike: {
    borderColor: '#4ade80',
    backgroundColor: '#061a0e',
  },
  workoutCardHidden: {
    opacity: 0.45,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  workoutActivity: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  workoutActivityBike: {
    color: '#4ade80',
  },
  workoutDate: {
    color: '#475569',
    fontSize: 11,
  },
  workoutTime: {
    color: '#334155',
    fontSize: 11,
    marginTop: 2,
  },
  workoutStats: {
    flexDirection: 'row',
    gap: 20,
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  workoutStatValue: {
    color: '#CBD5E1',
    fontSize: 20,
    fontWeight: '700',
  },
  workoutStatLabel: {
    color: '#475569',
    fontSize: 11,
  },
  bikeBadge: {
    color: '#4ade80',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  originBadge: {
    backgroundColor: '#0E1A2B',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  originBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  workoutCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hideBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  hideBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  // Aggregated — steps rows
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    gap: 8,
  },
  stepsBody: { flex: 1 },
  stepsDate: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  stepsCount: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
  stepsValue: {
    color: '#4ade80',
    fontSize: 18,
    fontWeight: '700',
  },
  stepsUnit: {
    color: '#475569',
    fontSize: 11,
  },
  // Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContent: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    maxHeight: '60%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginBottom: 14,
  },
  sheetTitle: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  sheetRecordPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  sheetRecordIcon: { width: 24, height: 24 },
  sheetRecordIconEmoji: { fontSize: 24 },
  sheetRecordValue: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetRecordTime: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  sheetLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  assetList: {
    maxHeight: 180,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    marginBottom: 5,
  },
  assetRowSelected: {
    borderColor: '#4ade80',
    backgroundColor: '#0D2137',
  },
  assetName: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  assetType: {
    color: '#475569',
    fontSize: 11,
    marginRight: 8,
  },
  assetCheck: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
  },
  confirmText: { color: '#4ade80', fontWeight: '700' },
});
