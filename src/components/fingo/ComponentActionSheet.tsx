import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import type { Component } from '../../types/fingo';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

export type ComponentActionType =
  | 'edit'
  | 'set_picture'
  | 'add_sub'
  | 'add_interval'
  | 'log_service'
  | 'recalculate_tracking'
  | 'uninstall'
  | 'install'
  | 'replace_same'
  | 'replace_new'
  | 'retire'
  | 'delete';

interface Props {
  visible: boolean;
  component: Component | null;
  onAction: (action: ComponentActionType, component: Component) => void;
  onClose: () => void;
}

export default function ComponentActionSheet({ visible, component, onAction, onClose }: Props) {
  const [showReplaceMenu, setShowReplaceMenu] = useState(false);

  const emit = (action: ComponentActionType) => {
    if (!component) return;
    logUI(uiPath('fingo', 'component_action_sheet', action), 'press');
    onAction(action, component);
    setShowReplaceMenu(false);
    onClose();
  };

  const isInstalled = component?.status === 'installed';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {component && (
          <Text style={styles.componentName} numberOfLines={1}>{component.name}</Text>
        )}

        {showReplaceMenu ? (
          <>
            <Text style={styles.sectionLabel}>Replace with</Text>
            <TouchableOpacity style={styles.row} onPress={() => emit('replace_same')}>
              <Text style={styles.rowIcon}>♻️</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Same component</Text>
                <Text style={styles.rowHint}>New instance of the same type, tracking resets</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={() => emit('replace_new')}>
              <Text style={styles.rowIcon}>🔄</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Different component</Text>
                <Text style={styles.rowHint}>Choose a new component from the library</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelRow} onPress={() => setShowReplaceMenu(false)}>
              <Text style={styles.cancelText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ScrollView bounces={false}>
            {isInstalled && (
              <>
                <TouchableOpacity style={styles.row} onPress={() => emit('add_sub')}>
                  <Text style={styles.rowIcon}>➕</Text>
                  <Text style={styles.rowTitle}>Add sub-component</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.row} onPress={() => emit('add_interval')}>
                  <Text style={styles.rowIcon}>🔔</Text>
                  <Text style={styles.rowTitle}>Add service interval</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.row} onPress={() => emit('log_service')}>
                  <Text style={styles.rowIcon}>🔧</Text>
                  <Text style={styles.rowTitle}>Log service</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}

            <TouchableOpacity style={styles.row} onPress={() => emit('edit')}>
              <Text style={styles.rowIcon}>✏️</Text>
              <Text style={styles.rowTitle}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => emit('set_picture')}>
              <Text style={styles.rowIcon}>📷</Text>
              <Text style={styles.rowTitle}>Set picture</Text>
            </TouchableOpacity>

            {isInstalled && (
              <TouchableOpacity style={styles.row} onPress={() => emit('recalculate_tracking')}>
                <Text style={styles.rowIcon}>🔄</Text>
                <Text style={styles.rowTitle}>Recalculate tracking</Text>
              </TouchableOpacity>
            )}

            {isInstalled ? (
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    logUI(uiPath('fingo', 'component_action_sheet', 'replace_open'), 'press');
                    setShowReplaceMenu(true);
                  }}
                >
                  <Text style={styles.rowIcon}>🔄</Text>
                  <Text style={styles.rowTitle}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.row} onPress={() => emit('uninstall')}>
                  <Text style={styles.rowIcon}>📦</Text>
                  <Text style={styles.rowTitle}>Move to storage</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.row} onPress={() => emit('install')}>
                <Text style={styles.rowIcon}>🔩</Text>
                <Text style={styles.rowTitle}>Reinstall on this asset</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            <TouchableOpacity style={[styles.row, styles.destructiveRow]} onPress={() => emit('retire')}>
              <Text style={styles.rowIcon}>🗃️</Text>
              <Text style={[styles.rowTitle, styles.destructiveText]}>Retire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.destructiveRow]} onPress={() => emit('delete')}>
              <Text style={styles.rowIcon}>🗑️</Text>
              <Text style={[styles.rowTitle, styles.destructiveText]}>Delete</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    paddingBottom: 40,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginTop: 8,
    marginBottom: 4,
  },
  componentName: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  rowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '500',
  },
  rowHint: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  destructiveRow: {},
  destructiveText: {
    color: '#f87171',
  },
  divider: {
    height: 1,
    backgroundColor: '#1F3A59',
    marginVertical: 4,
    marginHorizontal: 20,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: '#64748B',
    fontSize: 15,
  },
});
