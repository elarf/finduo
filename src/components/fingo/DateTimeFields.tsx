import React, { useState } from 'react';
import {
  Modal, Platform, Pressable, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import DatePickerModal from '../dashboard/DatePickerModal';

interface Props {
  dateStr: string;
  timeStr: string;
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
  disabled?: boolean;
}

function openWebTimePicker(currentTime: string, onPick: (time: string) => void) {
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'time';
  input.value = currentTime;
  Object.assign(input.style, { position: 'fixed', top: '-200px', left: '-200px', opacity: '0' });
  const cleanup = () => { try { document.body.removeChild(input); } catch {} };
  input.onchange = () => { if (input.value) onPick(input.value); cleanup(); };
  // 'cancel' fires when the user dismisses the picker without selecting
  input.addEventListener('cancel', cleanup);
  document.body.appendChild(input);
  input.focus();
  try { (input as any).showPicker(); } catch {}
}

export default function DateTimeFields({ dateStr, timeStr, onDateChange, onTimeChange, disabled }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dpYear, setDpYear] = useState(() => (dateStr ? new Date(dateStr) : new Date()).getFullYear());
  const [dpMonth, setDpMonth] = useState(() => (dateStr ? new Date(dateStr) : new Date()).getMonth());
  const [showNativeTime, setShowNativeTime] = useState(false);
  const [nativeTimeInput, setNativeTimeInput] = useState('');

  const handleDatePress = () => {
    if (disabled) return;
    const d = dateStr ? new Date(dateStr) : new Date();
    setDpYear(d.getFullYear());
    setDpMonth(d.getMonth());
    setShowDatePicker(true);
  };

  const handleTimePress = () => {
    if (disabled) return;
    if (Platform.OS === 'web') {
      openWebTimePicker(timeStr, onTimeChange);
    } else {
      setNativeTimeInput(timeStr);
      setShowNativeTime(true);
    }
  };

  const commitNativeTime = () => {
    const clean = nativeTimeInput.trim();
    if (/^\d{1,2}:\d{2}$/.test(clean)) {
      const [h, m] = clean.split(':');
      if (Number(h) < 24 && Number(m) < 60) {
        const hh = String(Number(h)).padStart(2, '0');
        const mm = String(Number(m)).padStart(2, '0');
        onTimeChange(`${hh}:${mm}`);
      }
    }
    setShowNativeTime(false);
  };

  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.field, styles.datePart, disabled && styles.fieldDisabled]}
          onPress={handleDatePress}
          activeOpacity={0.7}
        >
          <Text style={[styles.fieldText, disabled && styles.fieldTextDisabled]}>
            {dateStr || 'Select date'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.field, styles.timePart, disabled && styles.fieldDisabled]}
          onPress={handleTimePress}
          activeOpacity={0.7}
        >
          <Text style={[styles.fieldText, disabled && styles.fieldTextDisabled]}>
            {timeStr || '--:--'}
          </Text>
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        entryDate={dateStr}
        setEntryDate={onDateChange}
        dpYear={dpYear}
        setDpYear={setDpYear}
        dpMonth={dpMonth}
        setDpMonth={setDpMonth}
      />

      {Platform.OS !== 'web' && (
        <Modal
          visible={showNativeTime}
          transparent
          animationType="fade"
          onRequestClose={() => setShowNativeTime(false)}
        >
          <Pressable style={styles.timeBackdrop} onPress={() => setShowNativeTime(false)}>
            <Pressable style={styles.timeCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.timeTitle}>Set time</Text>
              <TextInput
                style={styles.timeInput}
                value={nativeTimeInput}
                onChangeText={setNativeTimeInput}
                placeholder="HH:MM"
                placeholderTextColor="#475569"
                keyboardType="numbers-and-punctuation"
                autoFocus
                maxLength={5}
                onSubmitEditing={commitNativeTime}
              />
              <View style={styles.timeActions}>
                <TouchableOpacity style={styles.timeCancel} onPress={() => setShowNativeTime(false)}>
                  <Text style={styles.timeCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timeConfirm} onPress={commitNativeTime}>
                  <Text style={styles.timeConfirmText}>Set</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  field: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  datePart: { flex: 3 },
  timePart: { flex: 2 },
  fieldDisabled: { borderColor: '#0E1A2B' },
  fieldText: { color: '#CBD5E1', fontSize: 14 },
  fieldTextDisabled: { color: '#475569' },
  timeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCard: {
    backgroundColor: '#0B1728',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    width: 220,
  },
  timeTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  timeInput: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
    letterSpacing: 2,
  },
  timeActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  timeCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  timeCancelText: { color: '#64748B', fontWeight: '600' },
  timeConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  timeConfirmText: { color: '#4ade80', fontWeight: '700' },
});
