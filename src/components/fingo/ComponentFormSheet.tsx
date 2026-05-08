import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Switch, ScrollView,
} from 'react-native';
import type { Component, ComponentTemplate } from '../../types/fingo';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

interface AssetOption {
  id: string;
  name: string;
}

interface Props {
  visible: boolean;
  template?: ComponentTemplate | null;
  editingComponent?: Component | null;
  initialName?: string;
  assetCreatedAt?: string | null;
  assetName?: string | null;
  assets?: AssetOption[];
  currentAssetId?: string | null;
  onSave: (name: string, notes: string | null, installedAt: string | null, targetAssetId: string | null) => Promise<void>;
  onClose: () => void;
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeIso(str: string): string | null {
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export default function ComponentFormSheet({
  visible, template, editingComponent, initialName, assetCreatedAt,
  assetName, assets, currentAssetId, onSave, onClose,
}: Props) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [installedAtStr, setInstalledAtStr] = useState('');
  const [sinceBeginning, setSinceBeginning] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingComponent;
  const showAssetPicker = isEdit && assets && assets.length > 1;

  useEffect(() => {
    if (visible) {
      setName(editingComponent?.name ?? template?.name ?? initialName ?? '');
      setNotes(editingComponent?.notes ?? '');
      const existingDate = editingComponent?.installed_at
        ? toLocalDatetimeString(new Date(editingComponent.installed_at))
        : toLocalDatetimeString(new Date());
      setInstalledAtStr(existingDate);
      setSinceBeginning(false);
      setSelectedAssetId(currentAssetId ?? null);
    }
  }, [visible, editingComponent, template, initialName, currentAssetId, isEdit]);

  const handleSinceBeginning = (val: boolean) => {
    setSinceBeginning(val);
    if (val && assetCreatedAt) {
      setInstalledAtStr(toLocalDatetimeString(new Date(assetCreatedAt)));
    } else {
      setInstalledAtStr(toLocalDatetimeString(new Date()));
    }
  };

  const handleDateChange = (text: string) => {
    setInstalledAtStr(text);
    setSinceBeginning(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      logUI(uiPath('fingo', 'component_form', 'save'), 'press');
      const installedAt = safeIso(installedAtStr) ?? new Date().toISOString();
      await onSave(name.trim(), notes.trim() || null, installedAt, selectedAssetId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const displayAssetName = assets?.find((a) => a.id === selectedAssetId)?.name ?? assetName;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {isEdit ? 'Edit Component' : template ? `Add ${template.name}` : 'Add Component'}
          </Text>

          {displayAssetName && (
            <Text style={styles.assetTag}>{displayAssetName}</Text>
          )}

          {template && !isEdit && (
            <Text style={styles.categoryTag}>{template.category}</Text>
          )}

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'component_form', 'name_input'))}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Component name"
              placeholderTextColor="#475569"
              autoFocus
            />

            <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              {...uiProps(uiPath('fingo', 'component_form', 'notes_input'))}
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. brand, spec, purchase date…"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
            />

            <>
                <View style={styles.dateHeader}>
                  <Text style={styles.label}>Install date</Text>
                  <View style={styles.toggleGroup}>
                    <Text style={[styles.toggleLabel, sinceBeginning && styles.toggleLabelActive]}>
                      Since beginning
                    </Text>
                    <Switch
                      value={sinceBeginning}
                      onValueChange={handleSinceBeginning}
                      trackColor={{ false: '#1F3A59', true: '#053d1e' }}
                      thumbColor={sinceBeginning ? '#4ade80' : '#334155'}
                      ios_backgroundColor="#1F3A59"
                    />
                  </View>
                </View>
                <TextInput
                  {...uiProps(uiPath('fingo', 'component_form', 'installed_at_input'))}
                  style={[styles.input, sinceBeginning && styles.inputMuted]}
                  value={installedAtStr}
                  onChangeText={handleDateChange}
                  placeholder="YYYY-MM-DDTHH:MM"
                  placeholderTextColor="#475569"
                  editable={!sinceBeginning}
                  keyboardType="default"
                />
            </>

            {showAssetPicker && (
              <>
                <Text style={styles.label}>Asset</Text>
                <View style={styles.assetPickerRow}>
                  {assets!.map((a) => (
                    <TouchableOpacity
                      {...uiProps(uiPath('fingo', 'component_form', 'asset_chip', a.id))}
                      key={a.id}
                      style={[styles.assetChip, selectedAssetId === a.id && styles.assetChipActive]}
                      onPress={() => setSelectedAssetId(a.id)}
                    >
                      <Text style={[styles.assetChipText, selectedAssetId === a.id && styles.assetChipTextActive]}>
                        {a.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'component_form', 'cancel'))}
              style={styles.cancelBtn}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'component_form', 'submit'))}
              style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={!name.trim() || saving}
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
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  assetTag: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryTag: {
    color: '#3B6A9E',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
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
  inputMuted: {
    color: '#475569',
  },
  notesInput: { height: 72, textAlignVertical: 'top' },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: '#4ade80',
  },
  assetPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  assetChipActive: {
    borderColor: '#4ade80',
    backgroundColor: '#053d1e',
  },
  assetChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  assetChipTextActive: {
    color: '#4ade80',
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
