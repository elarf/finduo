import React, { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ModalShell } from '../components/ModalShell';
import { styles } from './DashboardScreen.styles';
import { useDashboard } from '../context/DashboardContext';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import NumpadGrid, { ENTRY_KEYS, RATE_KEYS } from '../components/NumpadGrid';
import DateButton from '../components/DateButton';

type ActiveField = 'source' | 'rate' | 'dest';

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

export default function TransferScreen() {
  const navigation = useNavigation();
  const {
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
    transferAppendNumpad,
    openDatePicker,
    saving,
    saveTransfer,
  } = useDashboard();

  const fromAccount = accounts.find((a) => a.id === transferFromId) ?? null;
  const toAccount = accounts.find((a) => a.id === transferToId) ?? null;
  const crossCurrency = !!(fromAccount && toAccount && fromAccount.currency !== toAccount.currency);

  const [activeField, setActiveField] = useState<ActiveField>('source');
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 1024;

  useEffect(() => {
    if (!crossCurrency) setActiveField('source');
  }, [crossCurrency]);

  const handleClose = () => navigation.goBack();

  const handleSave = async () => {
    await saveTransfer();
    navigation.goBack();
  };

  function openPicker(target: 'from' | 'to') {
    logUI(uiPath('transfer_screen', 'form', target === 'from' ? 'from_account_button' : 'to_account_button'), 'press');
    setShowPicker(target);
  }

  function selectAccount(id: string) {
    if (showPicker === 'from') setTransferFromId(id);
    else if (showPicker === 'to') setTransferToId(id);
    setShowPicker(null);
  }

  function handleNumpad(k: string) {
    if (activeField === 'source') {
      transferAppendNumpad(k);
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

  // Inline account picker overlay
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
              {...uiProps(uiPath('transfer_screen', 'picker', 'account', a.id))}
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

  return (
    <ModalShell onDismiss={handleClose} maxWidth={390} fullscreen={!isWide}>
      <View {...uiProps(uiPath('transfer_screen', 'card', 'container'))} style={styles.entryModalFullscreen}>
        {/* Top bar */}
        <View style={styles.entryModalTopBar}>
          <View style={[styles.toggleButton, { flex: 0, minWidth: 110, paddingHorizontal: 20, borderColor: '#a855f7', backgroundColor: '#1e0e2a' }]}>
            <Text style={[styles.toggleButtonText, { color: '#a855f7' }]}>Transfer</Text>
          </View>
        </View>

        {/* From/To toggle */}
        <View style={[styles.entryTypeRow, !isWide && { marginHorizontal: 16 }]}>
          <TouchableOpacity
            style={[styles.toggleButton, transferFromId && styles.toggleButtonActiveExpense]}
            onPress={() => openPicker('from')}
            {...uiProps(uiPath('transfer_screen', 'form', 'from_account_button'))}
          >
            <Text style={transferFromId ? styles.toggleButtonTextExpense : styles.toggleButtonText}>
              From: {fromAccount?.name ?? 'Select'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, transferToId && styles.toggleButtonActiveIncome]}
            onPress={() => openPicker('to')}
            {...uiProps(uiPath('transfer_screen', 'form', 'to_account_button'))}
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
            screen="transfer_screen"
            component="date_picker"
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
              {...uiProps(uiPath('transfer_screen', 'form', 'source_amount'))}
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
                {...uiProps(uiPath('transfer_screen', 'form', 'rate_box'))}
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
                {...uiProps(uiPath('transfer_screen', 'form', 'dest_amount'))}
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
            {...uiProps(uiPath('transfer_screen', 'form', 'note_input'))}
          />

          <View style={{ flex: 1, minHeight: 8 }} />

          {/* Numpad */}
          <NumpadGrid
            keys={numpadKeys}
            onPress={handleNumpad}
            flashColor={flashColor}
            screen="transfer_screen"
          />
        </ScrollView>

        {/* Bottom bar */}
        <View style={transferStyles.bottomBar}>
          <TouchableOpacity
            style={transferStyles.cancelBtn}
            onPress={() => { logUI(uiPath('transfer_screen', 'actions', 'cancel_button'), 'press'); handleClose(); }}
            {...uiProps(uiPath('transfer_screen', 'actions', 'cancel_button'))}
          >
            <Text style={transferStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={transferStyles.saveBtnContainer}
            onPress={() => { logUI(uiPath('transfer_screen', 'actions', 'transfer_button'), 'press'); void handleSave(); }}
            disabled={saving}
            {...uiProps(uiPath('transfer_screen', 'actions', 'transfer_button'))}
          >
            <LinearGradient
              colors={['#14b8a6', '#3b82f6', '#a855f7']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={transferStyles.saveBtn}
            >
              <Text style={transferStyles.saveText}>{saving ? 'Saving...' : 'Transfer'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {pickerOverlay}
      </View>
    </ModalShell>
  );
}

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
  saveBtnContainer: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveBtn: {
    flex: 1,
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
