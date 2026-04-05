import React, { useEffect, useState } from 'react';
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
import { styles } from '../../screens/DashboardScreen.styles';
import type { AppAccount } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import NumpadGrid, { ENTRY_KEYS, RATE_KEYS } from '../NumpadGrid';
import DateButton from '../DateButton';

type ActiveField = 'source' | 'rate' | 'dest';

type TransferModalProps = {
  visible: boolean;
  onClose: () => void;
  desktopView: boolean;
  accounts: AppAccount[];
  transferFromId: string | null;
  setTransferFromId: (id: string) => void;
  transferToId: string | null;
  setTransferToId: (id: string) => void;
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
  formatCurrency: (value: number, currencyOverride?: string) => string;
};

function localAppend(
  current: string,
  setter: (v: string) => void,
  key: string,
  allowMultiZero = false,
) {
  if (key === 'C') { setter(''); return; }
  if (key === '<') { setter(current.slice(0, -1)); return; }
  if (key === '.') {
    if (!current.includes('.')) setter(current ? `${current}.` : '0.');
    return;
  }
  if (key === '00') {
    if (allowMultiZero && !current.includes('.')) setter(current + '00');
    return;
  }
  if (key === '000') {
    if (allowMultiZero && !current.includes('.')) setter(current + '000');
    return;
  }
  setter(current === '0' ? key : current + key);
}

