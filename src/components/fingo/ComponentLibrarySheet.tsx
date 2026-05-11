import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, SectionList,
  StyleSheet, Platform,
} from 'react-native';
import ComponentIcon from './ComponentIcon';
import type { AssetType, Component, ComponentTemplate } from '../../types/fingo';
import { getTemplates } from '../../lib/fingo/componentTemplates';
import { getComponentIcon } from '../../lib/fingo/componentIcons';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

export type LibrarySelection =
  | { type: 'template'; template: ComponentTemplate }
  | { type: 'storage'; component: Component }
  | { type: 'custom'; name: string };

interface Props {
  visible: boolean;
  assetType: AssetType;
  assetName?: string | null;
  installedComponents: Component[];
  storageComponents: Component[];
  onSelect: (selection: LibrarySelection) => void;
  onClose: () => void;
}

export default function ComponentLibrarySheet({
  visible, assetType, assetName, installedComponents, storageComponents, onSelect, onClose,
}: Props) {
  const [query, setQuery] = useState('');

  const installedKeys = useMemo(
    () => new Set(installedComponents.map((c) => c.template_key).filter(Boolean)),
    [installedComponents],
  );

  const sections = useMemo(() => {
    const q = query.toLowerCase();

    const result: { title: string; data: (ComponentTemplate | Component)[] }[] = [];

    // Storage section
    const filteredStorage = storageComponents.filter((c) =>
      !q || c.name.toLowerCase().includes(q),
    );
    if (filteredStorage.length > 0) {
      result.push({ title: 'From Storage', data: filteredStorage });
    }

    // Template sections grouped by category
    for (const { category, items } of getTemplates(assetType)) {
      const filtered = items.filter((t) => !q || t.name.toLowerCase().includes(q));
      if (filtered.length > 0) {
        result.push({ title: category, data: filtered });
      }
    }

    return result;
  }, [query, assetType, storageComponents]);

  const isComponent = (item: ComponentTemplate | Component): item is Component =>
    'status' in item;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.tapZone} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add Component</Text>

          {assetName && (
            <Text style={styles.assetTag}>{assetName}</Text>
          )}

          <TextInput
            {...uiProps(uiPath('fingo', 'component_library', 'search'))}
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search components…"
            placeholderTextColor="#475569"
            autoFocus={Platform.OS !== 'web'}
            clearButtonMode="while-editing"
          />

          <SectionList
            sections={sections}
            keyExtractor={(item) => isComponent(item) ? item.id : item.key}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              if (isComponent(item)) {
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      logUI(uiPath('fingo', 'component_library', 'storage_item'), 'press');
                      onSelect({ type: 'storage', component: item });
                      onClose();
                    }}
                  >
                    <ComponentIcon
                      name={getComponentIcon(item.name, item.template_key)}
                      size={18}
                      color="#3B6A9E"
                    />
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      {item.notes ? (
                        <Text style={styles.rowHint} numberOfLines={1}>{item.notes}</Text>
                      ) : null}
                    </View>
                    <View style={styles.storageBadge}>
                      <Text style={styles.storageBadgeText}>in storage</Text>
                    </View>
                  </TouchableOpacity>
                );
              }

              const alreadyInstalled = installedKeys.has(item.key);
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    logUI(uiPath('fingo', 'component_library', 'template_item', item.key), 'press');
                    onSelect({ type: 'template', template: item });
                    onClose();
                  }}
                >
                  <ComponentIcon
                    name={getComponentIcon(item.name, item.key)}
                    size={18}
                    color="#3B6A9E"
                  />
                  <Text style={styles.rowName}>{item.name}</Text>
                  {alreadyInstalled && (
                    <View style={styles.installedBadge}>
                      <Text style={styles.installedBadgeText}>installed</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.listContent}
          />

          <TouchableOpacity
            style={styles.customRow}
            onPress={() => {
              logUI(uiPath('fingo', 'component_library', 'custom'), 'press');
              onSelect({ type: 'custom', name: query.trim() });
              onClose();
            }}
          >
            <Text style={styles.customIcon}>＋</Text>
            <Text style={styles.customText}>
              {query.trim() ? `Create "${query.trim()}"` : 'Add custom component'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelRow} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tapZone: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F3A59',
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  assetTag: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  search: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 20,
    marginBottom: 6,
  },
  sectionHeader: {
    backgroundColor: '#060D18',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  sectionTitle: {
    color: '#3B6A9E',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1F3A59',
    gap: 10,
  },
  rowLeft: { flex: 1 },
  rowName: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  rowHint: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  storageBadge: {
    backgroundColor: '#0D2137',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3B6A9E',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  storageBadgeText: {
    color: '#8FA8C9',
    fontSize: 10,
    fontWeight: '600',
  },
  installedBadge: {
    backgroundColor: '#0a2d18',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#166534',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  installedBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 8,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
  },
  cancelText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    gap: 12,
  },
  customIcon: {
    color: '#3B6A9E',
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  customText: {
    color: '#3B6A9E',
    fontSize: 14,
    fontWeight: '600',
  },
});
