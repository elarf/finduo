import React from 'react';
import { Alert, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppTag, TransactionType, COLOR_PRESETS, suggestIcon } from '../../types/dashboard';

type CategoryModalProps = {
  visible: boolean;
  onClose: () => void;
  editingCategoryId: string | null;
  categoryName: string;
  setCategoryName: (v: string) => void;
  categoryType: TransactionType;
  setCategoryType: (v: TransactionType) => void;
  categoryColor: string | null;
  setCategoryColor: (v: string | null) => void;
  categoryIcon: string | null;
  setCategoryIcon: (v: string | null) => void;
  categoryTagIds: string[];
  setCategoryTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  tags: AppTag[];
  onSave: () => void;
  onDelete: (categoryId: string) => void;
  openIconPickerSheet: (target: 'category') => void;
  saving: boolean;
};

function CategoryModal({
  visible, onClose, editingCategoryId,
  categoryName, setCategoryName,
  categoryType, setCategoryType,
  categoryColor, setCategoryColor,
  categoryIcon, setCategoryIcon,
  categoryTagIds, setCategoryTagIds,
  tags, onSave, onDelete, openIconPickerSheet, saving,
}: CategoryModalProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{editingCategoryId ? 'Edit category' : 'Create category'}</Text>
          <TextInput
            placeholder="Category name"
            placeholderTextColor="#64748B"
            value={categoryName}
            onChangeText={setCategoryName}
            style={styles.input}
          />
          <View style={styles.entryTypeRow}>
            <TouchableOpacity
              style={[styles.toggleButton, categoryType === 'income' && styles.toggleButtonActive]}
              onPress={() => setCategoryType('income')}
            >
              <Text style={styles.toggleButtonText}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, categoryType === 'expense' && styles.toggleButtonActive]}
              onPress={() => setCategoryType('expense')}
            >
              <Text style={styles.toggleButtonText}>Expense</Text>
            </TouchableOpacity>
          </View>

          {/* Icon picker */}
          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.iconPickerRow}>
            <TouchableOpacity
              style={[styles.iconPickerPreview, categoryIcon && { borderColor: categoryColor ?? '#53E3A6' }]}
              onPress={() => openIconPickerSheet('category')}
            >
              {categoryIcon ? (
                <Icon name={categoryIcon as any} size={24} color={categoryColor ?? '#EAF3FF'} />
              ) : (
                <Icon name={"label" as any} size={24} color="#64748B" />
              )}
              <Icon name="expand_more" size={16} color="#64748B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            {categoryIcon && (
              <TouchableOpacity onPress={() => setCategoryIcon(null)}>
                <Text style={styles.linkAction}>Clear</Text>
              </TouchableOpacity>
            )}
            {categoryName.trim() && suggestIcon(categoryName) && !categoryIcon && (
              <TouchableOpacity onPress={() => setCategoryIcon(suggestIcon(categoryName))}>
                <Text style={styles.linkAction}>Suggest</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Color picker */}
          <Text style={styles.modalLabel}>Color</Text>
          <View style={styles.colorPresetRow}>
            {COLOR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.colorPresetDot, { backgroundColor: preset }, categoryColor === preset && styles.colorPresetDotActive]}
                onPress={() => setCategoryColor(categoryColor === preset ? null : preset)}
              />
            ))}
          </View>

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <Text style={styles.modalLabel}>Tags</Text>
              <View style={styles.menuChipWrap}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.modalChip,
                      categoryTagIds.includes(tag.id) && styles.modalChipActive,
                      tag.color ? { borderColor: tag.color } : undefined,
                    ]}
                    onPress={() => setCategoryTagIds((prev) =>
                      prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                    )}
                  >
                    <Text style={[styles.modalChipText, tag.color && categoryTagIds.includes(tag.id) ? { color: tag.color } : undefined]}>
                      #{tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            {editingCategoryId && (
              <TouchableOpacity
                style={styles.modalDanger}
                onPress={() => {
                  Alert.alert('Remove category', 'Delete this category?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        void onDelete(editingCategoryId);
                      },
                    },
                  ]);
                }}
              >
                <Text style={styles.modalDangerText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimary} onPress={onSave} disabled={saving}>
              <Text style={styles.modalPrimaryText}>{editingCategoryId ? 'Update' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(CategoryModal);
