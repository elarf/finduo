import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import { poolSharedStyles as sh } from './poolStyles';
import type { PoolType } from '../../types/pools';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: PoolType) => Promise<void>;
}

export function CreatePoolModal({ visible, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PoolType>('event');

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter a pool name.');
      return;
    }
    await onSubmit(name.trim(), type);
    setName('');
    setType('event');
  }, [name, onSubmit, type]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={sh.modalBackdrop}
        onPress={onClose}
        {...uiProps(uiPath('create_pool_modal', 'backdrop', 'container'))}
      >
        <Pressable
          style={sh.modalCard}
          onPress={(e) => e.stopPropagation()}
          {...uiProps(uiPath('create_pool_modal', 'card', 'container'))}
        >
          <Text style={sh.modalTitle} {...uiProps(uiPath('create_pool_modal', 'card', 'title'))}>
            Create pool
          </Text>
          <TextInput
            placeholder="Pool name"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
            style={sh.input}
            {...uiProps(uiPath('create_pool_modal', 'form', 'name_input'))}
          />
          <Text style={sh.label} {...uiProps(uiPath('create_pool_modal', 'form', 'type_label'))}>
            Type
          </Text>
          <View style={s.typeRow} {...uiProps(uiPath('create_pool_modal', 'type_selector', 'container'))}>
            <TouchableOpacity
              style={[s.typeButton, type === 'event' && s.typeButtonActive]}
              onPress={() => {
                logUI(uiPath('create_pool_modal', 'type_selector', 'event_button'), 'press');
                setType('event');
              }}
              {...uiProps(uiPath('create_pool_modal', 'type_selector', 'event_button'))}
            >
              <Text style={s.typeButtonText}>Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeButton, type === 'continuous' && s.typeButtonActive]}
              onPress={() => {
                logUI(uiPath('create_pool_modal', 'type_selector', 'continuous_button'), 'press');
                setType('continuous');
              }}
              {...uiProps(uiPath('create_pool_modal', 'type_selector', 'continuous_button'))}
            >
              <Text style={s.typeButtonText}>Continuous</Text>
            </TouchableOpacity>
          </View>
          <View style={sh.modalActions}>
            <TouchableOpacity
              style={sh.modalSecondary}
              onPress={() => {
                logUI(uiPath('create_pool_modal', 'actions', 'cancel_button'), 'press');
                onClose();
              }}
              {...uiProps(uiPath('create_pool_modal', 'actions', 'cancel_button'))}
            >
              <Text style={sh.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sh.modalPrimary}
              onPress={() => {
                logUI(uiPath('create_pool_modal', 'actions', 'create_button'), 'press');
                void handleSubmit();
              }}
              {...uiProps(uiPath('create_pool_modal', 'actions', 'create_button'))}
            >
              <Text style={sh.modalPrimaryText}>Create</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#0D2818',
  },
  typeButtonText: {
    color: '#EAF3FF',
    fontSize: 13,
  },
});
