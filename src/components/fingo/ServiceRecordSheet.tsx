import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

interface Props {
  visible: boolean;
  componentName?: string | null;
  onSave: (name: string, servicedAt: string, notes: string | null, cost: number | null) => Promise<void>;
  onClose: () => void;
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ServiceRecordSheet({
  visible, componentName, onSave, onClose,
}: Props) {
  const [name, setName] = useState('');
  const [datetimeStr, setDatetimeStr] = useState('');
  const [notes, setNotes] = useState('');
  const [costStr, setCostStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setDatetimeStr(toLocalDatetimeString(new Date()));
      setNotes('');
      setCostStr('');
    }
  }, [visible]);

  const cost = costStr.trim() ? parseFloat(costStr.replace(',', '.')) : null;
  const canSave = name.trim() && datetimeStr.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      logUI(uiPath('fingo', 'service_record_sheet', 'save'), 'press');
      const isoDate = new Date(datetimeStr).toISOString();
      await onSave(
        name.trim(),
        isoDate,
        notes.trim() || null,
        cost !== null && !isNaN(cost) ? cost : null,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Log Service</Text>
          {componentName && <Text style={styles.subtitle}>{componentName}</Text>}

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Service name</Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'service_record_sheet', 'name_input'))}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chain lube, Tyre change…"
              placeholderTextColor="#475569"
              autoFocus
            />

            <Text style={styles.label}>Date & time</Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'service_record_sheet', 'date_input'))}
              style={styles.input}
              value={datetimeStr}
              onChangeText={setDatetimeStr}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor="#475569"
              keyboardType="default"
            />

            <Text style={styles.label}>
              Notes <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'service_record_sheet', 'notes_input'))}
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Details, parts used, shop…"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>
              Cost <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'service_record_sheet', 'cost_input'))}
              style={styles.input}
              value={costStr}
              onChangeText={setCostStr}
              placeholder="0.00"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={!canSave || saving}
            >
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginBottom: 14,
  },
  title: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  subtitle: { color: '#475569', fontSize: 12, marginBottom: 10 },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
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
  notesInput: { height: 72, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
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
  saveBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  saveText: { color: '#4ade80', fontWeight: '700' },
});
