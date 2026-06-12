import React, { useEffect, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import type { FinvenLocation, FinvenStockItem, FinvenProduct } from '../../types/finven';

const ICON_OPTIONS = ['Package', 'Refrigerator', 'Flame', 'ShoppingBag', 'Box', 'Archive', 'Home'];

interface LocationDetailSheetProps {
  visible: boolean;
  location: FinvenLocation | null;
  stockItems: FinvenStockItem[];
  products: FinvenProduct[];
  onClose: () => void;
  onUpdate: (patch: Partial<Pick<FinvenLocation, 'name' | 'icon'>>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

export default function LocationDetailSheet({
  visible, location, stockItems, products,
  onClose, onUpdate, onDelete,
}: LocationDetailSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setIcon(location.icon ?? null);
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [location]);

  if (!location) return null;

  const locationItems = stockItems.filter((s) => s.location_id === location.id);

  const today = new Date();
  const threeDays = new Date(today);
  threeDays.setDate(today.getDate() + 3);

  const getExpiryColor = (expiryDate: string | null): string => {
    if (!expiryDate) return '#CBD5E1';
    const d = new Date(expiryDate);
    if (d < today) return '#f87171';
    if (d <= threeDays) return '#FBBF24';
    return '#CBD5E1';
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await onUpdate({ name: name.trim() || location.name, icon });
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            {editing ? (
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={name}
                onChangeText={setName}
                placeholder="Location name"
                placeholderTextColor="#475569"
              />
            ) : (
              <Text style={styles.locationName}>{location.name}</Text>
            )}
            <TouchableOpacity
              {...uiProps(uiPath('finven', 'location_sheet', 'edit_toggle'))}
              style={styles.editButton}
              onPress={() => { logUI(uiPath('finven', 'location_sheet', 'edit_toggle'), 'press'); setEditing((v) => !v); }}
            >
              <Text style={styles.editButtonText}>{editing ? 'Cancel' : '✎'}</Text>
            </TouchableOpacity>
          </View>

          {editing && (
            <View style={styles.editSection}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconRow}>
                {ICON_OPTIONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconOption, icon === ic && styles.iconOptionActive]}
                    onPress={() => setIcon(icon === ic ? null : ic)}
                  >
                    <Text style={styles.iconOptionText}>{ic.slice(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            Items ({locationItems.length})
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {locationItems.length === 0 ? (
              <Text style={styles.emptyHint}>No stock items here</Text>
            ) : (
              locationItems.map((item) => {
                const product = products.find((p) => p.id === item.product_id);
                const expiryColor = getExpiryColor(item.expiry_date ?? null);
                return (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemPrimary}>
                      <Text style={styles.itemName}>{product?.name ?? 'Unknown product'}</Text>
                      <Text style={styles.itemMeta}>
                        {item.quantity} {item.unit}
                        {item.low_stock_threshold !== null ? ` · low: ${item.low_stock_threshold}` : ''}
                      </Text>
                    </View>
                    {item.expiry_date && (
                      <Text style={[styles.expiryText, { color: expiryColor }]}>
                        {item.expiry_date}
                      </Text>
                    )}
                  </View>
                );
              })
            )}

            {/* Delete */}
            <View style={{ marginTop: 16 }}>
              {confirmDelete ? (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Delete this location? Stock items will lose location.</Text>
                  <View style={styles.confirmButtons}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={async () => { await onDelete(); onClose(); }}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDelete(true)}>
                  <Text style={styles.deleteBtnText}>Delete location</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#131c23',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    maxHeight: '80%',
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
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  locationName: { flex: 1, color: '#CBD5E1', fontSize: 18, fontWeight: '700' },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  editButtonText: { color: '#8FA8C9', fontSize: 13 },
  editSection: { marginBottom: 12 },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 4,
  },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  iconOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  iconOptionActive: { borderColor: '#60A5FA', backgroundColor: '#071a2e' },
  iconOptionText: { color: '#8FA8C9', fontSize: 11 },
  sectionTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  itemPrimary: { flex: 1 },
  itemName: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  itemMeta: { color: '#475569', fontSize: 11, marginTop: 2 },
  expiryText: { fontSize: 11, fontWeight: '600' },
  emptyHint: { color: '#475569', fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  input: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  saveBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#071a2e',
    borderWidth: 1,
    borderColor: '#60A5FA',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#0E1A2B', borderColor: '#1F3A59' },
  saveBtnText: { color: '#60A5FA', fontWeight: '700' },
  confirmRow: { gap: 8 },
  confirmText: { color: '#f87171', fontSize: 13 },
  confirmButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  deleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a0000',
    borderWidth: 1,
    borderColor: '#f87171',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#f87171', fontWeight: '700' },
});
