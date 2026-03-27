import React from 'react';
import { Alert, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../../screens/DashboardScreen.styles';
import { COLOR_PRESETS } from '../../types/dashboard';
import Icon from '../Icon';

type TagModalProps = {
  visible: boolean;
  onClose: () => void;
  editingTagId: string | null;
  tagName: string;
  setTagName: (v: string) => void;
  tagColor: string | null;
  setTagColor: (v: string | null) => void;
  tagIcon: string | null;
  setTagIcon: (v: string | null) => void;
  onSave: () => void;
  onDelete: (tagId: string) => void;
  openIconPickerSheet: (target: 'tag') => void;
  saving: boolean;
};

const TagModal: React.FC<TagModalProps> = ({
  visible,
  onClose,
  editingTagId,
  tagName,
  setTagName,
  tagColor,
  setTagColor,
  tagIcon,
  setTagIcon,
  onSave,
  onDelete,
  openIconPickerSheet,
  saving,
}) => (
  <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
        <Text style={styles.modalTitle}>{editingTagId ? 'Edit tag' : 'Create tag'}</Text>
        <TextInput
          placeholder="Tag name"
          placeholderTextColor="#64748B"
          value={tagName}
          onChangeText={setTagName}
          style={styles.input}
        />

        {/* Color picker */}
        <Text style={styles.modalLabel}>Color</Text>
        <View style={styles.colorPresetRow}>
          {COLOR_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.colorPresetDot, { backgroundColor: preset }, tagColor === preset && styles.colorPresetDotActive]}
              onPress={() => setTagColor(tagColor === preset ? null : preset)}
            />
          ))}
        </View>

        {/* Tag icon picker */}
        <Text style={styles.modalLabel}>Icon</Text>
        <View style={styles.iconPickerRow}>
          <TouchableOpacity
            style={[styles.iconPickerPreview, tagIcon ? { borderColor: tagColor ?? '#53E3A6' } : undefined]}
            onPress={() => openIconPickerSheet('tag')}
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
                const idToDelete = editingTagId;
                Alert.alert('Remove tag', 'Delete this tag?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                      void onDelete(idToDelete);
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
            <Text style={styles.modalPrimaryText}>{editingTagId ? 'Save' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

export default React.memo(TagModal);
