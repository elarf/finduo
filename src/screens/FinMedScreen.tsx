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
import ScheduleModal from '../components/finmed/ScheduleModal';
import FindashTransactionPicker from '../components/shared/FindashTransactionPicker';
import { logUI, uiPath, uiProps } from '../lib/devtools';
import { bottomInset } from '../lib/safeArea';
import type { FinmedMedication } from '../types/finmed';
import type { AppTransaction } from '../types/dashboard';

type Tab = 'today' | 'medications';

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
  } = useFinmed(user);

  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [selectedMed, setSelectedMed] = useState<FinmedMedication | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTxPicker, setShowTxPicker] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<FinmedMedication | null>(null);

  // New medication form state
  const [medName, setMedName] = useState('');
  const [medForm, setMedForm] = useState('');
  const [medUnit, setMedUnit] = useState('');
  const [medStock, setMedStock] = useState('0');
  const [medThreshold, setMedThreshold] = useState('0');
  const [medNotes, setMedNotes] = useState('');
  const [medSaving, setMedSaving] = useState(false);

  // Load all schedules for Today view whenever medications change
  useEffect(() => {
    for (const med of medications) {
      void loadSchedules(med.id);
    }
  }, [medications, loadSchedules]);

  // Load schedules + intake logs when a detail sheet opens
  useEffect(() => {
    if (selectedMed) {
      void loadSchedules(selectedMed.id);
      void loadIntakeLogs(selectedMed.id);
    }
  }, [selectedMed, loadSchedules, loadIntakeLogs]);

  useFocusEffect(
    useCallback(() => {
      for (const med of medications) {
        void loadSchedules(med.id);
      }
    }, [medications, loadSchedules]),
  );

  // Today view: flatten active schedules into time-based items
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayItems = useMemo(() => {
    return medications.flatMap((med) => {
      const active = (schedulesByMed[med.id] ?? []).filter(
        (s) => s.active && s.start_date <= todayStr && (!s.end_date || s.end_date >= todayStr),
      );
      return active.flatMap((sched) =>
        sched.times_of_day.map((t) => ({ med, sched, time: t })),
      );
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, schedulesByMed, todayStr]);

  const openCreateMed = useCallback(() => {
    setEditingMed(null);
    setMedName('');
    setMedForm('');
    setMedUnit('');
    setMedStock('0');
    setMedThreshold('0');
    setMedNotes('');
    setShowMedModal(true);
  }, []);

  const handleSaveMed = async () => {
    setMedSaving(true);
    const ok = await createMedication(
      medName.trim(),
      medForm.trim() || 'tablet',
      medUnit.trim() || 'mg',
      parseFloat(medStock) || 0,
      parseFloat(medThreshold) || 0,
      medNotes.trim() || null,
    );
    setMedSaving(false);
    if (ok) setShowMedModal(false);
  };

  const handleOpenDetail = (med: FinmedMedication) => {
    setSelectedMed(med);
    setShowDetailSheet(true);
  };

  const handleDetailUpdate = async (patch: Partial<FinmedMedication>) => {
    if (!selectedMed) return false;
    const ok = await updateMedication(selectedMed.id, patch as any);
    if (ok) {
      // Refresh selectedMed reference from updated list
      const updated = medications.find((m) => m.id === selectedMed.id);
      if (updated) setSelectedMed(updated);
    }
    return ok;
  };

  const handleDetailDelete = async () => {
    if (!selectedMed) return false;
    return deleteMedication(selectedMed.id);
  };

  const handleLogIntake = async (doseAmount: number, note: string | null) => {
    if (!selectedMed) return false;
    return logIntake(selectedMed, null, doseAmount, note);
  };

  const handlePickTransaction = async (tx: AppTransaction) => {
    // After picking, prompt for quantity + price via a simple inline state
    // We set the picker's selected tx and show a confirmation input
    setPickedTx(tx);
    setShowTxPicker(false);
    setShowTxLinkModal(true);
  };

  const [pickedTx, setPickedTx] = useState<AppTransaction | null>(null);
  const [showTxLinkModal, setShowTxLinkModal] = useState(false);
  const [txQty, setTxQty] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txLinking, setTxLinking] = useState(false);

  const handleConfirmLink = async () => {
    if (!selectedMed || !pickedTx) return;
    setTxLinking(true);
    await createStockTransaction(
      selectedMed,
      pickedTx.id,
      parseFloat(txQty) || 0,
      parseFloat(txPrice) || 0,
    );
    setTxLinking(false);
    setShowTxLinkModal(false);
    setPickedTx(null);
    setTxQty('');
    setTxPrice('');
  };

  // Keep selectedMed in sync after mutations
  useEffect(() => {
    if (selectedMed) {
      const updated = medications.find((m) => m.id === selectedMed.id);
      if (updated && updated !== selectedMed) setSelectedMed(updated);
    }
  }, [medications, selectedMed]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'medications', label: 'Medications' },
  ];

  return (
    <View {...uiProps(uiPath('finmed', 'screen', 'container'))} style={styles.screen}>
      <DashboardHeader
        onBack={() => {
          logUI(uiPath('finmed', 'header', 'back_button'), 'press');
          navigation.goBack();
        }}
        rightElement={
          <TouchableOpacity
            {...uiProps(uiPath('finmed', 'header', 'add_button'))}
            style={styles.addButton}
            onPress={() => {
              logUI(uiPath('finmed', 'header', 'add_button'), 'press');
              openCreateMed();
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
            onPress={() => {
              logUI(uiPath('finmed', 'tab_bar', tab.key), 'press');
              setActiveTab(tab.key);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        {...uiProps(uiPath('finmed', 'screen', 'scroll_view'))}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset(16, bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today' && (
          <>
            {loading && medications.length === 0 ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : todayItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nothing scheduled for today</Text>
                <Text style={styles.emptyHint}>
                  Add a medication and set up a schedule to see today's doses here.
                </Text>
              </View>
            ) : (
              todayItems.map(({ med, sched, time }, idx) => (
                <View
                  {...uiProps(uiPath('finmed', 'today', 'item', `${med.id}_${time}`))}
                  key={idx}
                  style={styles.todayCard}
                >
                  <View style={styles.todayTime}>
                    <Text style={styles.todayTimeText}>{time}</Text>
                  </View>
                  <View style={styles.todayInfo}>
                    <Text style={styles.todayMedName}>{med.name}</Text>
                    <Text style={styles.todayDose}>
                      {sched.dose_amount} {sched.dose_unit}
                      {med.stock_quantity <= med.stock_low_threshold
                        ? ` · ⚠ low stock (${med.stock_quantity} left)`
                        : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'today', 'take_button', `${med.id}_${time}`))}
                    style={styles.takeBtn}
                    onPress={() => {
                      logUI(uiPath('finmed', 'today', 'take_button', `${med.id}_${time}`), 'press');
                      void logIntake(med, sched.id, sched.dose_amount, null);
                    }}
                  >
                    <Text style={styles.takeBtnText}>Take</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'medications' && (
          <>
            {loading && medications.length === 0 ? (
              <Text style={styles.loadingText}>Loading…</Text>
            ) : medications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No medications yet</Text>
                <Text style={styles.emptyHint}>Tap ＋ to add your first medication.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={openCreateMed}>
                  <Text style={styles.emptyButtonText}>Add Medication</Text>
                </TouchableOpacity>
              </View>
            ) : (
              medications.map((med) => {
                const isLow = med.stock_quantity <= med.stock_low_threshold;
                return (
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'med_list', 'row', med.id))}
                    key={med.id}
                    style={styles.medRow}
                    onPress={() => {
                      logUI(uiPath('finmed', 'med_list', 'row', med.id), 'press');
                      handleOpenDetail(med);
                    }}
                  >
                    <View style={styles.medRowLeft}>
                      <Text style={styles.medRowName}>{med.name}</Text>
                      <Text style={styles.medRowMeta}>{med.form} · {med.unit}</Text>
                    </View>
                    <View style={styles.medRowRight}>
                      <Text style={[styles.medRowStock, isLow && styles.medRowStockLow]}>
                        {med.stock_quantity}
                      </Text>
                      <Text style={styles.medRowUnit}>{med.unit}</Text>
                      {isLow && <Text style={styles.lowBadge}>LOW</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Medication create modal */}
      <Modal visible={showMedModal} transparent animationType="slide" onRequestClose={() => setShowMedModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
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
            {pickedTx && (
              <Text style={styles.txInfoText}>
                {pickedTx.date} · {pickedTx.note ?? 'Transaction'} · {pickedTx.amount.toFixed(2)}
              </Text>
            )}
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
        onDelete={handleDetailDelete}
        onLogIntake={handleLogIntake}
        onAddSchedule={() => setShowScheduleModal(true)}
        onDeactivateSchedule={(scheduleId) => selectedMed ? deactivateSchedule(scheduleId, selectedMed.id) : Promise.resolve(false)}
        onLinkTransaction={() => setShowTxPicker(true)}
      />

      <ScheduleModal
        visible={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSave={(schedule) => selectedMed ? createSchedule(selectedMed.id, schedule) : Promise.resolve(false)}
      />

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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#1F3A59',
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
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
    marginTop: 10,
    backgroundColor: '#2d0a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F472B6',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyButtonText: { color: '#F472B6', fontWeight: '700' },
  // Today tab
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  todayTime: {
    width: 50,
    alignItems: 'center',
  },
  todayTimeText: { color: '#8FA8C9', fontSize: 13, fontWeight: '700' },
  todayInfo: { flex: 1 },
  todayMedName: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  todayDose: { color: '#475569', fontSize: 12, marginTop: 2 },
  takeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#2d0a1a',
    borderWidth: 1,
    borderColor: '#F472B6',
  },
  takeBtnText: { color: '#F472B6', fontSize: 12, fontWeight: '700' },
  // Medication list
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
    marginBottom: 8,
  },
  medRowLeft: { flex: 1 },
  medRowName: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  medRowMeta: { color: '#475569', fontSize: 12, marginTop: 2 },
  medRowRight: { alignItems: 'flex-end', gap: 2 },
  medRowStock: { color: '#CBD5E1', fontSize: 16, fontWeight: '700' },
  medRowStockLow: { color: '#FBBF24' },
  medRowUnit: { color: '#475569', fontSize: 11 },
  lowBadge: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#1a1000',
  },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
  },
  modalTitle: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  fieldLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 5,
  },
  row2: { flexDirection: 'row', gap: 10 },
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
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
  submitButton: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center',
  },
  submitDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  submitText: { color: '#F472B6', fontWeight: '700' },
  txInfoText: { color: '#8FA8C9', fontSize: 13, marginBottom: 10 },
});
