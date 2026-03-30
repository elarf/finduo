import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { poolSharedStyles as sh } from './poolStyles';
import type { PoolMember, PoolTransaction } from '../../types/pools';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number, description: string, paidBy: string) => Promise<void>;
  editingTx: PoolTransaction | null;
  members: PoolMember[];
  currentUserId: string;
}

export function TransactionModal({
  visible,
  onClose,
  onSubmit,
  editingTx,
  members,
  currentUserId,
}: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId);

  // Seed form state when the modal opens
  useEffect(() => {
    if (!visible) return;
    if (editingTx) {
      setAmount(String(Number(editingTx.amount)));
      setDescription(editingTx.description);
      setPaidBy(editingTx.paid_by);
    } else {
      setAmount('');
      setDescription('');
      setPaidBy(currentUserId);
    }
    console.log('[TransactionModal] opened — members:', members, 'currentUserId:', currentUserId);
  }, [visible, editingTx, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const appendNumpad = useCallback((key: string) => {
    setAmount((prev) => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.' && prev.includes('.')) return prev;
      if (key === '.' && prev === '') return '0.';
      const parts = prev.split('.');
      if (parts.length === 2 && parts[1].length >= 2) return prev;
      if (prev === '0' && key !== '.') return key;
      return prev + key;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    await onSubmit(parsed, description.trim(), paidBy || currentUserId);
  }, [amount, currentUserId, description, onSubmit, paidBy]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={sh.modalBackdrop} onPress={onClose}>
        <Pressable style={sh.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={sh.modalTitle}>{editingTx ? 'Edit expense' : 'Add expense'}</Text>

          {/* Payer selector — shown for any member (registered or external) */}
          {members.length >= 1 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={sh.label}>Who paid?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {members.map((m) => {
                  // Registered members identified by user_id; external by pool_member row id
                  const payerKey = m.user_id ?? m.id;
                  const label =
                    m.display_name ??
                    (m.user_id === currentUserId ? 'You' : (m.user_id?.slice(0, 8) ?? m.id.slice(0, 8)));
                  const active = paidBy === payerKey;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.payerChip, active && s.payerChipActive]}
                      onPress={() => setPaidBy(payerKey)}
                    >
                      <Text style={[s.payerChipText, active && s.payerChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Amount display */}
          <View style={s.amountDisplay}>
            <Text style={s.amountText}>{amount || '0'}</Text>
          </View>

          {/* Description */}
          <TextInput
            placeholder="Description (optional)"
            placeholderTextColor="#64748B"
            value={description}
            onChangeText={setDescription}
            style={[sh.input, { marginTop: 8 }]}
          />

          {/* Numpad */}
          <View style={s.numpad}>
            {(['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'] as const).map(
              (key) => (
                <TouchableOpacity
                  key={key}
                  style={s.numpadKey}
                  onPress={() => appendNumpad(key)}
                >
                  <Text style={s.numpadKeyText}>{key}</Text>
                </TouchableOpacity>
              ),
            )}
          </View>

          <View style={sh.modalActions}>
            <TouchableOpacity style={sh.modalSecondary} onPress={onClose}>
              <Text style={sh.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sh.modalPrimary} onPress={() => void handleSubmit()}>
              <Text style={sh.modalPrimaryText}>{editingTx ? 'Save' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  payerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  payerChipActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#0D2818',
  },
  payerChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  payerChipTextActive: {
    color: '#53E3A6',
    fontWeight: '700',
  },
  amountDisplay: {
    backgroundColor: '#060A14',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'flex-end',
  },
  amountText: {
    color: '#EAF3FF',
    fontSize: 28,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  numpadKey: {
    width: '30.5%',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#111F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyText: {
    color: '#EAF3FF',
    fontSize: 18,
    fontWeight: '500',
  },
});
