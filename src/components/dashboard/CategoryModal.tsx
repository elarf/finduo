import React from 'react';
import { Alert, Modal, Platform, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppTag, TransactionType, COLOR_PRESETS, suggestIcon } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

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
  onToggleHidden: (categoryId: string) => void;
  onClone: (categoryId: string) => void;
  openIconPickerSheet: (target: 'category') => void;
  saving: boolean;
  isOwnedByUser: boolean;
  isTempForUser: boolean;
  isDefault: boolean;
  isHidden: boolean;
};

function CategoryModal({
  visible, onClose, editingCategoryId,
  categoryName, setCategoryName,
  categoryType, setCategoryType,
  categoryColor, setCategoryColor,
  categoryIcon, setCategoryIcon,
  categoryTagIds, setCategoryTagIds,
  tags, onSave, onDelete, onToggleHidden, onClone, openIconPickerSheet, saving,
  isOwnedByUser, isTempForUser, isDefault, isHidden,
}: CategoryModalProps) {
  const readOnly = editingCategoryId !== null && !isOwnedByUser;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => { logUI(uiPath('category_modal', 'modal', 'backdrop'), 'press'); onClose(); }}
        {...uiProps(uiPath('category_modal', 'modal', 'backdrop'))}
      >
        <Pressable
          style={styles.modalCard}
          onPress={(event) => { logUI(uiPath('category_modal', 'modal', 'card'), 'press'); event.stopPropagation(); }}
          {...uiProps(uiPath('category_modal', 'modal', 'card'))}
        >
          <Text style={styles.modalTitle} {...uiProps(uiPath('category_modal', 'modal', 'title'))}>
            {readOnly ? 'Category' : editingCategoryId ? 'Edit category' : 'Create category'}
          </Text>
          {readOnly && (
            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 8 }}>
              {isDefault ? 'System category' : isTempForUser ? 'Temp — access to this category was revoked' : 'Shared by another user'}
            </Text>
          )}
          <TextInput
            placeholder="Category name"
            placeholderTextColor="#64748B"
            value={categoryName}
            onChangeText={setCategoryName}
            style={[styles.input, readOnly && { opacity: 0.5 }]}
            editable={!readOnly}
            {...uiProps(uiPath('category_modal', 'form', 'name_input'))}
          />
          <View style={[styles.entryTypeRow, readOnly && { opacity: 0.5, pointerEvents: 'none' as const }]}>
            <TouchableOpacity
              style={[styles.toggleButton, categoryType === 'income' && styles.toggleButtonActive]}
              onPress={() => { logUI(uiPath('category_modal', 'type_toggle', 'income'), 'press'); setCategoryType('income'); }}
              disabled={readOnly}
              {...uiProps(uiPath('category_modal', 'type_toggle', 'income'))}
            >
              <Text style={styles.toggleButtonText}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, categoryType === 'expense' && styles.toggleButtonActive]}
              onPress={() => { logUI(uiPath('category_modal', 'type_toggle', 'expense'), 'press'); setCategoryType('expense'); }}
              {...uiProps(uiPath('category_modal', 'type_toggle', 'expense'))}
            >
              <Text style={styles.toggleButtonText}>Expense</Text>
            </TouchableOpacity>
          </View>

          {/* Icon picker */}
          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.iconPickerRow}>
            <TouchableOpacity
              style={[styles.iconPickerPreview, categoryIcon && { borderColor: categoryColor ?? '#53E3A6' }]}
              onPress={() => { logUI(uiPath('category_modal', 'form', 'icon_picker_button'), 'press'); openIconPickerSheet('category'); }}
              {...uiProps(uiPath('category_modal', 'form', 'icon_picker_button'))}
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
            {COLOR_PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={preset}
                style={[styles.colorPresetDot, { backgroundColor: preset }, categoryColor === preset && styles.colorPresetDotActive]}
                onPress={() => { logUI(uiPath('category_modal', 'form', 'color_dot', String(index)), 'press'); setCategoryColor(categoryColor === preset ? null : preset); }}
                {...uiProps(uiPath('category_modal', 'form', 'color_dot', String(index)))}
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
                    onPress={() => {
                      logUI(uiPath('category_modal', 'form', 'tag_chip', tag.id), 'press');
                      setCategoryTagIds((prev) =>
                        prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                      );
                    }}
                    {...uiProps(uiPath('category_modal', 'form', 'tag_chip', tag.id))}
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
            {editingCategoryId && !isDefault && (
              <TouchableOpacity
                style={[styles.modalDanger, !isOwnedByUser && { opacity: 0.5 }]}
                onPress={() => {
                  logUI(uiPath('category_modal', 'actions', 'remove_button'), 'press');
                  if (readOnly) return;
                  if (Platform.OS === 'web') {
                    if ((window as any).confirm('Delete this category?')) {
                      void onDelete(editingCategoryId);
                    }
                  } else {
                    Alert.alert('Remove category', 'Delete this category?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => { void onDelete(editingCategoryId); } },
                    ]);
                  }
                }}
                disabled={readOnly}
                {...uiProps(uiPath('category_modal', 'actions', 'remove_button'))}
              >
                <Text style={styles.modalDangerText}>Remove</Text>
              </TouchableOpacity>
            )}
            {editingCategoryId && !isDefault && (
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => { logUI(uiPath('category_modal', 'actions', 'hide_button'), 'press'); onToggleHidden(editingCategoryId); }}
                {...uiProps(uiPath('category_modal', 'actions', 'hide_button'))}
              >
                <Text style={styles.modalSecondaryText}>{isHidden ? 'Unhide' : 'Hide'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => { logUI(uiPath('category_modal', 'actions', 'cancel_button'), 'press'); onClose(); }}
              {...uiProps(uiPath('category_modal', 'actions', 'cancel_button'))}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            {isTempForUser && editingCategoryId && (
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => { logUI(uiPath('category_modal', 'actions', 'keep_button'), 'press'); onClone(editingCategoryId); }}
                disabled={saving}
                {...uiProps(uiPath('category_modal', 'actions', 'keep_button'))}
              >
                <Text style={styles.modalPrimaryText}>Keep</Text>
              </TouchableOpacity>
            )}
            {!readOnly && (
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => { logUI(uiPath('category_modal', 'actions', 'save_button'), 'press'); onSave(); }}
                disabled={saving}
                {...uiProps(uiPath('category_modal', 'actions', 'save_button'))}
              >
                <Text style={styles.modalPrimaryText}>{editingCategoryId ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(CategoryModal);
