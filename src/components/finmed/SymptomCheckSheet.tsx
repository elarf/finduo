import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import SnoozeSheet from './SnoozeSheet';
import type { FinmedReminder, SymptomEntry, SymptomCheckValue, PersistentSymptom } from '../../types/finmed';

const MOOD_OPTIONS: { value: 1 | 2 | 3 | 4 | 5; label: string; emoji: string }[] = [
  { value: 1, label: 'Very bad', emoji: '😞' },
  { value: 2, label: 'Bad', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '😊' },
  { value: 5, label: 'Very good', emoji: '😄' },
];

const BUILTIN_SYMPTOMS = [
  'Abdominal cramps', 'Abdominal pain', 'Absence of menstruation', 'Acne', 'Agitation',
  'Anxiety', 'Back pain', 'Bloating', 'Brain fog', 'Chest pain', 'Chest tightness',
  'Chills', 'Confusion', 'Constipation', 'Cough', 'Depression', 'Diarrhea', 'Dizziness',
  'Dry mouth', 'Dry skin', 'Elbow pain', 'Emotional blunting', 'Emotional instability',
  'Emptiness', 'Excessive sweating', 'Exhaustion', 'Fatigue', 'Fever', 'Flatulence',
  'Headache', 'Heart palpitations', 'Hip pain', 'Hunger', 'Hyperactivity',
  'Inability to concentrate', 'Insomnia', 'Irritability', 'Itching', 'Joint pain',
  'Knee pain', 'Loss of appetite', 'Loss of motivation', 'Lower abdominal pain',
  'Lower back pain', 'Memory issues', 'Mood swings', 'Muscle cramps', 'Muscle weakness',
  'Nausea', 'Neck pain', 'Nervousness', 'Night sweats', 'Numbness', 'Panic attacks',
  'Rash', 'Restlessness', 'Rocking', 'Runny nose', 'Sadness', 'Scalp itchiness',
  'Shortness of breath', 'Skin irritation', 'Sleep disturbance', 'Sneezing', 'Sore throat',
  'Stiffness', 'Swelling', 'Tingling', 'Tiredness', 'Tremors', 'Unhappiness', 'Vomiting',
  'Weakness', 'Weight gain', 'Weight loss', 'Yawning',
];

interface SymptomCheckSheetProps {
  visible: boolean;
  reminder: FinmedReminder;
  persistentSymptoms: PersistentSymptom[];
  onComplete: (value: SymptomCheckValue, note?: string) => Promise<void>;
  onSnooze: (minutes: number, until: string) => Promise<void>;
  onIgnore: () => Promise<void>;
  onAddPersistentSymptom: (name: string, isCustom: boolean) => Promise<boolean>;
  onRemovePersistentSymptom: (name: string) => Promise<boolean>;
  onClose: () => void;
}

