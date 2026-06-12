import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type { FinvenProduct } from '../../types/finven';

interface ProductFormModalProps {
  visible: boolean;
  editingProduct: FinvenProduct | null;
  onClose: () => void;
  onSave: (name: string, defaultUnit: string, categoryHint: string | null, barcode: string | null) => Promise<boolean>;
}

export default function ProductFormModal({ visible, editingProduct, onClose, onSave }: ProductFormModalProps) {
  const { bottom } = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('piece');
  const [categoryHint, setCategoryHint] = useState('');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setDefaultUnit(editingProduct.default_unit);
      setCategoryHint(editingProduct.category_hint ?? '');
      setBarcode(editingProduct.barcode ?? '');
    } else {
      setName('');
      setDefaultUnit('piece');
      setCategoryHint('');
      setBarcode('');
    }
  }, [editingProduct, visible]);

  const canSave = name.trim().length > 0 && defaultUnit.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(
      name.trim(),
      defaultUnit.trim(),
      categoryHint.trim() || null,
      barcode.trim() || null,
    );
    setSaving(false);
    if (ok) onClose();
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
            <Text style={styles.title}>{editingProduct ? 'Edit Product' : 'New Product'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              {...uiProps(uiPath('finven', 'product_modal', 'name_input'))}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Milk, Bread, Apples"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Default unit</Text>
            <TextInput
              style={styles.input}
              value={defaultUnit}
              onChangeText={setDefaultUnit}
              placeholder="piece / ml / g / l"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Category (optional)</Text>
            <TextInput
              style={styles.input}
              value={categoryHint}
              onChangeText={setCategoryHint}
              placeholder="dairy / drink / snack"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Barcode (scanner coming soon)</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or enter barcode"
              placeholderTextColor="#2C4669"
              editable={true}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...uiProps(uiPath('finven', 'product_modal', 'save_button'))}
                style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
                onPress={() => { logUI(uiPath('finven', 'product_modal', 'save_button'), 'press'); void handleSave(); }}
                disabled={!canSave || saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#131c23',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
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
    marginBottom: 5,
    marginTop: 8,
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
  inputDisabled: {
    color: '#2C4669',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
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
    backgroundColor: '#071a2e',
    borderWidth: 1,
    borderColor: '#60A5FA',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  saveBtnText: { color: '#60A5FA', fontWeight: '700' },
});
