import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useFinmed } from '../hooks/useFinmed';
import DashboardHeader from '../components/dashboard/layout/DashboardHeader';
import MedicationDetailSheet from '../components/finmed/MedicationDetailSheet';
import FindashTransactionPicker from '../components/shared/FindashTransactionPicker';
import ReminderSetupModal from '../components/finmed/ReminderSetupModal';
import MeasurementLogSheet from '../components/finmed/MeasurementLogSheet';
import SymptomCheckSheet from '../components/finmed/SymptomCheckSheet';
import AppointmentModal from '../components/finmed/AppointmentModal';
import { logUI, uiPath, uiProps } from '../lib/devtools';
import { bottomInset } from '../lib/safeArea';
import type {
  FinmedMedication, FinmedReminder, ReminderType,
  MeasurementValue, SymptomCheckValue, FinmedReminderLog,
} from '../types/finmed';
import type { AppTransaction } from '../types/dashboard';

type Tab = 'today' | 'treatment' | 'progress';

const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  medication: 'Medication',
  measurement: 'Measurement',
  symptom_check: 'Symptom Check',
  appointment: 'Appointment',
};
const REMINDER_TYPE_ICONS: Record<ReminderType, string> = {
  medication: '💊',
  measurement: '📏',
  symptom_check: '😐',
  appointment: '📅',
};

