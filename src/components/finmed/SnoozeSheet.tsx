import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SNOOZE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
];

interface SnoozeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSnooze: (minutes: number, until: string) => void;
}

export default function SnoozeSheet({ visible, onClose, onSnooze }: SnoozeSheetProps) {
  const { bottom } = useSafeAreaInsets();

  const handleSnooze = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    onSnooze(minutes, until);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Snooze for…</Text>
          {SNOOZE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.minutes}
              style={styles.option}
              onPress={() => handleSnooze(opt.minutes)}
            >
              <Text style={styles.optionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 6,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: '#2C4669', marginBottom: 8,
  },
  title: { color: '#CBD5E1', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  option: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
  },
  optionText: { color: '#CBD5E1', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600' },
});
