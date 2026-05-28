import React, { useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import ScrollWheelInput from './ScrollWheelInput';
import SnoozeSheet from './SnoozeSheet';
import type { FinmedReminder, MeasurementConfig, MeasurementValue } from '../../types/finmed';

function range(start: number, end: number, step = 1): string[] {
  const result: string[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(step < 1 ? i.toFixed(1) : String(i));
  }
  return result;
}

// Sensible wheel ranges per measurement kind
function getWheelItems(cfg: MeasurementConfig): { primary: string[]; secondary?: string[] } {
  switch (cfg.kind) {
    case 'weight':
      return { primary: range(30, 250), secondary: range(0, 9) };
    case 'temperature':
      return { primary: range(35, 42), secondary: range(0, 9) };
    case 'blood_pressure':
      return { primary: range(60, 220), secondary: range(40, 140) };
    case 'heart_rate':
      return { primary: range(30, 220) };
    case 'blood_oxygen':
      return { primary: range(70, 100) };
    case 'blood_glucose':
      return { primary: range(20, 500) };
    case 'sleep_duration':
      return { primary: range(0, 24), secondary: range(0, 59) };
    case 'water_intake':
      return { primary: range(0, 5000, 50) };
    case 'steps':
      return { primary: range(0, 50000, 500) };
    case 'mood_score':
      return { primary: range(0, 10) };
    default:
      return { primary: range(0, 999), secondary: range(0, 9) };
  }
}

const DEFAULT_PRIMARIES: Partial<Record<string, string>> = {
  weight: '80',
  temperature: '37',
  blood_pressure: '120',
  heart_rate: '70',
  blood_oxygen: '98',
  blood_glucose: '100',
  sleep_duration: '8',
  water_intake: '1500',
  steps: '5000',
  mood_score: '5',
};

interface MeasurementLogSheetProps {
  visible: boolean;
  reminder: FinmedReminder;
  onComplete: (value: MeasurementValue, note?: string) => Promise<void>;
  onSnooze: (minutes: number, until: string) => Promise<void>;
  onIgnore: () => Promise<void>;
  onClose: () => void;
}

export default function MeasurementLogSheet({
  visible, reminder, onComplete, onSnooze, onIgnore, onClose,
}: MeasurementLogSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const cfg = reminder.type_config as MeasurementConfig;
  const wheels = getWheelItems(cfg);
  const defaultPrimary = DEFAULT_PRIMARIES[cfg.kind] ?? wheels.primary[0] ?? '0';
  const defaultSecondary = cfg.kind === 'blood_pressure' ? '80' : wheels.secondary?.[0] ?? '0';

  const [primary, setPrimary] = useState(defaultPrimary);
  const [secondary, setSecondary] = useState(defaultSecondary);
  const [nicotineTaken, setNicotineTaken] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  const isBloodPressure = cfg.kind === 'blood_pressure';
  const isNicotinoYesNo = cfg.kind === 'nicotine' && cfg.nicotine_mode !== 'cigarettes';

  const handleComplete = async () => {
    setSaving(true);
    let value: MeasurementValue;
    if (isNicotinoYesNo) {
      value = { primary: nicotineTaken ? 1 : 0, nicotine_taken: nicotineTaken };
    } else if (isBloodPressure) {
      value = { primary: parseFloat(primary) || 120, secondary: parseFloat(secondary) || 80 };
    } else if (wheels.secondary) {
      // combine whole + decimal
      value = { primary: parseFloat(`${primary}.${secondary}`) || parseFloat(primary) };
    } else {
      value = { primary: parseFloat(primary) || 0 };
    }
    await onComplete(value, note.trim() || undefined);
    setSaving(false);
    onClose();
  };

  const unitLabel = cfg.unit || '';

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>{reminder.label}</Text>
            <Text style={styles.subtitle}>
              {cfg.kind === 'custom' ? (cfg.custom_name ?? 'Measurement') : KIND_LABELS[cfg.kind] ?? cfg.kind}
              {unitLabel ? `  ·  ${unitLabel}` : ''}
            </Text>

            {isNicotinoYesNo ? (
              <View style={styles.yesNoRow}>
                <TouchableOpacity
                  style={[styles.yesNoBtn, nicotineTaken && styles.yesNoBtnYes]}
                  onPress={() => setNicotineTaken(true)}
                >
                  <Text style={[styles.yesNoText, nicotineTaken && styles.yesNoTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.yesNoBtn, !nicotineTaken && styles.yesNoBtnNo]}
                  onPress={() => setNicotineTaken(false)}
                >
                  <Text style={[styles.yesNoText, !nicotineTaken && styles.yesNoTextActive]}>No</Text>
                </TouchableOpacity>
              </View>
            ) : isBloodPressure ? (
              <View style={styles.wheelsRow}>
                <View style={styles.wheelGroup}>
                  <Text style={styles.wheelLabel}>Systolic</Text>
                  <ScrollWheelInput items={wheels.primary} value={primary} onChange={setPrimary} />
                </View>
                <Text style={styles.wheelSep}>/</Text>
                <View style={styles.wheelGroup}>
                  <Text style={styles.wheelLabel}>Diastolic</Text>
                  <ScrollWheelInput items={wheels.secondary ?? []} value={secondary} onChange={setSecondary} />
                </View>
              </View>
            ) : wheels.secondary ? (
              <View style={styles.wheelsRow}>
                <ScrollWheelInput items={wheels.primary} value={primary} onChange={setPrimary} />
                <Text style={styles.wheelDot}>.</Text>
                <ScrollWheelInput items={wheels.secondary} value={secondary} onChange={setSecondary} />
              </View>
            ) : (
              <View style={styles.wheelsRow}>
                <ScrollWheelInput items={wheels.primary} value={primary} onChange={setPrimary} />
                {unitLabel ? <Text style={styles.wheelUnit}>{unitLabel}</Text> : null}
              </View>
            )}

            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor="#475569"
            />

            <View style={styles.actions}>
              <TouchableOpacity
                {...uiProps(uiPath('finmed', 'measurement_log', 'ignore_button'))}
                style={styles.ignoreBtn}
                onPress={async () => { await onIgnore(); onClose(); }}
              >
                <Text style={styles.ignoreBtnText}>Ignore</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...uiProps(uiPath('finmed', 'measurement_log', 'snooze_button'))}
                style={styles.snoozeBtn}
                onPress={() => setShowSnooze(true)}
              >
                <Text style={styles.snoozeBtnText}>Snooze</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...uiProps(uiPath('finmed', 'measurement_log', 'complete_button'))}
                style={[styles.completeBtn, saving && styles.completeBtnDisabled]}
                onPress={() => { logUI(uiPath('finmed', 'measurement_log', 'complete_button'), 'press'); void handleComplete(); }}
                disabled={saving}
              >
                <Text style={styles.completeBtnText}>{saving ? '…' : 'Complete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SnoozeSheet
        visible={showSnooze}
        onClose={() => setShowSnooze(false)}
        onSnooze={async (minutes, until) => { await onSnooze(minutes, until); onClose(); }}
      />
    </>
  );
}

