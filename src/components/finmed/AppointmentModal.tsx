import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import SnoozeSheet from './SnoozeSheet';
import type { FinmedReminder, AppointmentConfig } from '../../types/finmed';

interface AppointmentModalProps {
  visible: boolean;
  reminder: FinmedReminder;
  onComplete: (note?: string) => Promise<void>;
  onSnooze: (minutes: number, until: string) => Promise<void>;
  onIgnore: () => Promise<void>;
  onClose: () => void;
}

export default function AppointmentModal({
  visible, reminder, onComplete, onSnooze, onIgnore, onClose,
}: AppointmentModalProps) {
  const { bottom } = useSafeAreaInsets();
  const cfg = reminder.type_config as AppointmentConfig;
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    await onComplete(note.trim() || undefined);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrapper}>
            <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
              <View style={styles.handle} />
              <Text style={styles.title}>{reminder.label}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>Date</Text>
                  <Text style={styles.metaChipValue}>{cfg.date}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>Time</Text>
                  <Text style={styles.metaChipValue}>{cfg.time}</Text>
                </View>
              </View>

              {cfg.description ? (
                <View style={styles.descBlock}>
                  <Text style={styles.descLabel}>Description</Text>
                  <Text style={styles.descText}>{cfg.description}</Text>
                </View>
              ) : null}

              <Text style={styles.noteLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Any notes about this appointment"
                placeholderTextColor="#475569"
                multiline
                scrollEnabled={false}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  {...uiProps(uiPath('finmed', 'appointment', 'ignore_button'))}
                  style={styles.ignoreBtn}
                  onPress={async () => { logUI(uiPath('finmed', 'appointment', 'ignore_button'), 'press'); await onIgnore(); onClose(); }}
                >
                  <Text style={styles.ignoreBtnText}>Ignore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('finmed', 'appointment', 'snooze_button'))}
                  style={styles.snoozeBtn}
                  onPress={() => { logUI(uiPath('finmed', 'appointment', 'snooze_button'), 'press'); setShowSnooze(true); }}
                >
                  <Text style={styles.snoozeBtnText}>Snooze</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  {...uiProps(uiPath('finmed', 'appointment', 'complete_button'))}
                  style={[styles.completeBtn, saving && styles.completeBtnDisabled]}
                  onPress={() => { logUI(uiPath('finmed', 'appointment', 'complete_button'), 'press'); void handleComplete(); }}
                  disabled={saving}
                >
                  <Text style={styles.completeBtnText}>{saving ? '…' : 'Complete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  wrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#131c23',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderColor: '#1F3A59',
    paddingHorizontal: 16, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: '#2C4669', marginBottom: 12,
  },
  title: { color: '#CBD5E1', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaChip: {
    flex: 1, backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 10, padding: 12,
  },
  metaChipLabel: { color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  metaChipValue: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  descBlock: { marginBottom: 14 },
  descLabel: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  descText: { color: '#8FA8C9', fontSize: 14, lineHeight: 20 },
  noteLabel: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
  },
  noteInput: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 8, color: '#CBD5E1', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
    textAlignVertical: 'top', minHeight: 60,
  },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  ignoreBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center' },
  ignoreBtnText: { color: '#64748B', fontWeight: '600' },
  snoozeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#8FA8C9', backgroundColor: '#0E1A2B', alignItems: 'center' },
  snoozeBtnText: { color: '#8FA8C9', fontWeight: '600' },
  completeBtn: { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center' },
  completeBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  completeBtnText: { color: '#F472B6', fontWeight: '700' },
});
