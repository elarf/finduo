import React, { useEffect } from 'react';
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from '../components/Icon';
import { ModalShell } from '../components/ModalShell';
import { styles } from './DashboardScreen.styles';
import { COLOR_PRESETS, suggestIcon } from '../types/dashboard';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import { useDashboard } from '../context/DashboardContext';
import type { RootStackParamList } from '../navigation';

type CategoryScreenRouteProp = RouteProp<RootStackParamList, 'Category'>;

export default function CategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute<CategoryScreenRouteProp>();
  const { categoryId } = route.params || {};

  const {
    categoryName, setCategoryName,
    categoryType, setCategoryType,
    categoryColor, setCategoryColor,
    categoryIcon, setCategoryIcon,
    categoryTagIds, setCategoryTagIds,
    tags,
    saveCategory,
    deleteCategory,
    toggleCategoryHidden,
    cloneTempCategory,
    openIconPickerSheet,
    saving,
    categories,
    hiddenCategoryIds,
    user,
  } = useDashboard();

  const editingCategoryId = categoryId ?? null;
  const currentCategory = editingCategoryId ? categories.find((c) => c.id === editingCategoryId) : null;

  // Initialize form state when editing
  useEffect(() => {
    if (editingCategoryId && currentCategory) {
      setCategoryName(currentCategory.name);
      setCategoryType(currentCategory.type);
      setCategoryColor(currentCategory.color ?? null);
      setCategoryIcon(currentCategory.icon ?? null);
      setCategoryTagIds((currentCategory.tag_ids ?? []) as string[]);
    } else {
      setCategoryName('');
      setCategoryType('expense');
      setCategoryColor(null);
      setCategoryIcon(null);
      setCategoryTagIds([]);
    }
  }, [editingCategoryId, currentCategory, setCategoryName, setCategoryType, setCategoryColor, setCategoryIcon, setCategoryTagIds]);
  const isOwnedByUser = !editingCategoryId || currentCategory?.user_id === user?.id;
  const isTempForUser = !!editingCategoryId && !!(currentCategory?.temp_for?.includes(user?.id ?? ''));
  const isDefault = !!editingCategoryId && !!(currentCategory?.is_default);
  const isHidden = editingCategoryId ? hiddenCategoryIds.has(editingCategoryId) : false;
  const readOnly = editingCategoryId !== null && !isOwnedByUser;

  const handleClose = () => navigation.goBack();

  const handleSave = async () => {
    await saveCategory(categoryId);
    navigation.goBack();
  };

  const handleDelete = async (categoryId: string) => {
    await deleteCategory(categoryId);
    navigation.goBack();
  };

  const handleToggleHidden = async (categoryId: string) => {
    await toggleCategoryHidden(categoryId);
    navigation.goBack();
  };

  const handleClone = async (categoryId: string) => {
    await cloneTempCategory(categoryId);
    navigation.goBack();
  };

  return (
    <ModalShell onDismiss={handleClose} maxWidth={440}>
      <View style={styles.modalCard} {...uiProps(uiPath('category_screen', 'modal', 'card'))}>
        <Text style={styles.modalTitle} {...uiProps(uiPath('category_screen', 'modal', 'title'))}>
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
            {...uiProps(uiPath('category_screen', 'form', 'name_input'))}
          />
          <View style={[styles.entryTypeRow, readOnly && { opacity: 0.5, pointerEvents: 'none' as const }]}>
            <TouchableOpacity
              style={[styles.toggleButton, categoryType === 'income' && styles.toggleButtonActive]}
              onPress={() => { logUI(uiPath('category_screen', 'type_toggle', 'income'), 'press'); setCategoryType('income'); }}
              disabled={readOnly}
              {...uiProps(uiPath('category_screen', 'type_toggle', 'income'))}
            >
              <Text style={styles.toggleButtonText}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, categoryType === 'expense' && styles.toggleButtonActive]}
              onPress={() => { logUI(uiPath('category_screen', 'type_toggle', 'expense'), 'press'); setCategoryType('expense'); }}
              {...uiProps(uiPath('category_screen', 'type_toggle', 'expense'))}
            >
              <Text style={styles.toggleButtonText}>Expense</Text>
            </TouchableOpacity>
          </View>

          {/* Icon picker */}
          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.iconPickerRow}>
            <TouchableOpacity
              style={[styles.iconPickerPreview, categoryIcon && { borderColor: categoryColor ?? '#53E3A6' }]}
              onPress={() => { logUI(uiPath('category_screen', 'form', 'icon_picker_button'), 'press'); openIconPickerSheet('category'); }}
              {...uiProps(uiPath('category_screen', 'form', 'icon_picker_button'))}
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
                onPress={() => { logUI(uiPath('category_screen', 'form', 'color_dot', String(index)), 'press'); setCategoryColor(categoryColor === preset ? null : preset); }}
                {...uiProps(uiPath('category_screen', 'form', 'color_dot', String(index)))}
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
                      logUI(uiPath('category_screen', 'form', 'tag_chip', tag.id), 'press');
                      setCategoryTagIds((prev) =>
                        prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                      );
                    }}
                    {...uiProps(uiPath('category_screen', 'form', 'tag_chip', tag.id))}
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
                  logUI(uiPath('category_screen', 'actions', 'remove_button'), 'press');
                  if (readOnly) return;
                  if (Platform.OS === 'web') {
                    if ((window as any).confirm('Delete this category?')) {
                      void handleDelete(editingCategoryId);
                    }
                  } else {
                    Alert.alert('Remove category', 'Delete this category?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => { void handleDelete(editingCategoryId); } },
                    ]);
                  }
                }}
                disabled={readOnly}
                {...uiProps(uiPath('category_screen', 'actions', 'remove_button'))}
              >
                <Text style={styles.modalDangerText}>Remove</Text>
              </TouchableOpacity>
            )}
            {editingCategoryId && !isDefault && (
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => { logUI(uiPath('category_screen', 'actions', 'hide_button'), 'press'); void handleToggleHidden(editingCategoryId); }}
                {...uiProps(uiPath('category_screen', 'actions', 'hide_button'))}
              >
                <Text style={styles.modalSecondaryText}>{isHidden ? 'Unhide' : 'Hide'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => { logUI(uiPath('category_screen', 'actions', 'cancel_button'), 'press'); handleClose(); }}
              {...uiProps(uiPath('category_screen', 'actions', 'cancel_button'))}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            {isTempForUser && editingCategoryId && (
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => { logUI(uiPath('category_screen', 'actions', 'keep_button'), 'press'); void handleClone(editingCategoryId); }}
                disabled={saving}
                {...uiProps(uiPath('category_screen', 'actions', 'keep_button'))}
              >
                <Text style={styles.modalPrimaryText}>Keep</Text>
              </TouchableOpacity>
            )}
            {!readOnly && (
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => { logUI(uiPath('category_screen', 'actions', 'save_button'), 'press'); void handleSave(); }}
                disabled={saving}
                {...uiProps(uiPath('category_screen', 'actions', 'save_button'))}
              >
                <Text style={styles.modalPrimaryText}>{editingCategoryId ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
    </ModalShell>
  );
}
