import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import type { AppCategory } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type Props = {
  visible: boolean;
  categories: AppCategory[];
  linkedCategoryIds: string[];
  onLink: (categoryId: string) => void;
  onUnlink: (categoryId: string) => void;
  onClose: () => void;
};

export default function AssetCategoryPicker({
  visible,
  categories,
  linkedCategoryIds,
  onLink,
  onUnlink,
  onClose,
}: Props) {
  const linked = new Set(linkedCategoryIds);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Link Categories</Text>
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'category_picker', 'close_button'))}
              onPress={() => {
                logUI(uiPath('fingo', 'category_picker', 'close_button'), 'press');
                onClose();
              }}
            >
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Transactions from linked categories appear in this asset's statistics.
          </Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {categories.filter((c) => c.name !== 'Transfer').map((cat) => {
              const isLinked = linked.has(cat.id);
              const color = cat.color ?? (cat.type === 'expense' ? '#f87171' : '#4ade80');
              return (
                <TouchableOpacity
                  {...uiProps(uiPath('fingo', 'category_picker', 'row', cat.id))}
                  key={cat.id}
                  style={styles.row}
                  onPress={() => {
                    logUI(uiPath('fingo', 'category_picker', 'row', cat.id), 'press');
                    if (isLinked) onUnlink(cat.id);
                    else onLink(cat.id);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.catName, { color }]}>{cat.name}</Text>
                  <Text style={styles.catType}>{cat.type}</Text>
                  <View style={[styles.toggle, isLinked && styles.toggleActive]}>
                    <Text style={[styles.toggleText, isLinked && styles.toggleTextActive]}>
                      {isLinked ? '✓' : '+'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#131c23',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderColor: '#1F3A59',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
  },
  closeText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: '#475569',
    fontSize: 11,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  catType: {
    color: '#475569',
    fontSize: 11,
  },
  toggle: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#053d1e',
    borderColor: '#4ade80',
  },
  toggleText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#4ade80',
  },
});
