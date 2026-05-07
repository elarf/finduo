import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import type { Component, ComponentTemplate } from '../../types/fingo';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

interface Props {
  visible: boolean;
  template?: ComponentTemplate | null;
  editingComponent?: Component | null;
  initialName?: string;
  /** Called with name + notes when user taps Save */
  onSave: (name: string, notes: string | null) => Promise<void>;
  onClose: () => void;
}

export default function ComponentFormSheet({
  visible, template, editingComponent, initialName, onSave, onClose,
}: Props) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(editingComponent?.name ?? template?.name ?? initialName ?? '');
      setNotes(editingComponent?.notes ?? '');
    }
  }, [visible, editingComponent, template, initialName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      logUI(uiPath('fingo', 'component_form', 'save'), 'press');
      await onSave(name.trim(), notes.trim() || null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!editingComponent;

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

          {template && !isEdit && (
            <Text style={styles.categoryTag}>{template.category}</Text>
          )}

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

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
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
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
  optional: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
  },
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
  notesInput: {
    height: 72,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#053d1e',
    borderWidth: 1,
    borderColor: '#4ade80',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#0E1A2B',
    borderColor: '#1F3A59',
  },
  saveText: {
    color: '#4ade80',
    fontWeight: '700',
  },
});
