import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList, Modal, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface ScrollWheelInputProps {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  style?: object;
}

export default function ScrollWheelInput({ items, value, onChange, label, style }: ScrollWheelInputProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardValue, setKeyboardValue] = useState('');
  const listRef = useRef<FlatList>(null);
  const currentIdx = Math.max(0, items.indexOf(value));

  const scrollToIndex = useCallback((idx: number) => {
    listRef.current?.scrollToIndex({ index: idx, animated: true });
  }, []);

  const handleMomentumEnd = useCallback((e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const idx = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    onChange(items[clamped]);
  }, [items, onChange]);

  const openKeyboard = () => {
    setKeyboardValue(value);
    setKeyboardVisible(true);
  };

  const confirmKeyboard = () => {
    const trimmed = keyboardValue.trim();
    if (!trimmed) { setKeyboardVisible(false); return; }
    if (items.includes(trimmed)) {
      onChange(trimmed);
      const idx = items.indexOf(trimmed);
      scrollToIndex(idx);
    } else {
      // free-text value outside preset list — still accept it
      onChange(trimmed);
    }
    setKeyboardVisible(false);
  };

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity activeOpacity={0.8} onPress={openKeyboard} style={styles.container}>
        {/* fade overlays */}
        <View style={styles.fadeTop} pointerEvents="none" />
        <View style={styles.selectionBar} pointerEvents="none" />
        <View style={styles.fadeBottom} pointerEvents="none" />
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          initialScrollIndex={currentIdx}
          onMomentumScrollEnd={handleMomentumEnd}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={[styles.itemText, item === value && styles.itemTextSelected]}>
                {item}
              </Text>
            </View>
          )}
        />
      </TouchableOpacity>

      <Modal visible={keyboardVisible} transparent animationType="fade" onRequestClose={() => setKeyboardVisible(false)}>
        <View style={styles.kbOverlay}>
          <View style={styles.kbSheet}>
            {label ? <Text style={styles.kbLabel}>{label}</Text> : null}
            <TextInput
              style={styles.kbInput}
              value={keyboardValue}
              onChangeText={setKeyboardValue}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              placeholderTextColor="#475569"
            />
            <View style={styles.kbActions}>
              <TouchableOpacity style={styles.kbCancel} onPress={() => setKeyboardVisible(false)}>
                <Text style={styles.kbCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.kbConfirm} onPress={confirmKeyboard}>
                <Text style={styles.kbConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  container: {
    width: 100,
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0B1728',
  },
  fadeTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: ITEM_HEIGHT * 2, zIndex: 1,
    backgroundColor: 'transparent',
  },
  fadeBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: ITEM_HEIGHT * 2, zIndex: 1,
    backgroundColor: 'transparent',
  },
  selectionBar: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0, right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F472B6',
    zIndex: 2,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { color: '#475569', fontSize: 18, fontWeight: '500' },
  itemTextSelected: { color: '#CBD5E1', fontWeight: '700' },
  // keyboard modal
  kbOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  kbSheet: {
    backgroundColor: '#0B1728',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 20,
    width: 220,
    gap: 12,
  },
  kbLabel: { color: '#8FA8C9', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  kbInput: {
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    color: '#CBD5E1',
    fontSize: 24,
    textAlign: 'center',
    paddingVertical: 10,
  },
  kbActions: { flexDirection: 'row', gap: 10 },
  kbCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#1F3A59', alignItems: 'center',
  },
  kbCancelText: { color: '#64748B', fontWeight: '600' },
  kbConfirm: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#2d0a1a', borderWidth: 1, borderColor: '#F472B6', alignItems: 'center',
  },
  kbConfirmText: { color: '#F472B6', fontWeight: '700' },
});
