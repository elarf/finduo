import React from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../screens/DashboardScreen.styles';
import type { AppAccount } from '../../types/dashboard';

type TransferModalProps = {
  visible: boolean;
  onClose: () => void;
  accounts: AppAccount[];
  transferFromId: string | null;
  setTransferFromId: (id: string) => void;
  transferToId: string | null;
  setTransferToId: (id: string) => void;
  transferSourceAmount: string;
  setTransferSourceAmount: (v: string) => void;
  transferRate: string;
  setTransferRate: (v: string) => void;
  transferTargetAmount: string;
  setTransferTargetAmount: (v: string) => void;
  transferDate: string;
  setTransferDate: (v: string) => void;
  transferNote: string;
  setTransferNote: (v: string) => void;
  onSave: () => void;
  saving: boolean;
};

const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onClose,
  accounts,
  transferFromId,
  setTransferFromId,
  transferToId,
  setTransferToId,
  transferSourceAmount,
  setTransferSourceAmount,
  transferRate,
  setTransferRate,
  transferTargetAmount,
  setTransferTargetAmount,
  transferDate,
  setTransferDate,
  transferNote,
  setTransferNote,
  onSave,
  saving,
}) => (
  <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
        <Text style={styles.modalTitle}>Transfer Between Accounts</Text>

        <Text style={styles.modalLabel}>From account</Text>
        <View style={styles.currencyGrid}>
          {accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[styles.currencyOption, transferFromId === a.id && styles.currencyOptionActive]}
              onPress={() => setTransferFromId(a.id)}
            >
              <Text style={styles.currencyOptionText}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalLabel}>To account</Text>
        <View style={styles.currencyGrid}>
          {accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[styles.currencyOption, transferToId === a.id && styles.currencyOptionActive]}
              onPress={() => setTransferToId(a.id)}
            >
              <Text style={styles.currencyOptionText}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput placeholder="Source amount" placeholderTextColor="#64748B" keyboardType="decimal-pad" value={transferSourceAmount} onChangeText={setTransferSourceAmount} style={styles.input} />
        <TextInput placeholder="Exchange rate (optional)" placeholderTextColor="#64748B" keyboardType="decimal-pad" value={transferRate} onChangeText={setTransferRate} style={styles.input} />
        <TextInput placeholder="Destination amount (optional if rate given)" placeholderTextColor="#64748B" keyboardType="decimal-pad" value={transferTargetAmount} onChangeText={setTransferTargetAmount} style={styles.input} />
        <TextInput placeholder="Transfer date (YYYY-MM-DD)" placeholderTextColor="#64748B" value={transferDate} onChangeText={setTransferDate} style={styles.input} />
        <TextInput placeholder="Transfer note (optional)" placeholderTextColor="#64748B" value={transferNote} onChangeText={setTransferNote} style={styles.input} />

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
            <Text style={styles.modalSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalPrimary} onPress={onSave} disabled={saving}>
            <Text style={styles.modalPrimaryText}>Save Transfer</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

export default React.memo(TransferModal);
