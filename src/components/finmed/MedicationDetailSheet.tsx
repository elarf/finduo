import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type { FinmedMedication, FinmedSchedule, FinmedIntakeLog } from '../../types/finmed';

interface MedicationDetailSheetProps {
  visible: boolean;
  medication: FinmedMedication | null;
  schedules: FinmedSchedule[];
  intakeLogs: FinmedIntakeLog[];
  onClose: () => void;
  onUpdate: (patch: Partial<Pick<FinmedMedication, 'name' | 'form' | 'unit' | 'stock_quantity' | 'stock_low_threshold' | 'notes'>>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onLogIntake: (doseAmount: number, note: string | null) => Promise<boolean>;
  onAddSchedule: () => void;
  onDeactivateSchedule: (scheduleId: string) => Promise<boolean>;
  onLinkTransaction: () => void;
}

export default function MedicationDetailSheet({
  visible, medication, schedules, intakeLogs,
  onClose, onUpdate, onDelete, onLogIntake,
  onAddSchedule, onDeactivateSchedule, onLinkTransaction,
}: MedicationDetailSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [form, setForm] = useState('');
  const [unit, setUnit] = useState('');
  const [threshold, setThreshold] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [intaking, setIntaking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [stockInput, setStockInput] = useState('');

  useEffect(() => {
    if (medication) {
      setName(medication.name);
      setForm(medication.form);
      setUnit(medication.unit);
      setThreshold(String(medication.stock_low_threshold));
      setNotes(medication.notes ?? '');
      setEditing(false);
      setConfirmDelete(false);
      setEditingStock(false);
      setStockInput(String(medication.stock_quantity));
    }
  }, [medication]);

  if (!medication) return null;

  const isLow = medication.stock_quantity <= medication.stock_low_threshold;
  const activeSchedules = schedules.filter((s) => s.active);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onUpdate({
      name: name.trim() || medication.name,
      form: form.trim() || medication.form,
      unit: unit.trim() || medication.unit,
      stock_low_threshold: parseFloat(threshold) || 0,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  const handleStockAdjust = async (delta: number) => {
    const next = Math.max(0, medication.stock_quantity + delta);
    await onUpdate({ stock_quantity: next });
  };

  const handleStockInputSubmit = async () => {
    const value = parseFloat(stockInput);
    if (!isNaN(value) && value >= 0) {
      await onUpdate({ stock_quantity: value });
    }
    setEditingStock(false);
  };

  const handleLogIntake = async () => {
    const dose = activeSchedules[0]?.dose_amount ?? 1;
    setIntaking(true);
    await onLogIntake(dose, logNote.trim() || null);
    setLogNote('');
    setIntaking(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />

            <View style={styles.titleRow}>
              {editing ? (
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Medication name"
                  placeholderTextColor="#475569"
                />
              ) : (
                <Text style={styles.medName}>{medication.name}</Text>
              )}
              <TouchableOpacity
                {...uiProps(uiPath('finmed', 'detail_sheet', 'edit_toggle'))}
                style={styles.editButton}
                onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'edit_toggle'), 'press'); setEditing((v) => !v); }}
              >
                <Text style={styles.editButtonText}>{editing ? 'Cancel' : '✎'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {editing ? (
                <View style={styles.editSection}>
                  <Text style={styles.label}>Form</Text>
                  <TextInput
                    {...uiProps(uiPath('finmed', 'detail_sheet', 'form_input'))}
                    style={styles.input}
                    value={form}
                    onChangeText={setForm}
                    placeholder="tablet / inhaler / liquid"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    {...uiProps(uiPath('finmed', 'detail_sheet', 'unit_input'))}
                    style={styles.input}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="mg / ml / puff"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.label}>Low stock threshold</Text>
                  <TextInput
                    {...uiProps(uiPath('finmed', 'detail_sheet', 'threshold_input'))}
                    style={styles.input}
                    value={threshold}
                    onChangeText={setThreshold}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    {...uiProps(uiPath('finmed', 'detail_sheet', 'notes_input'))}
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder="Optional notes"
                    placeholderTextColor="#475569"
                  />
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'detail_sheet', 'save_button'))}
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={() => void handleSave()}
                    disabled={saving}
                  >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}><Text style={styles.metaChipText}>{medication.form}</Text></View>
                    <View style={styles.metaChip}><Text style={styles.metaChipText}>{medication.unit}</Text></View>
                  </View>