const KIND_LABELS: Partial<Record<string, string>> = {
  weight: 'Weight',
  temperature: 'Temperature',
  blood_pressure: 'Blood pressure',
  heart_rate: 'Resting heart rate',
  blood_oxygen: 'Blood oxygen (SpO2)',
  blood_glucose: 'Blood glucose',
  nicotine: 'Nicotine',
  sleep_duration: 'Sleep duration',
  water_intake: 'Water intake',
  steps: 'Steps',
  mood_score: 'Mood score',
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderColor: '#1F3A59',
    paddingHorizontal: 16, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: '#2C4669', marginBottom: 12,
  },
  title: { color: '#CBD5E1', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8FA8C9', fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 20 },
  yesNoRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginVertical: 24 },
  yesNoBtn: {
    width: 110, height: 56, borderRadius: 12,
    borderWidth: 2, borderColor: '#1F3A59', backgroundColor: '#0E1A2B',
    alignItems: 'center', justifyContent: 'center',
  },
  yesNoBtnYes: { borderColor: '#4ade80', backgroundColor: '#052010' },
  yesNoBtnNo: { borderColor: '#f87171', backgroundColor: '#1a0000' },
  yesNoText: { color: '#475569', fontSize: 20, fontWeight: '700' },
  yesNoTextActive: { color: '#CBD5E1' },
  wheelsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginVertical: 20,
  },
  wheelGroup: { alignItems: 'center', gap: 6 },
  wheelLabel: { color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  wheelDot: { color: '#CBD5E1', fontSize: 28, fontWeight: '700', marginTop: 20 },
  wheelSep: { color: '#CBD5E1', fontSize: 28, fontWeight: '700', marginTop: 24 },
  wheelUnit: { color: '#8FA8C9', fontSize: 16, fontWeight: '600', marginTop: 18 },
  noteInput: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 8, color: '#CBD5E1', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  ignoreBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center',
  },
  ignoreBtnText: { color: '#64748B', fontWeight: '600' },
  snoozeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#8FA8C9',
    backgroundColor: '#0E1A2B', alignItems: 'center',
  },
  snoozeBtnText: { color: '#8FA8C9', fontWeight: '600' },
  completeBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center',
  },
  completeBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  completeBtnText: { color: '#F472B6', fontWeight: '700' },
});
