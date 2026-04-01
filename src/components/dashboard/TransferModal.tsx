import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import type { AppAccount } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type TransferModalProps = {
  visible: boolean;
  onClose: () => void;
  desktopView: boolean;
  accounts: AppAccount[];
  transferFromId: string | null;
  transferToId: string | null;
  transferSourceAmount: string;
  transferRate: string;
  setTransferRate: (v: string) => void;
  transferTargetAmount: string;
  setTransferTargetAmount: (v: string) => void;
  transferDate: string;
  transferNote: string;
  setTransferNote: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  appendNumpad: (key: string) => void;
  openDatePicker: () => void;
  openAcctPickerSheet: (target: 'transfer-from' | 'transfer-to') => void;
  formatCurrency: (value: number, currencyOverride?: string) => string;
};

const TransferModal = React.memo(function TransferModal(props: TransferModalProps) {
  const {
    visible,
    onClose,
    desktopView,
    accounts,
    transferFromId,
    transferToId,
    transferSourceAmount,
    transferRate,
    setTransferRate,
    transferTargetAmount,
    setTransferTargetAmount,
    transferDate,
    transferNote,
    setTransferNote,
    onSave,
    saving,
    appendNumpad,
    openDatePicker,
    openAcctPickerSheet,
    formatCurrency,
  } = props;

  const fromAccount = accounts.find((a) => a.id === transferFromId) ?? null;
  const toAccount = accounts.find((a) => a.id === transferToId) ?? null;
  const crossCurrency = !!(fromAccount && toAccount && fromAccount.currency !== toAccount.currency);

  const content = (
    <>
      {/* From/To toggle */}
      <View style={[styles.entryTypeRow, !desktopView && { marginHorizontal: 16 }]}>
        <TouchableOpacity
          style={[styles.toggleButton, transferFromId && styles.toggleButtonActiveExpense]}
          onPress={() => { logUI(uiPath('transfer_modal', 'form', 'from_account_button'), 'press'); openAcctPickerSheet('transfer-from'); }}
          {...uiProps(uiPath('transfer_modal', 'form', 'from_account_button'))}
        >
          <Text style={transferFromId ? styles.toggleButtonTextExpense : styles.toggleButtonText}>
            From: {fromAccount?.name ?? 'Select'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, transferToId && styles.toggleButtonActiveIncome]}
          onPress={() => { logUI(uiPath('transfer_modal', 'form', 'to_account_button'), 'press'); openAcctPickerSheet('transfer-to'); }}
          {...uiProps(uiPath('transfer_modal', 'form', 'to_account_button'))}
        >
          <Text style={transferToId ? styles.toggleButtonTextIncome : styles.toggleButtonText}>
            To: {toAccount?.name ?? 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.entryModalScrollContent, { flexGrow: 1 }]}
      >
        {/* Date picker */}
        <TouchableOpacity
          style={styles.datePressable}
          onPress={() => { logUI(uiPath('transfer_modal', 'form', 'date_button'), 'press'); openDatePicker(); }}
          {...uiProps(uiPath('transfer_modal', 'form', 'date_button'))}
        >
          <Icon name="calendar" size={18} color="#8FA8C9" />
          <Text style={styles.datePressableText}>{transferDate || 'Select date'}</Text>
        </TouchableOpacity>

        {/* Amount display */}
        <View style={styles.entryAmountDisplay} {...uiProps(uiPath('transfer_modal', 'form', 'amount_display'))}>
          <Text style={[styles.entryAmountDisplayText, { color: '#a855f7' }]} {...uiProps(uiPath('transfer_modal', 'form', 'amount_text'))}>
            {transferSourceAmount || '0'}
          </Text>
        </View>
        <Text style={styles.entryCurrencyText}>{fromAccount?.currency ?? 'USD'}</Text>

        {/* Cross-currency fields */}
        {crossCurrency && (
          <View style={{ marginTop: 8, gap: 6 }}>
            <TextInput
              placeholder={`Exchange rate (${fromAccount?.currency} → ${toAccount?.currency})`}
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              value={transferRate}
              onChangeText={setTransferRate}
              style={styles.input}
              {...uiProps(uiPath('transfer_modal', 'form', 'exchange_rate_input'))}
            />
            <TextInput
              placeholder={`Destination amount (${toAccount?.currency})`}
              placeholderTextColor="#64748B"
              keyboardType="decimal-pad"
              value={transferTargetAmount}
              onChangeText={setTransferTargetAmount}
              style={styles.input}
              {...uiProps(uiPath('transfer_modal', 'form', 'destination_input'))}
            />
          </View>
        )}

        {/* Note */}
        <TextInput
          value={transferNote}
          onChangeText={setTransferNote}
          placeholder="Note (optional)"
          placeholderTextColor="#64748B"
          style={styles.input}
          returnKeyType="done"
          {...uiProps(uiPath('transfer_modal', 'form', 'note_input'))}
        />

        {/* Spacer to push numpad to bottom */}
        <View style={{ flex: 1, minHeight: 8 }} />

        {/* Numpad */}
        <View style={styles.numpadGrid} {...uiProps(uiPath('transfer_modal', 'numpad', 'container'))}>
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '<'].map((k) => (
            <TouchableOpacity
              key={k}
              style={styles.numpadKey}
              onPress={() => { logUI(uiPath('transfer_modal', 'numpad', 'key', k), 'press'); appendNumpad(k); }}
              {...uiProps(uiPath('transfer_modal', 'numpad', 'key', k))}
            >
              <Text style={styles.numpadKeyText}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType={desktopView ? 'none' : 'slide'} onRequestClose={onClose}>
      {desktopView ? (
        /* Desktop: card modal */
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => { logUI(uiPath('transfer_modal', 'modal', 'backdrop'), 'press'); onClose(); }}
          {...uiProps(uiPath('transfer_modal', 'modal', 'backdrop'))}
        >
          <Pressable
            style={[styles.modalCard, styles.entryModalCard]}
            onPress={(e) => { logUI(uiPath('transfer_modal', 'modal', 'card'), 'press'); e.stopPropagation(); }}
            {...uiProps(uiPath('transfer_modal', 'modal', 'card'))}
          >
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={[styles.toggleButton, { flex: 0, minWidth: 110, paddingHorizontal: 20, borderColor: '#a855f7', backgroundColor: '#1e0e2a' }]}>
                <Text style={[styles.toggleButtonText, { color: '#a855f7' }]}>Transfer</Text>
              </View>
            </View>
            {content}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => { logUI(uiPath('transfer_modal', 'actions', 'cancel_button'), 'press'); onClose(); }}
                {...uiProps(uiPath('transfer_modal', 'actions', 'cancel_button'))}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimary, { backgroundColor: '#a855f7' }]}
                onPress={() => { logUI(uiPath('transfer_modal', 'actions', 'transfer_button'), 'press'); onSave(); }}
                disabled={saving}
                {...uiProps(uiPath('transfer_modal', 'actions', 'transfer_button'))}
              >
                <Text style={styles.modalPrimaryText}>Transfer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      ) : (
        /* Mobile: full-screen */
        <View style={styles.entryModalFullscreen}>
          {/* Top bar */}
          <View style={styles.entryModalTopBar}>
            <View style={[styles.toggleButton, { flex: 0, minWidth: 110, paddingHorizontal: 20, borderColor: '#a855f7', backgroundColor: '#1e0e2a' }]}>
              <Text style={[styles.toggleButtonText, { color: '#a855f7' }]}>Transfer</Text>
            </View>
          </View>
          {content}
          {/* Bottom bar */}
          <View style={transferStyles.bottomBar}>
            <TouchableOpacity
              style={transferStyles.cancelBtn}
              onPress={() => { logUI(uiPath('transfer_modal', 'actions', 'cancel_button'), 'press'); onClose(); }}
              {...uiProps(uiPath('transfer_modal', 'actions', 'cancel_button'))}
            >
              <Text style={transferStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={transferStyles.saveBtn}
              onPress={() => { logUI(uiPath('transfer_modal', 'actions', 'transfer_button'), 'press'); onSave(); }}
              disabled={saving}
              {...uiProps(uiPath('transfer_modal', 'actions', 'transfer_button'))}
            >
              <Text style={transferStyles.saveText}>{saving ? 'Saving...' : 'Transfer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
});

const transferStyles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#060A14',
    borderTopWidth: 1,
    borderTopColor: '#1E2F49',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#13253B',
    borderWidth: 1,
    borderColor: '#2C4669',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    color: '#8FA8C9',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#a855f7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default TransferModal;
