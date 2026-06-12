import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type { AppTransaction } from '../../types/dashboard';
import type { FinvenProduct, FinvenLocation } from '../../types/finven';

interface LineItem {
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  priceAllocated: string;
  expiryDate: string;
  locationId: string | null;
}

interface TransactionBreakdownSheetProps {
  visible: boolean;
  transaction: AppTransaction | null;
  products: FinvenProduct[];
  locations: FinvenLocation[];
  onClose: () => void;
  onSave: (items: Array<{
    productId: string;
    quantity: number;
    unit: string;
    priceAllocated: number;
    expiryDate: string | null;
    locationId: string | null;
  }>) => Promise<boolean>;
  onCreateProduct: (name: string, defaultUnit: string) => Promise<FinvenProduct | null>;
}

function emptyLine(): LineItem {
  return { productId: '', productName: '', quantity: '1', unit: 'piece', priceAllocated: '0', expiryDate: '', locationId: null };
}

export default function TransactionBreakdownSheet({
  visible, transaction, products, locations, onClose, onSave, onCreateProduct,
}: TransactionBreakdownSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [showProductPicker, setShowProductPicker] = useState<number | null>(null);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  if (!transaction) return null;

  const totalAmount = transaction.amount;
  const allocated = lines.reduce((sum, l) => sum + (parseFloat(l.priceAllocated) || 0), 0);
  const remaining = totalAmount - allocated;

  const updateLine = (idx: number, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const handlePickProduct = (lineIdx: number, product: FinvenProduct) => {
    updateLine(lineIdx, {
      productId: product.id,
      productName: product.name,
      unit: product.default_unit,
    });
    setShowProductPicker(null);
    setProductSearch({});
  };

  const handleQuickCreate = async (lineIdx: number) => {
    if (!quickCreateName.trim()) return;
    setCreatingProduct(true);
    const product = await onCreateProduct(quickCreateName.trim(), 'piece');
    setCreatingProduct(false);
    if (product) {
      handlePickProduct(lineIdx, product);
      setQuickCreateName('');
    }
  };

  const canSave = lines.length > 0 && lines.every((l) => l.productId && parseFloat(l.quantity) > 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(lines.map((l) => ({
      productId: l.productId,
      quantity: parseFloat(l.quantity),
      unit: l.unit,
      priceAllocated: parseFloat(l.priceAllocated) || 0,
      expiryDate: l.expiryDate.trim() || null,
      locationId: l.locationId,
    })));
    setSaving(false);
    if (ok) {
      setLines([emptyLine()]);
      onClose();
    }
  };

  const filteredProducts = (search: string) =>
    search.trim()
      ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : products.slice(0, 20);

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

            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Break down transaction</Text>
                <Text style={styles.txMeta}>
                  {transaction.date} · {transaction.type === 'income' ? '+' : '−'}{Math.abs(totalAmount).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Running total */}
            <View style={styles.totalRow}>
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Allocated</Text>
                <Text style={styles.totalValue}>{allocated.toFixed(2)}</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Remaining</Text>
                <Text style={[styles.totalValue, { color: remaining < 0 ? '#f87171' : remaining === 0 ? '#4ade80' : '#FBBF24' }]}>
                  {remaining.toFixed(2)}
                </Text>
              </View>
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {lines.map((line, idx) => (
                <View key={idx} style={styles.lineCard}>
                  <View style={styles.lineHeader}>
                    <Text style={styles.lineNum}>#{idx + 1}</Text>
                    {lines.length > 1 && (
                      <TouchableOpacity onPress={() => removeLine(idx)}>
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Product picker */}
                  {line.productId ? (
                    <TouchableOpacity
                      style={styles.productSelected}
                      onPress={() => setShowProductPicker(idx)}
                    >
                      <Text style={styles.productSelectedName}>{line.productName}</Text>
                      <Text style={styles.changeText}>change</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      {...uiProps(uiPath('finven', 'breakdown', 'pick_product', String(idx)))}
                      style={styles.productPickerBtn}
                      onPress={() => { logUI(uiPath('finven', 'breakdown', 'pick_product', String(idx)), 'press'); setShowProductPicker(idx); }}
                    >
                      <Text style={styles.productPickerBtnText}>Pick product…</Text>
                    </TouchableOpacity>
                  )}

                  {/* Product search overlay */}
                  {showProductPicker === idx && (
                    <View style={styles.productDropdown}>
                      <TextInput
                        style={styles.searchInput}
                        value={productSearch[idx] ?? ''}
                        onChangeText={(v) => setProductSearch((p) => ({ ...p, [idx]: v }))}
                        placeholder="Search products…"
                        placeholderTextColor="#475569"
                        autoFocus
                      />
                      {filteredProducts(productSearch[idx] ?? '').map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.productDropdownRow}
                          onPress={() => handlePickProduct(idx, p)}
                        >
                          <Text style={styles.productDropdownName}>{p.name}</Text>
                          <Text style={styles.productDropdownUnit}>{p.default_unit}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={styles.quickCreateRow}>
                        <TextInput
                          style={[styles.searchInput, { flex: 1 }]}
                          value={quickCreateName}
                          onChangeText={setQuickCreateName}
                          placeholder="Or create new…"
                          placeholderTextColor="#475569"
                        />
                        <TouchableOpacity
                          style={[styles.quickCreateBtn, creatingProduct && styles.quickCreateBtnDisabled]}
                          onPress={() => void handleQuickCreate(idx)}
                          disabled={creatingProduct || !quickCreateName.trim()}
                        >
                          <Text style={styles.quickCreateBtnText}>＋</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.closePicker} onPress={() => setShowProductPicker(null)}>
                        <Text style={styles.closePickerText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.lineFields}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Qty</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={line.quantity}
                        onChangeText={(v) => updateLine(idx, { quantity: v })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Unit</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={line.unit}
                        onChangeText={(v) => updateLine(idx, { unit: v })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Price</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={line.priceAllocated}
                        onChangeText={(v) => updateLine(idx, { priceAllocated: v })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.lineFields}>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.fieldLabel}>Expiry (optional)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={line.expiryDate}
                        onChangeText={(v) => updateLine(idx, { expiryDate: v })}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#475569"
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.fieldLabel}>Location</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                          style={[styles.locationChip, !line.locationId && styles.locationChipActive]}
                          onPress={() => updateLine(idx, { locationId: null })}
                        >
                          <Text style={styles.locationChipText}>None</Text>
                        </TouchableOpacity>
                        {locations.map((loc) => (
                          <TouchableOpacity
                            key={loc.id}
                            style={[styles.locationChip, line.locationId === loc.id && styles.locationChipActive]}
                            onPress={() => updateLine(idx, { locationId: loc.id })}
                          >
                            <Text style={styles.locationChipText}>{loc.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
                <Text style={styles.addLineBtnText}>＋ Add line item</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...uiProps(uiPath('finven', 'breakdown', 'save_button'))}
                style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
                onPress={() => { logUI(uiPath('finven', 'breakdown', 'save_button'), 'press'); void handleSave(); }}
                disabled={!canSave || saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save breakdown'}</Text>
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
    maxHeight: '92%',
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
  headerRow: { marginBottom: 10 },
  title: { color: '#CBD5E1', fontSize: 16, fontWeight: '700' },
  txMeta: { color: '#475569', fontSize: 12, marginTop: 2 },
  totalRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  totalBox: { flex: 1, alignItems: 'center' },
  totalLabel: { color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { color: '#CBD5E1', fontSize: 16, fontWeight: '700', marginTop: 2 },
  list: { flex: 1 },
  lineCard: {
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 10,
    marginBottom: 8,
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  lineNum: { color: '#475569', fontSize: 11, fontWeight: '700' },
  removeText: { color: '#f87171', fontSize: 14 },
  productPickerBtn: {
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#60A5FA',
    backgroundColor: '#071a2e',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPickerBtnText: { color: '#60A5FA', fontSize: 13, fontWeight: '600' },
  productSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#0B2240',
    borderRadius: 6,
    marginBottom: 8,
  },
  productSelectedName: { color: '#60A5FA', fontSize: 13, fontWeight: '600' },
  changeText: { color: '#475569', fontSize: 11 },
  productDropdown: {
    backgroundColor: '#131c23',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    maxHeight: 200,
  },
  searchInput: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 6,
    color: '#CBD5E1',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
  },
  productDropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
  },
  productDropdownName: { color: '#CBD5E1', fontSize: 13 },
  productDropdownUnit: { color: '#475569', fontSize: 11 },
  quickCreateRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  quickCreateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#071a2e',
    borderWidth: 1,
    borderColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCreateBtnDisabled: { borderColor: '#1F3A59', backgroundColor: '#0E1A2B' },
  quickCreateBtnText: { color: '#60A5FA', fontSize: 14, fontWeight: '700' },
  closePicker: { paddingVertical: 6, alignItems: 'center', marginTop: 4 },
  closePickerText: { color: '#8FA8C9', fontSize: 12 },
  lineFields: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  fieldLabel: { color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  fieldInput: {
    backgroundColor: '#131c23',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 6,
    color: '#CBD5E1',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  locationChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#131c23',
    marginRight: 4,
  },
  locationChipActive: { borderColor: '#60A5FA', backgroundColor: '#071a2e' },
  locationChipText: { color: '#8FA8C9', fontSize: 11 },
  addLineBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 12,
  },
  addLineBtnText: { color: '#475569', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
