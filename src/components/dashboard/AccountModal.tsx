import React from 'react';
import { Alert, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppAccount, AppTag, CURRENCY_OPTIONS } from '../../types/dashboard';
import type { User } from '@supabase/supabase-js';

type AccountModalProps = {
  visible: boolean;
  onClose: () => void;
  editingAccountId: string | null;
  editingAccount: AppAccount | null;
  user: User | null;
  // Form state
  newAccountName: string;
  setNewAccountName: (v: string) => void;
  newAccountIcon: string | null;
  setNewAccountIcon: (v: string | null) => void;
  newAccountCurrency: string;
  setNewAccountCurrency: (v: string) => void;
  settingsIncluded: boolean;
  setSettingsIncluded: (v: boolean) => void;
  settingsCarryOver: boolean;
  setSettingsCarryOver: (v: boolean) => void;
  settingsInitialBalance: string;
  setSettingsInitialBalance: (v: string) => void;
  settingsInitialDate: string;
  setSettingsInitialDate: (v: string) => void;
  accountTagIds: string[];
  setAccountTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  tags: AppTag[];
  // Callbacks
  onSave: () => void;
  onDelete: (account: AppAccount) => void;
  openIconPickerSheet: (target: 'account') => void;
  saving: boolean;
};

function AccountModal({
  visible, onClose, editingAccountId, editingAccount, user,
  newAccountName, setNewAccountName,
  newAccountIcon, setNewAccountIcon,
  newAccountCurrency, setNewAccountCurrency,
  settingsIncluded, setSettingsIncluded,
  settingsCarryOver, setSettingsCarryOver,
  settingsInitialBalance, setSettingsInitialBalance,
  settingsInitialDate, setSettingsInitialDate,
  accountTagIds, setAccountTagIds, tags,
  onSave, onDelete, openIconPickerSheet, saving,
}: AccountModalProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{editingAccountId ? 'Edit account' : 'Create account'}</Text>
          <TextInput
            placeholder="Account name"
            placeholderTextColor="#64748B"
            value={newAccountName}
            onChangeText={setNewAccountName}
            style={styles.input}
          />
          <Text style={styles.modalLabel}>Icon</Text>
          <View style={styles.iconPickerRow}>
            <TouchableOpacity
              style={[styles.iconPickerPreview, newAccountIcon ? { borderColor: '#53E3A6' } : undefined]}
              onPress={() => openIconPickerSheet('account')}
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
                onPress={() => setNewAccountCurrency(code)}
              >
                <Text style={styles.currencyOptionText}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Included in balance</Text>
          <View style={styles.toggleRowCompact}>
            <TouchableOpacity
              style={[styles.modalChip, settingsIncluded && styles.modalChipActive]}
              onPress={() => setSettingsIncluded(true)}
            >
              <Text style={styles.modalChipText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalChip, !settingsIncluded && styles.modalChipActive]}
              onPress={() => setSettingsIncluded(false)}
            >
              <Text style={styles.modalChipText}>No</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Carry balance over interval</Text>
          <View style={styles.toggleRowCompact}>
            <TouchableOpacity
              style={[styles.modalChip, settingsCarryOver && styles.modalChipActive]}
              onPress={() => setSettingsCarryOver(true)}
            >
              <Text style={styles.modalChipText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalChip, !settingsCarryOver && styles.modalChipActive]}
              onPress={() => setSettingsCarryOver(false)}
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
                    onPress={() => setAccountTagIds((prev) =>
                      prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                    )}
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
            {editingAccountId && editingAccount && editingAccount.created_by === user?.id && (
              <TouchableOpacity
                style={styles.modalDanger}
                onPress={() => {
                  Alert.alert('Remove account', `Remove ${editingAccount.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        void onDelete(editingAccount);
                      },
                    },
                  ]);
                }}
              >
                <Text style={styles.modalDangerText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimary} onPress={onSave} disabled={saving}>
              <Text style={styles.modalPrimaryText}>{editingAccountId ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(AccountModal);
