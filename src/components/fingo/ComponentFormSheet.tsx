import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Switch, ScrollView,
} from 'react-native';
import ComponentIcon from './ComponentIcon';
import type { Component, ComponentTemplate } from '../../types/fingo';
import { getComponentIcon } from '../../lib/fingo/componentIcons';
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import DateTimeFields from './DateTimeFields';

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

function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toTimeStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function combineDatetime(dateStr: string, timeStr: string): string {
  try {
    const d = new Date(`${dateStr}T${timeStr}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return new Date().toISOString();
}

export default function ComponentFormSheet({
  visible, template, editingComponent, initialName, assetCreatedAt,
  assetName, assets, currentAssetId, onSave, onClose,
}: Props) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [installTime, setInstallTime] = useState('');
  const [sinceBeginning, setSinceBeginning] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingComponent;
  const showAssetPicker = isEdit && assets && assets.length > 1;

  useEffect(() => {
    if (visible) {
      setName(editingComponent?.name ?? template?.name ?? initialName ?? '');
      setNotes(editingComponent?.notes ?? '');
      const existingD = editingComponent?.installed_at
        ? new Date(editingComponent.installed_at)
        : new Date();
      setInstallDate(toDateStr(existingD));
      setInstallTime(toTimeStr(existingD));
      const assetD = assetCreatedAt ? new Date(assetCreatedAt) : null;
      setSinceBeginning(
        isEdit && assetD !== null &&
        toDateStr(existingD) === toDateStr(assetD) &&
        toTimeStr(existingD) === toTimeStr(assetD),
      );
      setSelectedAssetId(currentAssetId ?? null);
    }
  }, [visible, editingComponent, template, initialName, currentAssetId, isEdit]);

  const handleSinceBeginning = (val: boolean) => {
    setSinceBeginning(val);
    const d = val && assetCreatedAt ? new Date(assetCreatedAt) : new Date();
    setInstallDate(toDateStr(d));
    setInstallTime(toTimeStr(d));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      logUI(uiPath('fingo', 'component_form', 'save'), 'press');
      const installedAt = combineDatetime(installDate, installTime);
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
          <View style={styles.titleRow}>
            <ComponentIcon
              name={getComponentIcon(
                template?.name ?? editingComponent?.name ?? '',
                template?.key ?? editingComponent?.template_key,
              )}
              size={20}
              color="#8FA8C9"
            />
            <Text style={styles.title}>
              {isEdit ? 'Edit Component' : template ? `Add ${template.name}` : 'Add Component'}
            </Text>
          </View>

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
                      {...uiProps(uiPath('fingo', 'component_form', 'since_beginning_switch'))}
                      value={sinceBeginning}
                      onValueChange={handleSinceBeginning}
                      trackColor={{ false: '#1F3A59', true: '#053d1e' }}
                      thumbColor={sinceBeginning ? '#4ade80' : '#334155'}
                      ios_backgroundColor="#1F3A59"
                    />
                  </View>
                </View>
                <DateTimeFields
                  dateStr={installDate}
                  timeStr={installTime}
                  onDateChange={(d) => { setInstallDate(d); setSinceBeginning(false); }}
                  onTimeChange={(t) => { setInstallTime(t); setSinceBeginning(false); }}
                  disabled={sinceBeginning}
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
    backgroundColor: '#131c23',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
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