export default function FinMedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { bottom } = useSafeAreaInsets();

  const {
    medications, loading,
    schedulesByMed, intakeLogsByMed,
    loadSchedules, loadIntakeLogs,
    createMedication, updateMedication, deleteMedication,
    createSchedule, deactivateSchedule,
    logIntake, createStockTransaction,
    reminders, remindersLoading,
    saveReminder, deleteReminder,
    logReminderAction, getReminderLogs,
    getTodayReminders,
    persistentSymptoms,
    addPersistentSymptom, removePersistentSymptom,
  } = useFinmed(user);

  const [activeTab, setActiveTab] = useState<Tab>('today');

  // ─── Medication detail state ──────────────────────────────────────────────
  const [selectedMed, setSelectedMed] = useState<FinmedMedication | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showTxPicker, setShowTxPicker] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<FinmedMedication | null>(null);
  const [medName, setMedName] = useState('');
  const [medForm, setMedForm] = useState('');
  const [medUnit, setMedUnit] = useState('');
  const [medStock, setMedStock] = useState('0');
  const [medThreshold, setMedThreshold] = useState('0');
  const [medNotes, setMedNotes] = useState('');
  const [medSaving, setMedSaving] = useState(false);
  const [pickedTx, setPickedTx] = useState<AppTransaction | null>(null);
  const [showTxLinkModal, setShowTxLinkModal] = useState(false);
  const [txQty, setTxQty] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txLinking, setTxLinking] = useState(false);

  // ─── Reminder setup state ─────────────────────────────────────────────────
  const [showReminderSetup, setShowReminderSetup] = useState(false);
  const [editingReminder, setEditingReminder] = useState<FinmedReminder | null>(null);
  const [addReminderType, setAddReminderType] = useState<ReminderType | undefined>(undefined);

  // ─── Active log sheet state ───────────────────────────────────────────────
  const [logReminder, setLogReminder] = useState<FinmedReminder | null>(null);
  const [showMeasurementLog, setShowMeasurementLog] = useState(false);
  const [showSymptomCheck, setShowSymptomCheck] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);

  // ─── Progress tab ─────────────────────────────────────────────────────────
  const [progressLogs, setProgressLogs] = useState<FinmedReminderLog[]>([]);
  const [progressFilter, setProgressFilter] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // ─── Today: resolved accordion ────────────────────────────────────────────
  const [resolvedOpen, setResolvedOpen] = useState(false);

  // ─── Load schedules for medication reminders + Today view ─────────────────
  useEffect(() => {
    for (const med of medications) void loadSchedules(med.id);
  }, [medications, loadSchedules]);

  useFocusEffect(
    useCallback(() => {
      for (const med of medications) void loadSchedules(med.id);
    }, [medications, loadSchedules]),
  );

  useEffect(() => {
    if (selectedMed) {
      void loadSchedules(selectedMed.id);
      void loadIntakeLogs(selectedMed.id);
    }
  }, [selectedMed, loadSchedules, loadIntakeLogs]);

  useEffect(() => {
    if (selectedMed) {
      const updated = medications.find((m) => m.id === selectedMed.id);
      if (updated && updated !== selectedMed) setSelectedMed(updated);
    }
  }, [medications, selectedMed]);

  // Load progress logs when tab opens
  useEffect(() => {
    if (activeTab === 'progress') {
      setProgressLoading(true);
      void getReminderLogs(progressFilter ?? undefined).then((logs) => {
        setProgressLogs(logs);
        setProgressLoading(false);
      });
    }
  }, [activeTab, progressFilter, getReminderLogs]);

  // ─── Today items ─────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMedItems = useMemo(() => {
    return medications.flatMap((med) => {
      const active = (schedulesByMed[med.id] ?? []).filter(
        (s) => s.active && s.start_date <= todayStr && (!s.end_date || s.end_date >= todayStr),
      );
      return active.flatMap((sched) => sched.times_of_day.map((t) => ({ med, sched, time: t })));
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, schedulesByMed, todayStr]);

  const todayReminderSlots = useMemo(() => getTodayReminders(), [getTodayReminders]);

  // Combine: reminder slots first (sorted by time), then legacy med items
  const allTodayItems = useMemo(() => {
    return [...todayReminderSlots, ...todayMedItems.map((m) => ({ med: m.med, sched: m.sched, time: m.time }))];
  }, [todayReminderSlots, todayMedItems]);

  // ─── Handlers: medication CRUD ───────────────────────────────────────────
  const openCreateMed = useCallback(() => {
    setEditingMed(null);
    setMedName(''); setMedForm(''); setMedUnit('');
    setMedStock('0'); setMedThreshold('0'); setMedNotes('');
    setShowMedModal(true);
  }, []);

  const handleSaveMed = async () => {
    setMedSaving(true);
    const ok = await createMedication(medName.trim(), medForm.trim() || 'tablet', medUnit.trim() || 'mg', parseFloat(medStock) || 0, parseFloat(medThreshold) || 0, medNotes.trim() || null);
    setMedSaving(false);
    if (ok) setShowMedModal(false);
  };

  const handleDetailUpdate = async (patch: Partial<FinmedMedication>) => {
    if (!selectedMed) return false;
    const ok = await updateMedication(selectedMed.id, patch as any);
    if (ok) {
      const updated = medications.find((m) => m.id === selectedMed.id);
      if (updated) setSelectedMed(updated);
    }
    return ok;
  };

  const handlePickTransaction = async (tx: AppTransaction) => {
    setPickedTx(tx);
    setShowTxPicker(false);
    setShowTxLinkModal(true);
  };

  const handleConfirmLink = async () => {
    if (!selectedMed || !pickedTx) return;
    setTxLinking(true);
    await createStockTransaction(selectedMed, pickedTx.id, parseFloat(txQty) || 0, parseFloat(txPrice) || 0);
    setTxLinking(false);
    setShowTxLinkModal(false);
    setPickedTx(null); setTxQty(''); setTxPrice('');
  };

  // ─── Handlers: reminder logging ───────────────────────────────────────────
  const openLogSheet = (reminder: FinmedReminder) => {
    setLogReminder(reminder);
    if (reminder.type === 'measurement') setShowMeasurementLog(true);
    else if (reminder.type === 'symptom_check') setShowSymptomCheck(true);
    else if (reminder.type === 'appointment') setShowAppointment(true);
    else {
      // medication reminder — quick complete
      void logReminderAction(reminder.id, 'complete');
    }
  };

  const handleMeasurementComplete = async (value: MeasurementValue, note?: string) => {
    if (!logReminder) return;
    await logReminderAction(logReminder.id, 'complete', value, note);
  };

  const handleSymptomComplete = async (value: SymptomCheckValue, note?: string) => {
    if (!logReminder) return;
    await logReminderAction(logReminder.id, 'complete', value as any, note);
  };

  const handleApptComplete = async (note?: string) => {
    if (!logReminder) return;
    await logReminderAction(logReminder.id, 'complete', {}, note);
  };

  const handleSnooze = async (minutes: number, until: string) => {
    if (!logReminder) return;
    await logReminderAction(logReminder.id, 'snooze', undefined, undefined, until);
  };

  const handleIgnore = async () => {
    if (!logReminder) return;
    await logReminderAction(logReminder.id, 'ignore');
  };

  // ─── Treatment tab: grouped reminders ────────────────────────────────────
  const remindersByType = useMemo(() => {
    const groups: Partial<Record<ReminderType, FinmedReminder[]>> = {};
    for (const r of reminders) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type]!.push(r);
    }
    return groups;
  }, [reminders]);

  const reminderTypeOrder: ReminderType[] = ['medication', 'measurement', 'symptom_check', 'appointment'];

  // ─── Progress tab: grouped logs ──────────────────────────────────────────
  const groupedLogs = useMemo(() => {
    const byReminder: Record<string, { reminder: FinmedReminder | undefined; logs: FinmedReminderLog[] }> = {};
    for (const log of progressLogs) {
      if (!byReminder[log.reminder_id]) {
        byReminder[log.reminder_id] = {
          reminder: reminders.find((r) => r.id === log.reminder_id),
          logs: [],
        };
      }
      byReminder[log.reminder_id].logs.push(log);
    }
    return Object.values(byReminder);
  }, [progressLogs, reminders]);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const TABS: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'treatment', label: 'Treatment' },
    { key: 'progress', label: 'Progress' },
  ];

  return (
    <View {...uiProps(uiPath('finmed', 'screen', 'container'))} style={styles.screen}>
      <DashboardHeader
        onBack={() => { logUI(uiPath('finmed', 'header', 'back_button'), 'press'); navigation.goBack(); }}
        rightElement={
          <TouchableOpacity
            {...uiProps(uiPath('finmed', 'header', 'add_button'))}
            style={styles.addButton}
            onPress={() => {
              logUI(uiPath('finmed', 'header', 'add_button'), 'press');
              if (activeTab === 'treatment') {
                setEditingReminder(null);
                setAddReminderType(undefined);
                setShowReminderSetup(true);
              } else {
                openCreateMed();
              }
            }}
          >
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        }
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            {...uiProps(uiPath('finmed', 'tab_bar', tab.key))}
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => { logUI(uiPath('finmed', 'tab_bar', tab.key), 'press'); setActiveTab(tab.key); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        {...uiProps(uiPath('finmed', 'screen', 'scroll_view'))}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset(16, bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════ TODAY TAB ══════════════════════ */}
        {activeTab === 'today' && (
          <>
            {/* Date header */}
            <View style={styles.dateCard}>
              <Text style={styles.dateCardText}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>

            {loading && remindersLoading && allTodayItems.length === 0 ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : allTodayItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nothing scheduled for today</Text>
                <Text style={styles.emptyHint}>Add a reminder in the Treatment tab to see today's schedule here.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionHeader}>Upcoming</Text>
                {allTodayItems.map((item, idx) => {
                  if ('reminder' in item) {
                    const { reminder, time } = item;
                    return (
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'today', 'reminder_row', reminder.id))}
                        key={`r_${reminder.id}_${idx}`}
                        style={styles.todayCard}
                        onPress={() => { logUI(uiPath('finmed', 'today', 'reminder_row', reminder.id), 'press'); openLogSheet(reminder); }}
                      >
                        <View style={styles.todayTimeCol}>
                          <Text style={styles.todayTimeText}>{time ?? '—'}</Text>
                          <Text style={styles.todayTypeIcon}>{REMINDER_TYPE_ICONS[reminder.type]}</Text>
                        </View>
                        <View style={styles.todayInfo}>
                          <Text style={styles.todayMedName}>{reminder.label}</Text>
                          <Text style={styles.todayDose}>{REMINDER_TYPE_LABELS[reminder.type]}</Text>
                        </View>
                        <TouchableOpacity
                          {...uiProps(uiPath('finmed', 'today', 'complete_button', reminder.id))}
                          style={styles.takeBtn}
                          onPress={() => { logUI(uiPath('finmed', 'today', 'complete_button', reminder.id), 'press'); void logReminderAction(reminder.id, 'complete'); }}
                        >
                          <Text style={styles.takeBtnText}>✓</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  }
                  // Legacy medication schedule item
                  const { med, sched, time } = item as { med: FinmedMedication; sched: any; time: string };
                  const isLow = med.stock_quantity <= med.stock_low_threshold;
                  return (
                    <View
                      {...uiProps(uiPath('finmed', 'today', 'item', `${med.id}_${time}`))}
                      key={`m_${med.id}_${time}_${idx}`}
                      style={styles.todayCard}
                    >
                      <View style={styles.todayTimeCol}>
                        <Text style={styles.todayTimeText}>{time}</Text>
                        <Text style={styles.todayTypeIcon}>💊</Text>
                      </View>
                      <View style={styles.todayInfo}>
                        <Text style={styles.todayMedName}>{med.name}</Text>
                        <Text style={styles.todayDose}>
                          {sched.dose_amount} {sched.dose_unit}
                          {isLow ? ` · ⚠ low stock` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'today', 'take_button', `${med.id}_${time}`))}
                        style={styles.takeBtn}
                        onPress={() => { logUI(uiPath('finmed', 'today', 'take_button', `${med.id}_${time}`), 'press'); void logIntake(med, sched.id, sched.dose_amount, null); }}
                      >
                        <Text style={styles.takeBtnText}>Take</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Resolved accordion */}
                <TouchableOpacity style={styles.accordionHeader} onPress={() => setResolvedOpen((v) => !v)}>
                  <Text style={styles.accordionTitle}>Resolved today</Text>
                  <Text style={styles.accordionChevron}>{resolvedOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {resolvedOpen && (
                  <View style={styles.resolvedBlock}>
                    <Text style={styles.resolvedHint}>Completed and ignored reminders will appear here.</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════ TREATMENT TAB ══════════════════════ */}
        {activeTab === 'treatment' && (
          <>
            {(loading || remindersLoading) && medications.length === 0 && reminders.length === 0 ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : (
              <>
                {reminderTypeOrder.map((type) => {
                  const group = remindersByType[type];
                  if (!group || group.length === 0) return null;
                  return (
                    <View key={type} style={styles.treatmentGroup}>
                      <Text style={styles.treatmentGroupTitle}>
                        {REMINDER_TYPE_ICONS[type]}  {REMINDER_TYPE_LABELS[type]}
                      </Text>
                      {group.map((r) => {
                        const linkedMed = r.type === 'medication'
                          ? medications.find((m) => m.id === (r.type_config as any).medication_id)
                          : null;
                        const isLow = linkedMed && linkedMed.stock_quantity <= linkedMed.stock_low_threshold;
                        return (
                          <TouchableOpacity
                            {...uiProps(uiPath('finmed', 'treatment', 'reminder_row', r.id))}
                            key={r.id}
                            style={styles.reminderRow}
                            onPress={() => { logUI(uiPath('finmed', 'treatment', 'reminder_row', r.id), 'press'); setEditingReminder(r); setShowReminderSetup(true); }}
                          >
                            <View style={styles.reminderRowLeft}>
                              <Text style={styles.reminderRowLabel}>{r.label}</Text>
                              <Text style={styles.reminderRowMeta}>
                                {r.frequency_type === 'on_demand' ? 'On demand' : r.frequency_type.replace('_', ' ')}
                                {linkedMed ? ` · ${linkedMed.name}` : ''}
                              </Text>
                              {isLow && <Text style={styles.lowBadge}>LOW STOCK</Text>}
                            </View>
                            <Text style={styles.reminderRowChevron}>›</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}

                {/* Medications without reminders */}
                {medications.length > 0 && (
                  <View style={styles.treatmentGroup}>
                    <Text style={styles.treatmentGroupTitle}>💊  Medications (stock)</Text>
                    {medications.map((med) => {
                      const isLow = med.stock_quantity <= med.stock_low_threshold;
                      return (
                        <TouchableOpacity
                          {...uiProps(uiPath('finmed', 'med_list', 'row', med.id))}
                          key={med.id}
                          style={styles.medRow}
                          onPress={() => { logUI(uiPath('finmed', 'med_list', 'row', med.id), 'press'); setSelectedMed(med); setShowDetailSheet(true); }}
                        >
                          <View style={styles.medRowLeft}>
                            <Text style={styles.medRowName}>{med.name}</Text>
                            <Text style={styles.medRowMeta}>{med.form} · {med.unit}</Text>
                          </View>
                          <View style={styles.medRowRight}>
                            <Text style={[styles.medRowStock, isLow && styles.medRowStockLow]}>{med.stock_quantity}</Text>
                            <Text style={styles.medRowUnit}>{med.unit}</Text>
                            {isLow && <Text style={styles.lowBadge}>LOW</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {reminders.length === 0 && medications.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No reminders yet</Text>
                    <Text style={styles.emptyHint}>Tap ＋ to add your first reminder.</Text>
                    <TouchableOpacity style={styles.emptyButton} onPress={() => { setEditingReminder(null); setAddReminderType(undefined); setShowReminderSetup(true); }}>
                      <Text style={styles.emptyButtonText}>Add Reminder</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════ PROGRESS TAB ══════════════════════ */}
        {activeTab === 'progress' && (
          <>
            {/* Filter chips */}
            {reminders.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !progressFilter && styles.filterChipActive]}
                  onPress={() => setProgressFilter(null)}
                >
                  <Text style={[styles.filterChipText, !progressFilter && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {reminders.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.filterChip, progressFilter === r.id && styles.filterChipActive]}
                    onPress={() => setProgressFilter(r.id)}
                  >
                    <Text style={[styles.filterChipText, progressFilter === r.id && styles.filterChipTextActive]}>
                      {REMINDER_TYPE_ICONS[r.type]} {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {progressLoading ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : groupedLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No logs yet</Text>
                <Text style={styles.emptyHint}>Complete reminders to see your history here.</Text>
              </View>
            ) : (
              groupedLogs.map(({ reminder, logs }) => (
                <View key={reminder?.id ?? 'unknown'} style={styles.progressGroup}>
                  <Text style={styles.progressGroupTitle}>
                    {reminder ? `${REMINDER_TYPE_ICONS[reminder.type]} ${reminder.label}` : 'Unknown reminder'}
                  </Text>
                  {logs.map((log) => (
                    <View key={log.id} style={styles.logRow}>
                      <Text style={styles.logAction}>
                        {log.action === 'complete' ? '✓' : log.action === 'ignore' ? '✗' : '↺'}
                      </Text>
                      <Text style={styles.logDate}>{formatDateTime(log.created_at)}</Text>
                      {log.value && Object.keys(log.value).length > 0 && (
                        <Text style={styles.logValue}>
                          {JSON.stringify(log.value).slice(0, 40)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── Modals ── */}

      {/* New medication modal */}
      <Modal visible={showMedModal} transparent animationType="slide" onRequestClose={() => setShowMedModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Medication</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={medName} onChangeText={setMedName} placeholder="e.g. Ventolin" placeholderTextColor="#475569" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Form</Text>
                <TextInput style={styles.input} value={medForm} onChangeText={setMedForm} placeholder="tablet" placeholderTextColor="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput style={styles.input} value={medUnit} onChangeText={setMedUnit} placeholder="mg" placeholderTextColor="#475569" />
              </View>
            </View>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Initial stock</Text>
                <TextInput style={styles.input} value={medStock} onChangeText={setMedStock} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Low threshold</Text>
                <TextInput style={styles.input} value={medThreshold} onChangeText={setMedThreshold} keyboardType="decimal-pad" />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput style={styles.input} value={medNotes} onChangeText={setMedNotes} placeholder="Any notes" placeholderTextColor="#475569" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowMedModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (!medName.trim() || medSaving) && styles.submitDisabled]}
                onPress={() => void handleSaveMed()}
                disabled={!medName.trim() || medSaving}
              >
                <Text style={styles.submitText}>{medSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transaction link modal */}
      <Modal visible={showTxLinkModal} transparent animationType="slide" onRequestClose={() => setShowTxLinkModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Link Transaction</Text>
            {pickedTx && <Text style={styles.txInfoText}>{pickedTx.date} · {pickedTx.note ?? 'Transaction'} · {pickedTx.amount.toFixed(2)}</Text>}
            <Text style={styles.fieldLabel}>Quantity added</Text>
            <TextInput style={styles.input} value={txQty} onChangeText={setTxQty} keyboardType="decimal-pad" placeholder="e.g. 30" placeholderTextColor="#475569" />
            <Text style={styles.fieldLabel}>Price allocated</Text>
            <TextInput style={styles.input} value={txPrice} onChangeText={setTxPrice} keyboardType="decimal-pad" placeholder="e.g. 12.50" placeholderTextColor="#475569" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowTxLinkModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, txLinking && styles.submitDisabled]}
                onPress={() => void handleConfirmLink()}
                disabled={txLinking}
              >
                <Text style={styles.submitText}>{txLinking ? 'Linking…' : 'Link'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MedicationDetailSheet
        visible={showDetailSheet}
        medication={selectedMed}
        schedules={selectedMed ? (schedulesByMed[selectedMed.id] ?? []) : []}
        intakeLogs={selectedMed ? (intakeLogsByMed[selectedMed.id] ?? []) : []}
        onClose={() => setShowDetailSheet(false)}
        onUpdate={handleDetailUpdate}
        onDelete={async () => selectedMed ? deleteMedication(selectedMed.id) : false}
        onLogIntake={async (dose, note) => selectedMed ? logIntake(selectedMed, null, dose, note) : false}
        onAddSchedule={() => { /* handled via ReminderSetupModal */ }}
        onDeactivateSchedule={(sid) => selectedMed ? deactivateSchedule(sid, selectedMed.id) : Promise.resolve(false)}
        onLinkTransaction={() => setShowTxPicker(true)}
      />

      <ReminderSetupModal
        visible={showReminderSetup}
        onClose={() => { setShowReminderSetup(false); setEditingReminder(null); }}
        onSave={saveReminder}
        medications={medications.map((m) => ({ id: m.id, name: m.name, unit: m.unit }))}
        initialType={addReminderType}
        editing={editingReminder}
      />

      {logReminder?.type === 'measurement' && (
        <MeasurementLogSheet
          visible={showMeasurementLog}
          reminder={logReminder}
          onComplete={handleMeasurementComplete}
          onSnooze={handleSnooze}
          onIgnore={handleIgnore}
          onClose={() => { setShowMeasurementLog(false); setLogReminder(null); }}
        />
      )}

      {logReminder?.type === 'symptom_check' && (
        <SymptomCheckSheet
          visible={showSymptomCheck}
          reminder={logReminder}
          persistentSymptoms={persistentSymptoms}
          onComplete={handleSymptomComplete}
          onSnooze={handleSnooze}
          onIgnore={handleIgnore}
          onAddPersistentSymptom={addPersistentSymptom}
          onRemovePersistentSymptom={removePersistentSymptom}
          onClose={() => { setShowSymptomCheck(false); setLogReminder(null); }}
        />
      )}

      {logReminder?.type === 'appointment' && (
        <AppointmentModal
          visible={showAppointment}
          reminder={logReminder}
          onComplete={handleApptComplete}
          onSnooze={handleSnooze}
          onIgnore={handleIgnore}
          onClose={() => { setShowAppointment(false); setLogReminder(null); }}
        />
      )}

      <FindashTransactionPicker
        visible={showTxPicker}
        onClose={() => setShowTxPicker(false)}
        onSelect={handlePickTransaction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060D18' },
  addButton: { width: 32, alignItems: 'flex-end' },
  addButtonText: { color: '#F472B6', fontSize: 22, fontWeight: '400', lineHeight: 24 },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderColor: '#1F3A59', gap: 4,
  },
  tabItem: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#0E1A2B', alignItems: 'center',
  },
  tabItemActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  tabText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#F472B6' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingText: { color: '#475569', textAlign: 'center', marginTop: 40 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: '#CBD5E1', fontSize: 18, fontWeight: '700' },
  emptyHint: { color: '#475569', fontSize: 13, textAlign: 'center', maxWidth: 280 },
  emptyButton: {
    marginTop: 10, backgroundColor: '#2d0a1a', borderRadius: 8,
    borderWidth: 1, borderColor: '#F472B6', paddingHorizontal: 24, paddingVertical: 10,
  },
  emptyButtonText: { color: '#F472B6', fontWeight: '700' },
  // Today
  dateCard: {
    backgroundColor: '#0B1728', borderRadius: 10, borderWidth: 1, borderColor: '#1F3A59',
    padding: 14, marginBottom: 14, alignItems: 'center',
  },
  dateCardText: { color: '#8FA8C9', fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  todayCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1728',
    borderRadius: 10, borderWidth: 1, borderColor: '#1F3A59',
    padding: 12, marginBottom: 8, gap: 10,
  },
  todayTimeCol: { width: 50, alignItems: 'center', gap: 2 },
  todayTimeText: { color: '#8FA8C9', fontSize: 12, fontWeight: '700' },
  todayTypeIcon: { fontSize: 16 },
  todayInfo: { flex: 1 },
  todayMedName: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  todayDose: { color: '#475569', fontSize: 12, marginTop: 2 },
  takeBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
    backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6',
  },
  takeBtnText: { color: '#F472B6', fontSize: 12, fontWeight: '700' },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, marginTop: 8,
  },
  accordionTitle: { color: '#475569', fontSize: 13, fontWeight: '600' },
  accordionChevron: { color: '#475569', fontSize: 12 },
  resolvedBlock: { paddingBottom: 8 },
  resolvedHint: { color: '#475569', fontSize: 12, fontStyle: 'italic' },
  // Treatment
  treatmentGroup: { marginBottom: 20 },
  treatmentGroupTitle: {
    color: '#8FA8C9', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  reminderRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1728',
    borderRadius: 10, borderWidth: 1, borderColor: '#1F3A59', padding: 14, marginBottom: 6,
  },
  reminderRowLeft: { flex: 1 },
  reminderRowLabel: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  reminderRowMeta: { color: '#475569', fontSize: 12, marginTop: 2 },
  reminderRowChevron: { color: '#475569', fontSize: 18 },
  medRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1728',
    borderRadius: 10, borderWidth: 1, borderColor: '#1F3A59', padding: 14, marginBottom: 6,
  },
  medRowLeft: { flex: 1 },
  medRowName: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  medRowMeta: { color: '#475569', fontSize: 12, marginTop: 2 },
  medRowRight: { alignItems: 'flex-end', gap: 2 },
  medRowStock: { color: '#CBD5E1', fontSize: 16, fontWeight: '700' },
  medRowStockLow: { color: '#FBBF24' },
  medRowUnit: { color: '#475569', fontSize: 11 },
  lowBadge: {
    color: '#FBBF24', fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, borderColor: '#FBBF24', backgroundColor: '#1a1000',
  },
  // Progress
  filterRow: { flexGrow: 0, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#0E1A2B', marginRight: 6,
  },
  filterChipActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  filterChipText: { color: '#475569', fontSize: 12 },
  filterChipTextActive: { color: '#F472B6', fontWeight: '600' },
  progressGroup: { marginBottom: 20 },
  progressGroupTitle: { color: '#8FA8C9', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderColor: '#0E1A2B',
  },
  logAction: { fontSize: 16, width: 20 },
  logDate: { color: '#475569', fontSize: 12, flex: 1 },
  logValue: { color: '#8FA8C9', fontSize: 11, maxWidth: 120 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0B1728', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#1F3A59',
  },
  modalTitle: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  fieldLabel: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 5,
  },
  row2: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 8, color: '#CBD5E1', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center' },
  cancelText: { color: '#64748B', fontWeight: '600' },
  submitButton: { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center' },
  submitDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  submitText: { color: '#F472B6', fontWeight: '700' },
  txInfoText: { color: '#8FA8C9', fontSize: 13, marginBottom: 10 },
});
