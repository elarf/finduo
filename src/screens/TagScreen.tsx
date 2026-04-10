import React, { useEffect } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ModalShell } from '../components/ModalShell';
import { styles } from './DashboardScreen.styles';
import { COLOR_PRESETS } from '../types/dashboard';
import Icon from '../components/Icon';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import { useDashboard } from '../context/DashboardContext';
import type { RootStackParamList } from '../navigation';

type TagScreenRouteProp = RouteProp<RootStackParamList, 'Tag'>;

export default function TagScreen() {
  const navigation = useNavigation();
  const route = useRoute<TagScreenRouteProp>();
  const { tagId } = route.params || {};

  const {
    tagName, setTagName,
    tagColor, setTagColor,
    tagIcon, setTagIcon,
    saveTag,
    deleteTag,
    openIconPickerSheet,
    saving,
    tags,
  } = useDashboard();

  const editingTagId = tagId ?? null;
  const currentTag = editingTagId ? tags.find((t) => t.id === editingTagId) : null;

  // Initialize form state when editing
  useEffect(() => {
    if (editingTagId && currentTag) {
      setTagName(currentTag.name);
      setTagColor(currentTag.color ?? null);
      setTagIcon(currentTag.icon ?? null);
    } else {
      setTagName('');
      setTagColor(null);
      setTagIcon(null);
    }
  }, [editingTagId, currentTag, setTagName, setTagColor, setTagIcon]);

  const handleClose = () => navigation.goBack();

  const handleSave = async () => {
    await saveTag(tagId);
    navigation.goBack();
  };

  const handleDelete = async (tagId: string) => {
    await deleteTag(tagId);
    navigation.goBack();
  };

  return (
    <ModalShell onDismiss={handleClose} maxWidth={440}>
      <View style={styles.modalCard} {...uiProps(uiPath('tag_screen', 'modal', 'card'))}>
        <Text style={styles.modalTitle} {...uiProps(uiPath('tag_screen', 'modal', 'title'))}>
          {editingTagId ? 'Edit tag' : 'Create tag'}
        </Text>
          <TextInput
            placeholder="Tag name"
            placeholderTextColor="#64748B"
            value={tagName}
            onChangeText={setTagName}
            style={styles.input}
            {...uiProps(uiPath('tag_screen', 'form', 'name_input'))}
          />

          {/* Color picker */}
          <Text style={styles.modalLabel}>Color</Text>
          <View style={styles.colorPresetRow}>
            {COLOR_PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={preset}
                style={[styles.colorPresetDot, { backgroundColor: preset }, tagColor === preset && styles.colorPresetDotActive]}
                onPress={() => { logUI(uiPath('tag_screen', 'form', 'color_dot', String(index)), 'press'); setTagColor(tagColor === preset ? null : preset); }}
                {...uiProps(uiPath('tag_screen', 'form', 'color_dot', String(index)))}
              />
            ))}
          </View>

          {/* Tag icon picker */}
          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.iconPickerRow}>
            <TouchableOpacity
              style={[styles.iconPickerPreview, tagIcon ? { borderColor: tagColor ?? '#53E3A6' } : undefined]}
              onPress={() => { logUI(uiPath('tag_screen', 'form', 'icon_picker_button'), 'press'); openIconPickerSheet('tag'); }}
              {...uiProps(uiPath('tag_screen', 'form', 'icon_picker_button'))}
            >
              {tagIcon ? (
                <Icon name={tagIcon} size={24} color={tagColor ?? '#EAF3FF'} />
              ) : (
                <Icon name="Tag" size={24} color="#64748B" />
              )}
              <Icon name="expand_more" size={16} color="#64748B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            {tagIcon && (
              <TouchableOpacity onPress={() => setTagIcon(null)}>
                <Text style={styles.linkAction}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.modalActions}>
            {editingTagId && (
              <TouchableOpacity
                style={styles.modalDanger}
                onPress={() => {
                  logUI(uiPath('tag_screen', 'actions', 'remove_button'), 'press');
                  const idToDelete = editingTagId;
                  Alert.alert('Remove tag', 'Delete this tag?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        void handleDelete(idToDelete);
                      },
                    },
                  ]);
                }}
                {...uiProps(uiPath('tag_screen', 'actions', 'remove_button'))}
              >
                <Text style={styles.modalDangerText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => { logUI(uiPath('tag_screen', 'actions', 'cancel_button'), 'press'); handleClose(); }}
              {...uiProps(uiPath('tag_screen', 'actions', 'cancel_button'))}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => { logUI(uiPath('tag_screen', 'actions', 'save_button'), 'press'); void handleSave(); }}
              disabled={saving}
              {...uiProps(uiPath('tag_screen', 'actions', 'save_button'))}
            >
              <Text style={styles.modalPrimaryText}>{editingTagId ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
    </ModalShell>
  );
}
