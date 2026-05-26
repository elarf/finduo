import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import type { ComponentServiceInterval, Component, ComponentServiceRecord } from '../../types/fingo';
import {
  computeIntervalHealth, formatIntervalRemaining, healthColor,
} from '../../lib/fingo/health';
import DateTimeFields from './DateTimeFields';

interface IntervalWithComponent {
  interval: ComponentServiceInterval;
  component: Component;
}

interface Props {
  visible: boolean;
  componentName?: string | null;
  intervals?: ComponentServiceInterval[];
  component?: Component | null;
  /** When provided, shows intervals from multiple components (asset-level service). */
  allIntervals?: IntervalWithComponent[];
  /** When provided, the sheet opens in edit mode pre-populated with this record. */
  editingRecord?: ComponentServiceRecord;
  onSave: (
    name: string,
    servicedAt: string,
    notes: string | null,
    cost: number | null,
    selectedIntervalIds: string[],
  ) => Promise<void>;
  onClose: () => void;
}

function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toTimeStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ServiceRecordSheet({
  visible, componentName, intervals, component, allIntervals, editingRecord, onSave, onClose,
}: Props) {
  const [name, setName] = useState('');
  const [nameIsManual, setNameIsManual] = useState(false);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [notes, setNotes] = useState('');
  const [costStr, setCostStr] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingRecord) {
        setName(editingRecord.name);
        setNameIsManual(true);
        const d = new Date(editingRecord.serviced_at);
        setServiceDate(toDateStr(d));
        setServiceTime(toTimeStr(d));
        setNotes(editingRecord.notes ?? '');
        setCostStr(editingRecord.cost != null ? String(editingRecord.cost) : '');
        setSelectedIds(new Set());
      } else {
        setName('');
        setNameIsManual(false);
        const now = new Date();
        setServiceDate(toDateStr(now));
        setServiceTime(toTimeStr(now));
        setNotes('');
        setCostStr('');
        setSelectedIds(new Set());
      }
    }
  }, [visible]);

  const cost = costStr.trim() ? parseFloat(costStr.replace(',', '.')) : null;
  const canSave = name.trim() && serviceDate && serviceTime;

  // Normalize to a flat list of { interval, component } for rendering
  const effectiveIntervals: IntervalWithComponent[] = allIntervals
    ?? (intervals ?? []).map((interval) => ({ interval, component: component! })).filter((x) => x.component != null);

  const autoNameFromIds = (ids: Set<string>): string => {
    if (ids.size === 0) return '';
    return Array.from(ids)
      .map((id) => effectiveIntervals.find((x) => x.interval.id === id)?.interval.name ?? '')
      .filter(Boolean)
      .join(', ');
  };

  const toggleInterval = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!nameIsManual) setName(autoNameFromIds(next));
      return next;
    });
  };

  const handleNameChange = (text: string) => {
    setName(text);
    setNameIsManual(true);
  };

  const clearName = () => {
    setName('');
    setNameIsManual(false);
    setName(autoNameFromIds(selectedIds));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      logUI(uiPath('fingo', 'service_record_sheet', 'save'), 'press');
      const isoDate = new Date(`${serviceDate}T${serviceTime}`).toISOString();
      await onSave(
        name.trim(),
        isoDate,
        notes.trim() || null,
        cost !== null && !isNaN(cost) ? cost : null,
        Array.from(selectedIds),
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const hasIntervals = effectiveIntervals.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{editingRecord ? 'Edit Service' : 'Log Service'}</Text>
          {componentName && <Text style={styles.subtitle}>{componentName}</Text>}

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {hasIntervals && !editingRecord && (
              <>
                <Text style={styles.label}>
                  Service intervals <Text style={styles.optional}>(select what was done)</Text>
                </Text>
                {effectiveIntervals.map(({ interval, component: comp }) => {
                  const health = comp ? computeIntervalHealth(interval, comp) : null;
                  const selected = selectedIds.has(interval.id);
                  const ratio = health ? health.remaining / interval.interval_value : 1;
                  const color = healthColor(ratio);
                  return (
                    <TouchableOpacity
                      key={interval.id}
                      style={[styles.intervalRow, selected && styles.intervalRowSelected]}
                      onPress={() => toggleInterval(interval.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.intervalBody}>
                        <Text style={styles.intervalName}>{interval.name}</Text>
                        {allIntervals && (
                          <Text style={styles.intervalComponent}>{comp.name}</Text>
                        )}
                      </View>
                      {health && (
                        <Text style={[styles.intervalBadge, { color, borderColor: color + '55' }]}>
                          {formatIntervalRemaining(health)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <Text style={styles.label}>Service name</Text>
            <View style={styles.inputRow}>
              <TextInput
                {...uiProps(uiPath('fingo', 'service_record_sheet', 'name_input'))}
                style={[styles.input, styles.inputFlex, name.length > 0 && styles.inputWithClear]}
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g. Chain lube, Tyre change…"
                placeholderTextColor="#475569"
                autoFocus={!hasIntervals}
              />
              {name.length > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={clearName} hitSlop={8}>
                  <Text style={styles.clearIcon}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Date & time</Text>
            <DateTimeFields
              dateStr={serviceDate}
              timeStr={serviceTime}
              onDateChange={setServiceDate}
              onTimeChange={setServiceTime}
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
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: { flex: 1 },
  inputWithClear: { paddingRight: 36 },
  clearBtn: {
    position: 'absolute',
    right: 10,
    padding: 4,
  },
  clearIcon: { color: '#475569', fontSize: 20, lineHeight: 22 },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 10,
  },
  intervalRowSelected: {
    borderColor: '#4ade80',
    backgroundColor: '#071d0f',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  checkmark: { color: '#060D18', fontSize: 11, fontWeight: '900', lineHeight: 14 },
  intervalBody: { flex: 1 },
  intervalName: { color: '#CBD5E1', fontSize: 14 },
  intervalComponent: { color: '#475569', fontSize: 11, marginTop: 2 },
  intervalBadge: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
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