const TransferModal = React.memo(function TransferModal(props: TransferModalProps) {
  const {
    visible,
    onClose,
    desktopView,
    accounts,
    transferFromId,
    setTransferFromId,
    transferToId,
    setTransferToId,
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
  } = props;

  const fromAccount = accounts.find((a) => a.id === transferFromId) ?? null;
  const toAccount = accounts.find((a) => a.id === transferToId) ?? null;
  const crossCurrency = !!(fromAccount && toAccount && fromAccount.currency !== toAccount.currency);

  const [activeField, setActiveField] = useState<ActiveField>('source');
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);

  useEffect(() => {
    if (!crossCurrency) setActiveField('source');
  }, [crossCurrency]);

  // Close picker when modal closes
  useEffect(() => {
    if (!visible) setShowPicker(null);
  }, [visible]);

  function openPicker(target: 'from' | 'to') {
    logUI(uiPath('transfer_modal', 'form', target === 'from' ? 'from_account_button' : 'to_account_button'), 'press');
    setShowPicker(target);
  }

  function selectAccount(id: string) {
    if (showPicker === 'from') setTransferFromId(id);
    else if (showPicker === 'to') setTransferToId(id);
    setShowPicker(null);
  }

  function handleNumpad(k: string) {
    if (activeField === 'source') {
      appendNumpad(k);
    } else if (activeField === 'rate') {
      localAppend(transferRate, setTransferRate, k, false);
    } else {
      localAppend(transferTargetAmount, setTransferTargetAmount, k, true);
    }
  }

  const numpadKeys = activeField === 'rate' ? [...RATE_KEYS] : [...ENTRY_KEYS];
  const flashColor = crossCurrency
    ? (activeField === 'source' ? '#ef4444' : activeField === 'rate' ? '#a855f7' : '#22c55e')
    : '#a855f7';

  // Inline account picker overlay — rendered inside the same Modal portal
  const pickerOverlay = showPicker ? (
    <View style={pickerStyles.overlay}>
      <View style={pickerStyles.pickerHeader}>
        <Text style={pickerStyles.pickerTitle}>
          Select {showPicker === 'from' ? 'From' : 'To'} Account
        </Text>
        <TouchableOpacity onPress={() => setShowPicker(null)} hitSlop={12}>
          <Text style={pickerStyles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        {accounts.map((a) => {
          const isSelected = showPicker === 'from' ? a.id === transferFromId : a.id === transferToId;
          return (
            <TouchableOpacity
              key={a.id}
              style={[pickerStyles.item, isSelected && pickerStyles.itemSelected]}
              onPress={() => selectAccount(a.id)}
              {...uiProps(uiPath('transfer_modal', 'picker', 'account', a.id))}
            >
              <Text style={[pickerStyles.itemName, isSelected && pickerStyles.itemNameSelected]}>
                {a.name}
              </Text>
              <Text style={pickerStyles.itemCurrency}>{a.currency ?? 'USD'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  ) : null;

  const content = (
    <>
      {/* From/To toggle */}
      <View style={[styles.entryTypeRow, !desktopView && { marginHorizontal: 16 }]}>
        <TouchableOpacity
          style={[styles.toggleButton, transferFromId && styles.toggleButtonActiveExpense]}
          onPress={() => openPicker('from')}
          {...uiProps(uiPath('transfer_modal', 'form', 'from_account_button'))}
        >
          <Text style={transferFromId ? styles.toggleButtonTextExpense : styles.toggleButtonText}>
            From: {fromAccount?.name ?? 'Select'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, transferToId && styles.toggleButtonActiveIncome]}
          onPress={() => openPicker('to')}
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
        {/* Date */}
        <DateButton
          date={transferDate}
          onPress={openDatePicker}
          screen="transfer_modal"
        />

        {/* Amount row */}
        <View style={transferStyles.amountRow}>
          {/* Source amount */}
          <TouchableOpacity
            style={[
              transferStyles.amountBox,
              !crossCurrency && transferStyles.amountBoxFull,
              crossCurrency && activeField === 'source' && { borderColor: '#f87171' },
              !crossCurrency && { borderColor: '#a855f7' },
            ]}
            onPress={() => crossCurrency && setActiveField('source')}
            {...uiProps(uiPath('transfer_modal', 'form', 'source_amount'))}
          >
            <Text
              style={[
                transferStyles.amountText,
                { color: crossCurrency ? (activeField === 'source' ? '#f87171' : '#4A6280') : '#a855f7' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {transferSourceAmount || '0'}
            </Text>
            <Text style={transferStyles.currencyText}>{fromAccount?.currency ?? 'USD'}</Text>
          </TouchableOpacity>

          {/* Arrow / rate (cross-currency only) or static arrow (same-currency) */}
          {crossCurrency ? (
            <TouchableOpacity
              style={[transferStyles.arrowBox, activeField === 'rate' && { borderColor: '#a855f7' }]}
              onPress={() => setActiveField('rate')}
              {...uiProps(uiPath('transfer_modal', 'form', 'rate_box'))}
            >
              <Text style={[transferStyles.arrowText, activeField === 'rate' && { color: '#a855f7' }]}>→</Text>
              {transferRate ? (
                <Text style={transferStyles.rateText}>{transferRate}</Text>
              ) : (
                <Text style={transferStyles.ratePlaceholder}>rate</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={transferStyles.arrowBox}>
              <Text style={[transferStyles.arrowText, { color: '#a855f7' }]}>↔</Text>
            </View>
          )}

          {/* Destination amount (cross-currency only) */}
          {crossCurrency && (
            <TouchableOpacity
              style={[transferStyles.amountBox, activeField === 'dest' && { borderColor: '#4ade80' }]}
              onPress={() => setActiveField('dest')}
              {...uiProps(uiPath('transfer_modal', 'form', 'dest_amount'))}
            >
              <Text
                style={[
                  transferStyles.amountText,
                  { color: activeField === 'dest' ? '#4ade80' : '#4A6280' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {transferTargetAmount || '0'}
              </Text>
              <Text style={transferStyles.currencyText}>{toAccount?.currency ?? 'USD'}</Text>
            </TouchableOpacity>
          )}
        </View>

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

        <View style={{ flex: 1, minHeight: 8 }} />

        {/* Numpad */}
        <NumpadGrid
          keys={numpadKeys}
          onPress={handleNumpad}
          flashColor={flashColor}
          screen="transfer_modal"
        />
      </ScrollView>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType={desktopView ? 'none' : 'slide'} onRequestClose={onClose}>
      {desktopView ? (
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
            {pickerOverlay}
          </Pressable>
        </Pressable>
      ) : (
        <View style={[styles.entryModalFullscreen, { position: 'relative' }]}>
          <View style={styles.entryModalTopBar}>
            <View style={[styles.toggleButton, { flex: 0, minWidth: 110, paddingHorizontal: 20, borderColor: '#a855f7', backgroundColor: '#1e0e2a' }]}>
              <Text style={[styles.toggleButtonText, { color: '#a855f7' }]}>Transfer</Text>
            </View>
          </View>
          {content}
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
          {pickerOverlay}
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  amountBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 8,
    backgroundColor: '#0D1F31',
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 0,
  },
  amountBoxFull: {
    flex: 2,
  },
  amountText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#EAF3FF',
  },
  currencyText: {
    fontSize: 12,
    color: '#8FA8C9',
    marginTop: 2,
  },
  arrowBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D486E',
    borderRadius: 8,
    backgroundColor: '#0D1F31',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 48,
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A6280',
  },
  rateText: {
    fontSize: 11,
    color: '#a855f7',
    marginTop: 2,
  },
  ratePlaceholder: {
    fontSize: 11,
    color: '#4A6280',
    marginTop: 2,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#060A14',
    zIndex: 999,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2F49',
  },
  pickerTitle: {
    color: '#EAF3FF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    color: '#8FA8C9',
    fontSize: 18,
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111D2E',
  },
  itemSelected: {
    backgroundColor: '#0D1F31',
  },
  itemName: {
    color: '#C2D8F0',
    fontSize: 15,
    fontWeight: '500',
  },
  itemNameSelected: {
    color: '#a855f7',
    fontWeight: '700',
  },
  itemCurrency: {
    color: '#4A6280',
    fontSize: 13,
  },
});

export default TransferModal;
