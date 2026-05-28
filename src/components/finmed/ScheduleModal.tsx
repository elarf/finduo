import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type { FinmedSchedule } from '../../types/finmed';

type SchedulePayload = Omit<FinmedSchedule, 'id' | 'medication_id' | 'user_id' | 'created_at'>;

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (schedule: SchedulePayload) => Promise<boolean>;
}

const TIMES_PER_DAY_OPTIONS = [1, 2, 3, 4];

export default function ScheduleModal({ visible, onClose, onSave }: ScheduleModalProps) {
  const { bottom } = useSafeAreaInsets();
  const [type, setType] = useState<'finite' | 'ongoing'>('ongoing');
  const [doseAmount, setDoseAmount] = useState('1');
  const [doseUnit, setDoseUnit] = useState('tablet');
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [timesOfDay, setTimesOfDay] = useState<string[]>(['08:00']);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleTimesPerDayChange = (n: number) => {
    setTimesPerDay(n);
    setTimesOfDay((prev) => {
      const next = [...prev];
      while (next.length < n) next.push('08:00');
      return next.slice(0, n);
    });
  };

  const handleTimeChange = (index: number, value: string) => {
    setTimesOfDay((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const canSave = !!doseAmount && !!doseUnit && !!startDate && (type === 'ongoing' || !!endDate);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave({
      type,
      dose_amount: parseFloat(doseAmount) || 1,
      dose_unit: doseUnit.trim() || 'tablet',
      times_per_day: timesPerDay,
      times_of_day: timesOfDay,
      start_date: startDate,
      end_date: type === 'finite' && endDate ? endDate : null,
      active: true,
    });
    setSaving(false);
    if (ok) {
      setType('ongoing');
      setDoseAmount('1');
      setDoseUnit('tablet');
      setTimesPerDay(1);
      setTimesOfDay(['08:00']);
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrapper}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Add Schedule</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type */}
              <Text style={styles.label}>Type</Text>
              <View style={styles.toggleRow}>
                {(['ongoing', 'finite'] as const).map((t) => (
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'schedule_modal', 'type_option', t))}
                    key={t}
                    style={[styles.toggleOption, type === t && styles.toggleOptionActive]}
                    onPress={() => {
                      logUI(uiPath('finmed', 'schedule_modal', 'type_option', t), 'press');
                      setType(t);
                    }}
                  >
                    <Text style={[styles.toggleOptionText, type === t && styles.toggleOptionTextActive]}>
                      {t === 'ongoing' ? 'Ongoing' : 'Finite (with end date)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dose */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Dose amount</Text>
                  <TextInput
                    style={styles.input}
                    value={doseAmount}
                    onChangeText={setDoseAmount}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Dose unit</Text>
                  <TextInput
                    style={styles.input}
                    value={doseUnit}
                    onChangeText={setDoseUnit}
                    placeholder="tablet"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              {/* Times per day */}
              <Text style={styles.label}>Times per day</Text>
              <View style={styles.toggleRow}>
                {TIMES_PER_DAY_OPTIONS.map((n) => (
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'schedule_modal', 'times_per_day', String(n)))}
                    key={n}
                    style={[styles.tpdOption, timesPerDay === n && styles.tpdOptionActive]}
                    onPress={() => {
                      logUI(uiPath('finmed', 'schedule_modal', 'times_per_day', String(n)), 'press');
                      handleTimesPerDayChange(n);
                    }}
                  >
                    <Text style={[styles.tpdText, timesPerDay === n && styles.tpdTextActive]}>{n}×</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Times of day */}
              <Text style={styles.label}>Times of day</Text>
              {timesOfDay.map((t, i) => (
                <TextInput
                  key={i}
                  style={styles.input}
                  value={t}
                  onChangeText={(v) => handleTimeChange(i, v)}
                  placeholder="HH:MM"
                  placeholderTextColor="#475569"
                />
              ))}

              {/* Start date */}
              <Text style={styles.label}>Start date</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#475569"
              />

              {/* End date (finite only) */}
              {type === 'finite' && (
                <>
                  <Text style={styles.label}>End date</Text>
                  <TextInput
                    style={styles.input}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                  />
                </>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('finmed', 'schedule_modal', 'save_button'))}
                  style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
                  onPress={() => { logUI(uiPath('finmed', 'schedule_modal', 'save_button'), 'press'); void handleSave(); }}
                  disabled={!canSave || saving}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save schedule'}</Text>
                </TouchableOpacity>
              </View>
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
  wrapper: { justifyContent: 'flex-end' },
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
  title: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 5,
  },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  toggleOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  toggleOptionActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  toggleOptionText: { color: '#475569', fontSize: 13 },
  toggleOptionTextActive: { color: '#F472B6', fontWeight: '600' },
  tpdOption: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tpdOptionActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  tpdText: { color: '#475569', fontWeight: '700' },
  tpdTextActive: { color: '#F472B6' },
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
    marginBottom: 4,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2d0a1a',
    borderWidth: 1,
    borderColor: '#F472B6',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  saveBtnText: { color: '#F472B6', fontWeight: '700' },
});
