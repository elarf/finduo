import React, { useEffect } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from '../components/Icon';
import { ModalShell } from '../components/ModalShell';
import { styles } from './DashboardScreen.styles';
import { CURRENCY_OPTIONS } from '../types/dashboard';
import { uiPath, uiProps, logUI } from '../lib/devtools';
import { useDashboard } from '../context/DashboardContext';
import type { RootStackParamList } from '../navigation';

type AccountScreenRouteProp = RouteProp<RootStackParamList, 'Account'>;

export default function AccountScreen() {
  const navigation = useNavigation();
  const route = useRoute<AccountScreenRouteProp>();
  const { accountId } = route.params || {};

  const {
    newAccountName, setNewAccountName,
    newAccountIcon, setNewAccountIcon,
    newAccountCurrency, setNewAccountCurrency,
    settingsIncluded, setSettingsIncluded,
    settingsCarryOver, setSettingsCarryOver,
    settingsInitialBalance, setSettingsInitialBalance,
    settingsInitialDate, setSettingsInitialDate,
    accountTagIds, setAccountTagIds,
    tags,
    saveAccount,
    deleteAccount,
    openIconPickerSheet,
    saving,
    user,
    accounts,
    accountSettings,
  } = useDashboard();

  const editingAccountId = accountId ?? null;
  const currentAccount = editingAccountId ? accounts.find((a) => a.id === editingAccountId) : null;

  // Initialize form state when editing
  useEffect(() => {
    if (editingAccountId && currentAccount) {
      const settings = accountSettings[editingAccountId];
      setNewAccountName(currentAccount.name);
      setNewAccountCurrency(currentAccount.currency);
      setNewAccountIcon(currentAccount.icon ?? null);
      setSettingsIncluded(settings?.included_in_balance ?? true);
      setSettingsCarryOver(settings?.carry_over_balance ?? true);
      setSettingsInitialBalance(String(settings?.initial_balance ?? 0));
      setSettingsInitialDate(settings?.initial_balance_date ?? currentAccount.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
      setAccountTagIds((currentAccount.tag_ids ?? []) as string[]);
    } else {
      setNewAccountName('');
      setNewAccountCurrency('USD');
      setNewAccountIcon(null);
      setSettingsIncluded(true);
      setSettingsCarryOver(true);
      setSettingsInitialBalance('0');
      setSettingsInitialDate(new Date().toISOString().slice(0, 10));
      setAccountTagIds([]);
    }
  }, [editingAccountId, currentAccount, accountSettings, setNewAccountName, setNewAccountCurrency, setNewAccountIcon, setSettingsIncluded, setSettingsCarryOver, setSettingsInitialBalance, setSettingsInitialDate, setAccountTagIds]);

  const handleClose = () => navigation.goBack();

  const handleSave = async () => {
    await saveAccount(accountId);
    navigation.goBack();
  };

  const handleDelete = async () => {
    if (currentAccount) {
      await deleteAccount(currentAccount);
      navigation.goBack();
    }
  };

  return (
    <ModalShell onDismiss={handleClose} maxWidth={440}>
      <View style={styles.modalCard} {...uiProps(uiPath('account_screen', 'modal', 'card'))}>
        <Text style={styles.modalTitle} {...uiProps(uiPath('account_screen', 'modal', 'title'))}>
          {editingAccountId ? 'Edit account' : 'Create account'}
        </Text>
          <TextInput
            placeholder="Account name"
            placeholderTextColor="#64748B"
            value={newAccountName}
            onChangeText={setNewAccountName}
            style={styles.input}
            {...uiProps(uiPath('account_screen', 'form', 'name_input'))}
          />
          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.iconPickerRow}>
            <TouchableOpacity
              style={[styles.iconPickerPreview, newAccountIcon ? { borderColor: '#53E3A6' } : undefined]}
              onPress={() => { logUI(uiPath('account_screen', 'form', 'icon_picker_button'), 'press'); openIconPickerSheet('account'); }}
              {...uiProps(uiPath('account_screen', 'form', 'icon_picker_button'))}
            >
              {newAccountIcon ? (
                <Icon name={newAccountIcon} size={24} color="#EAF3FF" />
              ) : (
                <Icon name="House" size={24} color="#64748B" />
              )}
              <Icon name="expand_more" size={16} color="#64748B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            {newAccountIcon && (
              <TouchableOpacity onPress={() => setNewAccountIcon(null)}>
                <Text style={styles.linkAction}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.modalLabel}>Currency</Text>
          <View style={styles.currencyGrid}>
            {CURRENCY_OPTIONS.map((code) => (
              <TouchableOpacity
                key={code}
                style={[styles.currencyOption, newAccountCurrency === code && styles.currencyOptionActive]}
                onPress={() => { logUI(uiPath('account_screen', 'form', 'currency_chip', code), 'press'); setNewAccountCurrency(code); }}
                {...uiProps(uiPath('account_screen', 'form', 'currency_chip', code))}
              >
                <Text style={styles.currencyOptionText}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Included in balance</Text>
          <View style={styles.toggleRowCompact}>
            <TouchableOpacity
              style={[styles.modalChip, settingsIncluded && styles.modalChipActive]}
              onPress={() => { logUI(uiPath('account_screen', 'include_toggle', 'yes'), 'press'); setSettingsIncluded(true); }}
              {...uiProps(uiPath('account_screen', 'include_toggle', 'yes'))}
            >
              <Text style={styles.modalChipText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalChip, !settingsIncluded && styles.modalChipActive]}
              onPress={() => { logUI(uiPath('account_screen', 'include_toggle', 'no'), 'press'); setSettingsIncluded(false); }}
              {...uiProps(uiPath('account_screen', 'include_toggle', 'no'))}
            >
              <Text style={styles.modalChipText}>No</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Carry balance over interval</Text>
          <View style={styles.toggleRowCompact}>
            <TouchableOpacity
              style={[styles.modalChip, settingsCarryOver && styles.modalChipActive]}
              onPress={() => { logUI(uiPath('account_screen', 'carry_over_toggle', 'yes'), 'press'); setSettingsCarryOver(true); }}
              {...uiProps(uiPath('account_screen', 'carry_over_toggle', 'yes'))}
            >
              <Text style={styles.modalChipText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalChip, !settingsCarryOver && styles.modalChipActive]}
              onPress={() => { logUI(uiPath('account_screen', 'carry_over_toggle', 'no'), 'press'); setSettingsCarryOver(false); }}
              {...uiProps(uiPath('account_screen', 'carry_over_toggle', 'no'))}
            >
              <Text style={styles.modalChipText}>No</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Initial account balance"
            placeholderTextColor="#64748B"
            keyboardType="decimal-pad"
            value={settingsInitialBalance}
            onChangeText={setSettingsInitialBalance}
            style={styles.input}
            {...uiProps(uiPath('account_screen', 'form', 'balance_input'))}
          />
          <TextInput
            placeholder="Initial balance date (YYYY-MM-DD)"
            placeholderTextColor="#64748B"
            value={settingsInitialDate}
            onChangeText={setSettingsInitialDate}
            style={styles.input}
          />

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <Text style={styles.modalLabel}>Tags</Text>
              <View style={styles.menuChipWrap}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.modalChip,
                      accountTagIds.includes(tag.id) && styles.modalChipActive,
                      tag.color ? { borderColor: tag.color } : undefined,
                    ]}
                    onPress={() => {
                      logUI(uiPath('account_screen', 'form', 'tag_chip', tag.id), 'press');
                      setAccountTagIds((prev) =>
                        prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                      );
                    }}
                    {...uiProps(uiPath('account_screen', 'form', 'tag_chip', tag.id))}
                  >
                    <Text style={[styles.modalChipText, tag.color && accountTagIds.includes(tag.id) ? { color: tag.color } : undefined]}>
                      #{tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            {editingAccountId && currentAccount && currentAccount.created_by === user?.id && (
              <TouchableOpacity
                style={styles.modalDanger}
                onPress={() => {
                  logUI(uiPath('account_screen', 'actions', 'remove_button'), 'press');
                  Alert.alert('Remove account', `Remove ${currentAccount.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        void handleDelete();
                      },
                    },
                  ]);
                }}
                {...uiProps(uiPath('account_screen', 'actions', 'remove_button'))}
              >
                <Text style={styles.modalDangerText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => { logUI(uiPath('account_screen', 'actions', 'cancel_button'), 'press'); handleClose(); }}
              {...uiProps(uiPath('account_screen', 'actions', 'cancel_button'))}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => { logUI(uiPath('account_screen', 'actions', 'save_button'), 'press'); void handleSave(); }}
              disabled={saving}
              {...uiProps(uiPath('account_screen', 'actions', 'save_button'))}
            >
              <Text style={styles.modalPrimaryText}>{editingAccountId ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
    </ModalShell>
  );
}
