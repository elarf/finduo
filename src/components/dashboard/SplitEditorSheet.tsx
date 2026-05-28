import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../Icon';
import { useSplitsForTransaction, useSplits } from '../../hooks/useSplits';
import { logAPI } from '../../lib/devtools';
import type { AppCategory } from '../../types/dashboard';

interface SplitRow {
  id?: string;
  category_id: string;
  amount: string;
  note: string;
}

interface SplitEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  transactionId: string;
  totalAmount: number;
  userId: string;
  categoriesById: Record<string, AppCategory>;
  entryCategories: AppCategory[];
  formatCurrency: (n: number) => string;
}

export default function SplitEditorSheet({
  visible,
  onClose,
  transactionId,
  totalAmount,
  userId,
  categoriesById,
  entryCategories,
  formatCurrency,
}: SplitEditorSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const { data: existingSplits = [] } = useSplitsForTransaction(visible ? transactionId : null);
  const { saveSplits, deleteSplitsForTransaction } = useSplits();

  const [rows, setRows] = useState<SplitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [catPickerRowIdx, setCatPickerRowIdx] = useState<number | null>(null);

  // Populate rows from existing splits when sheet opens
  useEffect(() => {
    if (!visible) return;
    if (existingSplits.length > 0) {
      setRows(existingSplits.map((s) => ({
        id: s.id,
        category_id: s.category_id,
        amount: String(s.amount),
        note: s.note ?? '',
      })));
    } else {
      setRows([{ category_id: '', amount: '', note: '' }]);
    }
  }, [visible, existingSplits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const allocatedTotal = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = totalAmount - allocatedTotal;
  const isOverAllocated = allocatedTotal > totalAmount + 0.005;

  const addRow = () => {
    setRows((prev) => [...prev, { category_id: '', amount: '', note: '' }]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = useCallback((idx: number, field: keyof SplitRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }, []);

  const handleSave = async () => {
    const validRows = rows.filter((r) => r.category_id && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      await deleteSplitsForTransaction(transactionId);
      onClose();
      return;
    }
    setSaving(true);
    try {
      logAPI('supabase://transaction_splits', { source: 'SplitEditorSheet', action: 'save' });
      await saveSplits(
        transactionId,
        validRows.map((r) => ({
          parent_transaction_id: transactionId,
          category_id: r.category_id,
          amount: parseFloat(r.amount),
          note: r.note.trim() || null,
          user_id: userId,
        })),
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAll = async () => {
    setSaving(true);
    try {
      await deleteSplitsForTransaction(transactionId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (catPickerRowIdx !== null) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setCatPickerRowIdx(null)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setCatPickerRowIdx(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Choose Category</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {entryCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catRow,
                    rows[catPickerRowIdx]?.category_id === cat.id && styles.catRowActive,
                  ]}
                  onPress={() => {
                    updateRow(catPickerRowIdx, 'category_id', cat.id);
                    setCatPickerRowIdx(null);
                  }}
                >
                  {cat.icon ? <Icon name={cat.icon as any} size={18} color={cat.color ?? '#8FA8C9'} /> : null}
                  <Text style={[styles.catRowText, cat.color ? { color: cat.color } : undefined]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>Split Transaction</Text>
              <View style={styles.headerMeta}>
                <Text style={styles.totalText}>Total: {formatCurrency(totalAmount)}</Text>
                <Text style={[styles.remainingText, isOverAllocated && styles.remainingOver]}>
                  Remaining: {formatCurrency(remaining)}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
              {rows.map((row, idx) => {
                const cat = row.category_id ? categoriesById[row.category_id] : null;
                return (
                  <View key={idx} style={styles.splitRow}>
                    {/* Category picker button */}
                    <TouchableOpacity
                      style={[styles.catBtn, cat?.color ? { borderColor: cat.color } : undefined]}
                      onPress={() => setCatPickerRowIdx(idx)}
                    >
                      {cat?.icon ? <Icon name={cat.icon as any} size={14} color={cat.color ?? '#8FA8C9'} /> : null}
                      <Text style={[styles.catBtnText, cat?.color ? { color: cat.color } : undefined]} numberOfLines={1}>
                        {cat?.name ?? 'Category'}
                      </Text>
                      <Icon name="ChevronDown" size={12} color="#4A6280" />
                    </TouchableOpacity>

                    {/* Amount input */}
                    <TextInput
                      style={styles.amountInput}
                      value={row.amount}
                      onChangeText={(v) => updateRow(idx, 'amount', v.replace(',', '.').replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#4A6280"
                    />

                    {/* Note input */}
                    <TextInput
                      style={styles.noteInput}
                      value={row.note}
                      onChangeText={(v) => updateRow(idx, 'note', v)}
                      placeholder="note"
                      placeholderTextColor="#4A6280"
                    />

                    {/* Delete row */}
                    <TouchableOpacity onPress={() => removeRow(idx)} hitSlop={8}>
                      <Icon name="X" size={16} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
              <Icon name="Plus" size={14} color="#53E3A6" />
              <Text style={styles.addRowText}>Add split</Text>
            </TouchableOpacity>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              {existingSplits.length > 0 && (
                <TouchableOpacity style={styles.removeAllBtn} onPress={handleRemoveAll} disabled={saving}>
                  <Text style={styles.removeAllText}>Remove all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isOverAllocated && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving || isOverAllocated}
              >
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0D1F31',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2D486E',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#EAF3FF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  totalText: {
    color: '#8FA8C9',
    fontSize: 12,
    fontWeight: '600',
  },
  remainingText: {
    color: '#53E3A6',
    fontSize: 12,
    fontWeight: '700',
  },
  remainingOver: {
    color: '#f87171',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  catBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 8,
    backgroundColor: '#060A14',
  },
  catBtnText: {
    flex: 1,
    color: '#8FA8C9',
    fontSize: 12,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 8,
    backgroundColor: '#060A14',
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  noteInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 8,
    backgroundColor: '#060A14',
    color: '#EAF3FF',
    fontSize: 12,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  addRowText: {
    color: '#53E3A6',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  removeAllBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    backgroundColor: '#200a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAllText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#2C4669',
    borderRadius: 8,
    backgroundColor: '#13253B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#8FA8C9',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1e4a8a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: '#EAF3FF',
    fontSize: 14,
    fontWeight: '700',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2E47',
  },
  catRowActive: {
    backgroundColor: '#0D2040',
  },
  catRowText: {
    color: '#EAF3FF',
    fontSize: 14,
    fontWeight: '600',
  },
});