                  {/* Stock */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stock</Text>
                    <View style={styles.stockRow}>
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'detail_sheet', 'stock_decrement_button'))}
                        style={styles.stockBtn}
                        onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'stock_decrement_button'), 'press'); void handleStockAdjust(-1); }}
                      >
                        <Text style={styles.stockBtnText}>−</Text>
                      </TouchableOpacity>
                      {editingStock ? (
                        <TextInput
                          {...uiProps(uiPath('finmed', 'detail_sheet', 'stock_input'))}
                          style={[styles.input, styles.stockInput]}
                          value={stockInput}
                          onChangeText={setStockInput}
                          keyboardType="decimal-pad"
                          autoFocus
                          onBlur={() => void handleStockInputSubmit()}
                          onSubmitEditing={() => void handleStockInputSubmit()}
                        />
                      ) : (
                        <TouchableOpacity
                          {...uiProps(uiPath('finmed', 'detail_sheet', 'stock_value'))}
                          style={styles.stockValue}
                          onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'stock_value'), 'press'); setEditingStock(true); }}
                        >
                          <Text style={[styles.stockNum, isLow && { color: '#FBBF24' }]}>
                            {medication.stock_quantity}
                          </Text>
                          <Text style={styles.stockUnit}>{medication.unit}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'detail_sheet', 'stock_increment_button'))}
                        style={styles.stockBtn}
                        onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'stock_increment_button'), 'press'); void handleStockAdjust(1); }}
                      >
                        <Text style={styles.stockBtnText}>＋</Text>
                      </TouchableOpacity>
                    </View>
                    {isLow && (
                      <Text style={styles.lowStockWarning}>
                        ⚠ Low stock (threshold: {medication.stock_low_threshold} {medication.unit})
                      </Text>
                    )}
                  </View>

                  {/* Active schedules */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Schedules</Text>
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'detail_sheet', 'add_schedule_button'))}
                        style={styles.addBtn}
                        onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'add_schedule_button'), 'press'); onAddSchedule(); }}
                      >
                        <Text style={styles.addBtnText}>＋ Add</Text>
                      </TouchableOpacity>
                    </View>
                    {activeSchedules.length === 0 ? (
                      <Text style={styles.emptyHint}>No active schedules</Text>
                    ) : (
                      activeSchedules.map((s) => (
                        <View
                          {...uiProps(uiPath('finmed', 'detail_sheet', 'schedule_row', s.id))}
                          key={s.id}
                          style={styles.scheduleRow}
                        >
                          <View style={styles.schedulePrimary}>
                            <Text style={styles.scheduleTitle}>
                              {s.dose_amount} {s.dose_unit} × {s.times_per_day}×/day
                            </Text>
                            <Text style={styles.scheduleMeta}>
                              {s.type === 'finite' ? `${s.start_date} → ${s.end_date ?? '…'}` : `From ${s.start_date} · ongoing`}
                              {s.times_of_day.length > 0 ? ` · ${s.times_of_day.join(', ')}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            {...uiProps(uiPath('finmed', 'detail_sheet', 'deactivate_schedule_button', s.id))}
                            style={styles.deactivateBtn}
                            onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'deactivate_schedule_button', s.id), 'press'); void onDeactivateSchedule(s.id); }}
                          >
                            <Text style={styles.deactivateBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>

                  {/* Log intake */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Log Intake</Text>
                    <TextInput
                      {...uiProps(uiPath('finmed', 'detail_sheet', 'log_note_input'))}
                      style={styles.input}
                      value={logNote}
                      onChangeText={setLogNote}
                      placeholder="Note (optional)"
                      placeholderTextColor="#475569"
                    />
                    <TouchableOpacity
                      {...uiProps(uiPath('finmed', 'detail_sheet', 'log_intake_button'))}
                      style={[styles.actionBtn, intaking && styles.actionBtnDisabled]}
                      onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'log_intake_button'), 'press'); void handleLogIntake(); }}
                      disabled={intaking}
                    >
                      <Text style={styles.actionBtnText}>{intaking ? 'Logging…' : '💊 Log intake now'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Intake log */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Last 7 days</Text>
                    {intakeLogs.length === 0 ? (
                      <Text style={styles.emptyHint}>No logs this week</Text>
                    ) : (
                      intakeLogs.map((log) => (
                        <View
                          {...uiProps(uiPath('finmed', 'detail_sheet', 'intake_log_row', log.id))}
                          key={log.id}
                          style={styles.logRow}
                        >
                          <Text style={styles.logDose}>{log.dose_amount} {medication.unit}</Text>
                          <Text style={styles.logDate}>{formatDate(log.taken_at)}</Text>
                          {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
                        </View>
                      ))
                    )}
                  </View>

                  {/* Link transaction */}
                  <View style={styles.section}>
                    <TouchableOpacity
                      {...uiProps(uiPath('finmed', 'detail_sheet', 'link_transaction_button'))}
                      style={styles.secondaryBtn}
                      onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'link_transaction_button'), 'press'); onLinkTransaction(); }}
                    >
                      <Text style={styles.secondaryBtnText}>🔗 Link Findash transaction (stock refill)</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Delete */}
                  <View style={[styles.section, { marginTop: 8 }]}>
                    {confirmDelete ? (
                      <View style={styles.confirmDeleteRow}>
                        <Text style={styles.confirmDeleteText}>Delete this medication and all its data?</Text>
                        <View style={styles.confirmDeleteButtons}>
                          <TouchableOpacity
                            {...uiProps(uiPath('finmed', 'detail_sheet', 'cancel_delete_button'))}
                            style={styles.cancelBtn}
                            onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'cancel_delete_button'), 'press'); setConfirmDelete(false); }}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            {...uiProps(uiPath('finmed', 'detail_sheet', 'confirm_delete_button'))}
                            style={styles.deleteBtn}
                            onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'confirm_delete_button'), 'press'); void onDelete().then(() => onClose()); }}
                          >
                            <Text style={styles.deleteBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        {...uiProps(uiPath('finmed', 'detail_sheet', 'delete_button'))}
                        style={styles.deleteBtn}
                        onPress={() => { logUI(uiPath('finmed', 'detail_sheet', 'delete_button'), 'press'); setConfirmDelete(true); }}
                      >
                        <Text style={styles.deleteBtnText}>Delete medication</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    maxHeight: '90%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2C4669',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  medName: { flex: 1, color: '#CBD5E1', fontSize: 18, fontWeight: '700' },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  editButtonText: { color: '#8FA8C9', fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  metaChipText: { color: '#8FA8C9', fontSize: 12 },
  section: { marginBottom: 16 },
  sectionTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stockBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBtnText: { color: '#CBD5E1', fontSize: 18 },
  stockValue: { alignItems: 'center' },
  stockInput: {
    width: 100, textAlign: 'center', fontSize: 22, fontWeight: '700',
    paddingVertical: 4, marginBottom: 0,
  },
  stockNum: { color: '#CBD5E1', fontSize: 22, fontWeight: '700' },
  stockUnit: { color: '#475569', fontSize: 11 },
  lowStockWarning: { color: '#FBBF24', fontSize: 12, marginTop: 6 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  schedulePrimary: { flex: 1 },
  scheduleTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  scheduleMeta: { color: '#475569', fontSize: 11, marginTop: 2 },
  deactivateBtn: {
    padding: 4,
  },
  deactivateBtnText: { color: '#f87171', fontSize: 14 },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F472B6',
    backgroundColor: '#1a0510',
  },
  addBtnText: { color: '#F472B6', fontSize: 12, fontWeight: '600' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
  },
  logDose: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', width: 80 },
  logDate: { color: '#475569', fontSize: 11, flex: 1 },
  logNote: { color: '#8FA8C9', fontSize: 11, fontStyle: 'italic' },
  emptyHint: { color: '#475569', fontSize: 12, fontStyle: 'italic' },
  input: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
  },
  editSection: { paddingBottom: 8 },
  saveBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2d0a1a',
    borderWidth: 1,
    borderColor: '#F472B6',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  saveBtnText: { color: '#F472B6', fontWeight: '700' },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2d0a1a',
    borderWidth: 1,
    borderColor: '#F472B6',
    alignItems: 'center',
  },
  actionBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  actionBtnText: { color: '#F472B6', fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#8FA8C9', fontWeight: '600', fontSize: 13 },
  confirmDeleteRow: { gap: 8 },
  confirmDeleteText: { color: '#f87171', fontSize: 13 },
  confirmDeleteButtons: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  deleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a0000',
    borderWidth: 1,
    borderColor: '#f87171',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#f87171', fontWeight: '700' },
});