export default function SymptomCheckSheet({
  visible, reminder, persistentSymptoms,
  onComplete, onSnooze, onIgnore,
  onAddPersistentSymptom, onRemovePersistentSymptom,
  onClose,
}: SymptomCheckSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [symptomSearch, setSymptomSearch] = useState('');
  const [showSymptomPicker, setShowSymptomPicker] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<SymptomEntry[]>([]);
  const [customSymptomInput, setCustomSymptomInput] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  // Pre-populate from persistent symptoms on open
  useEffect(() => {
    if (visible) {
      const persisted = persistentSymptoms.map((p) => ({
        name: p.symptom_name,
        severity: 5,
      }));
      setSelectedEntries(persisted);
    }
  }, [visible, persistentSymptoms]);

  const persistentNames = useMemo(() => new Set(persistentSymptoms.map((p) => p.symptom_name)), [persistentSymptoms]);

  const allSymptoms = useMemo(() => {
    const custom = persistentSymptoms.filter((p) => p.is_custom).map((p) => p.symptom_name);
    return [...new Set([...BUILTIN_SYMPTOMS, ...custom])].sort();
  }, [persistentSymptoms]);

  const filteredSymptoms = useMemo(() => {
    const q = symptomSearch.toLowerCase();
    return q ? allSymptoms.filter((s) => s.toLowerCase().includes(q)) : allSymptoms;
  }, [allSymptoms, symptomSearch]);

  const selectedNames = useMemo(() => new Set(selectedEntries.map((e) => e.name)), [selectedEntries]);

  const toggleSymptom = async (name: string) => {
    if (selectedNames.has(name)) {
      setSelectedEntries((prev) => prev.filter((e) => e.name !== name));
      if (persistentNames.has(name)) await onRemovePersistentSymptom(name);
    } else {
      setSelectedEntries((prev) => [...prev, { name, severity: 5 }]);
      if (!persistentNames.has(name)) await onAddPersistentSymptom(name, false);
    }
  };

  const addCustomSymptom = async () => {
    const name = customSymptomInput.trim();
    if (!name) return;
    if (!allSymptoms.includes(name)) await onAddPersistentSymptom(name, true);
    if (!selectedNames.has(name)) {
      setSelectedEntries((prev) => [...prev, { name, severity: 5 }]);
      await onAddPersistentSymptom(name, true);
    }
    setCustomSymptomInput('');
  };

  const setSeverity = (name: string, severity: number) => {
    setSelectedEntries((prev) => prev.map((e) => e.name === name ? { ...e, severity } : e));
  };

  const removeEntry = async (name: string) => {
    setSelectedEntries((prev) => prev.filter((e) => e.name !== name));
    if (persistentNames.has(name)) await onRemovePersistentSymptom(name);
  };

  const handleComplete = async () => {
    setSaving(true);
    await onComplete({ mood, symptoms: selectedEntries }, note.trim() || undefined);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>{reminder.label}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Mood */}
              <Text style={styles.sectionLabel}>How are you feeling?</Text>
              <View style={styles.moodRow}>
                {MOOD_OPTIONS.map((m) => (
                  <TouchableOpacity
                    {...uiProps(uiPath('finmed', 'symptom_check', 'mood', String(m.value)))}
                    key={m.value}
                    style={[styles.moodBtn, mood === m.value && styles.moodBtnActive]}
                    onPress={() => { logUI(uiPath('finmed', 'symptom_check', 'mood', String(m.value)), 'press'); setMood(m.value); }}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, mood === m.value && styles.moodLabelActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Symptoms */}
              <View style={styles.symptomHeader}>
                <Text style={styles.sectionLabel}>Symptoms</Text>
                <TouchableOpacity
                  {...uiProps(uiPath('finmed', 'symptom_check', 'add_symptoms_button'))}
                  style={styles.addSympBtn}
                  onPress={() => { logUI(uiPath('finmed', 'symptom_check', 'add_symptoms_button'), 'press'); setShowSymptomPicker(true); }}
                >
                  <Text style={styles.addSympBtnText}>＋ Add</Text>
                </TouchableOpacity>
              </View>

              {selectedEntries.length === 0 ? (
                <Text style={styles.emptyHint}>No symptoms selected. Tap + Add to select.</Text>
              ) : (
                selectedEntries.map((entry) => (
                  <View key={entry.name} style={styles.symptomCard}>
                    <View style={styles.symptomCardHeader}>
                      <Text style={styles.symptomName}>{entry.name}</Text>
                      <TouchableOpacity onPress={() => void removeEntry(entry.name)}>
                        <Text style={styles.removeSymptom}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.severityRow}>
                      <Text style={styles.severityHint}>Not severe</Text>
                      <View style={styles.severityDots}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                          <TouchableOpacity key={v} onPress={() => setSeverity(entry.name, v)}>
                            <View style={[styles.dot, entry.severity >= v && styles.dotActive]} />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.severityHint}>Very severe</Text>
                    </View>
                    <Text style={styles.severityValue}>{entry.severity}/10</Text>
                  </View>
                ))
              )}

              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional)"
                placeholderTextColor="#475569"
              />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.ignoreBtn} onPress={async () => { await onIgnore(); onClose(); }}>
                  <Text style={styles.ignoreBtnText}>Ignore</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.snoozeBtn} onPress={() => setShowSnooze(true)}>
                  <Text style={styles.snoozeBtnText}>Snooze</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.completeBtn, saving && styles.completeBtnDisabled]}
                  onPress={() => void handleComplete()}
                  disabled={saving}
                >
                  <Text style={styles.completeBtnText}>{saving ? '…' : 'Complete'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Symptom picker modal */}
      <Modal visible={showSymptomPicker} transparent animationType="slide" onRequestClose={() => setShowSymptomPicker(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowSymptomPicker(false)} />
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Select symptoms</Text>
            <TextInput
              style={styles.searchInput}
              value={symptomSearch}
              onChangeText={setSymptomSearch}
              placeholder="Search symptoms…"
              placeholderTextColor="#475569"
            />
            <View style={styles.customRow}>
              <TextInput
                style={[styles.searchInput, { flex: 1 }]}
                value={customSymptomInput}
                onChangeText={setCustomSymptomInput}
                placeholder="Add custom symptom…"
                placeholderTextColor="#475569"
              />
              <TouchableOpacity
                style={[styles.addSympBtn, { marginLeft: 8 }]}
                onPress={() => void addCustomSymptom()}
                disabled={!customSymptomInput.trim()}
              >
                <Text style={styles.addSympBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredSymptoms}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = selectedNames.has(item);
                return (
                  <TouchableOpacity
                    style={[styles.symptomListRow, selected && styles.symptomListRowActive]}
                    onPress={() => void toggleSymptom(item)}
                  >
                    <Text style={[styles.symptomListText, selected && styles.symptomListTextActive]}>{item}</Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
            <Text style={styles.selectedCount}>{selectedEntries.length} symptom{selectedEntries.length !== 1 ? 's' : ''} selected</Text>
            <TouchableOpacity style={styles.doneSympBtn} onPress={() => setShowSymptomPicker(false)}>
              <Text style={styles.doneSympBtnText}>Done</Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#131c23',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderColor: '#1F3A59',
    maxHeight: '90%', paddingHorizontal: 16, paddingTop: 10,
  },
  pickerSheet: {
    backgroundColor: '#131c23',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderColor: '#1F3A59',
    maxHeight: '85%', paddingHorizontal: 16, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: '#2C4669', marginBottom: 12,
  },
  title: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  sectionLabel: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  moodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#0E1A2B',
    marginHorizontal: 2,
  },
  moodBtnActive: { borderColor: '#F472B6', backgroundColor: '#2d0a1a' },
  moodEmoji: { fontSize: 22 },
  moodLabel: { color: '#475569', fontSize: 10, marginTop: 4, textAlign: 'center' },
  moodLabelActive: { color: '#F472B6' },
  symptomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  addSympBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#F472B6', backgroundColor: '#1a0510',
  },
  addSympBtnText: { color: '#F472B6', fontSize: 12, fontWeight: '600' },
  emptyHint: { color: '#475569', fontSize: 12, fontStyle: 'italic', marginBottom: 12 },
  symptomCard: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  symptomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  symptomName: { color: '#CBD5E1', fontSize: 14, fontWeight: '600', flex: 1 },
  removeSymptom: { color: '#f87171', fontSize: 14, paddingHorizontal: 4 },
  severityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  severityHint: { color: '#475569', fontSize: 10, width: 56, textAlign: 'center' },
  severityDots: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#1F3A59', backgroundColor: '#131c23' },
  dotActive: { backgroundColor: '#F472B6', borderColor: '#F472B6' },
  severityValue: { color: '#8FA8C9', fontSize: 11, textAlign: 'right', marginTop: 4 },
  noteInput: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 8, color: '#CBD5E1', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginVertical: 10,
  },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  ignoreBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center' },
  ignoreBtnText: { color: '#64748B', fontWeight: '600' },
  snoozeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#8FA8C9', backgroundColor: '#0E1A2B', alignItems: 'center' },
  snoozeBtnText: { color: '#8FA8C9', fontWeight: '600' },
  completeBtn: { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center' },
  completeBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  completeBtnText: { color: '#F472B6', fontWeight: '700' },
  // Picker modal
  searchInput: {
    backgroundColor: '#0E1A2B', borderWidth: 1, borderColor: '#1F3A59',
    borderRadius: 8, color: '#CBD5E1', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  symptomListRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderColor: '#0E1A2B',
  },
  symptomListRowActive: { backgroundColor: '#1a0510' },
  symptomListText: { color: '#8FA8C9', fontSize: 14 },
  symptomListTextActive: { color: '#F472B6', fontWeight: '600' },
  checkmark: { color: '#F472B6', fontSize: 16 },
  selectedCount: { color: '#475569', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  doneSympBtn: {
    paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center', marginTop: 4,
  },
  doneSympBtnText: { color: '#F472B6', fontWeight: '700' },
});
