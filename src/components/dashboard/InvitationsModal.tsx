import React from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../Icon';
import { styles } from '../../screens/DashboardScreen.styles';
import { AppAccount, ManagedInvite, formatShortDate } from '../../types/dashboard';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type InvitationsModalProps = {
  visible: boolean;
  onClose: () => void;
  desktopView: boolean;
  accounts: AppAccount[];
  invitationAccountId: string | null;
  setInvitationAccountId: (id: string) => void;
  loadManagedInvites: (accountId: string) => void;
  openAcctPickerSheet: (target: 'invite') => void;
  // Form
  inviteName: string;
  setInviteName: (v: string) => void;
  inviteExpiresDays: string;
  setInviteExpiresDays: (v: string) => void;
  editingInviteId: string | null;
  setEditingInviteId: (v: string | null) => void;
  managedInvites: ManagedInvite[];
  // Join
  joinToken: string;
  setJoinToken: (v: string) => void;
  // Callbacks
  saveInviteToken: () => Promise<void>;
  removeInviteToken: (id: string) => Promise<void>;
  joinByToken: () => Promise<void>;
  shareInvite: (token: string) => Promise<void>;
  saving: boolean;
};

const InvitationsModal: React.FC<InvitationsModalProps> = ({
  visible,
  onClose,
  desktopView,
  accounts,
  invitationAccountId,
  setInvitationAccountId,
  loadManagedInvites,
  openAcctPickerSheet,
  inviteName,
  setInviteName,
  inviteExpiresDays,
  setInviteExpiresDays,
  editingInviteId,
  setEditingInviteId,
  managedInvites,
  joinToken,
  setJoinToken,
  saveInviteToken,
  removeInviteToken,
  joinByToken,
  shareInvite,
  saving,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => { logUI(uiPath('invitations_modal', 'modal', 'backdrop'), 'press'); onClose(); }}
        {...uiProps(uiPath('invitations_modal', 'modal', 'backdrop'))}
      >
        <Pressable
          style={styles.modalCard}
          onPress={(event) => { logUI(uiPath('invitations_modal', 'modal', 'card'), 'press'); event.stopPropagation(); }}
          {...uiProps(uiPath('invitations_modal', 'modal', 'card'))}
        >
          <Text style={styles.modalTitle} {...uiProps(uiPath('invitations_modal', 'modal', 'title'))}>
            Invitations
          </Text>

          <Text style={styles.modalLabel}>Account</Text>
          {desktopView ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.modalChip, invitationAccountId === account.id && styles.modalChipActive]}
                  onPress={() => {
                    logUI(uiPath('invitations_modal', 'form', 'account_chip', account.id), 'press');
                    setInvitationAccountId(account.id);
                    void loadManagedInvites(account.id);
                  }}
                  {...uiProps(uiPath('invitations_modal', 'form', 'account_chip', account.id))}
                >
                  <Text style={styles.modalChipText}>{account.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={[styles.entryAccountBtn, styles.entryAccountBtnFull]}
              onPress={() => { logUI(uiPath('invitations_modal', 'form', 'account_chip', invitationAccountId ?? 'none'), 'press'); openAcctPickerSheet('invite'); }}
              {...uiProps(uiPath('invitations_modal', 'form', 'account_chip', invitationAccountId ?? 'none'))}
            >
              <Text style={styles.entryAccountBtnText}>
                {accounts.find((a) => a.id === invitationAccountId)?.name ?? 'Select account'}
              </Text>
              <Icon name="expand_more" size={16} color="#8FA8C9" />
            </TouchableOpacity>
          )}

          <TextInput
            placeholder="Invite name"
            placeholderTextColor="#64748B"
            value={inviteName}
            onChangeText={setInviteName}
            style={styles.input}
            {...uiProps(uiPath('invitations_modal', 'form', 'name_input'))}
          />
          <TextInput
            placeholder="Expire in days (default 7)"
            placeholderTextColor="#64748B"
            keyboardType="number-pad"
            value={inviteExpiresDays}
            onChangeText={setInviteExpiresDays}
            style={styles.input}
            {...uiProps(uiPath('invitations_modal', 'form', 'expire_input'))}
          />

          <View style={styles.modalActions}>
            {editingInviteId && (
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => {
                  setEditingInviteId(null);
                  setInviteName('');
                  setInviteExpiresDays('7');
                }}
              >
                <Text style={styles.modalSecondaryText}>Clear Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => { logUI(uiPath('invitations_modal', 'actions', 'create_button'), 'press'); void saveInviteToken(); }}
              disabled={saving}
              {...uiProps(uiPath('invitations_modal', 'actions', 'create_button'))}
            >
              <Text style={styles.modalPrimaryText}>{editingInviteId ? 'Save Token' : 'Create Token'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Existing tokens</Text>
          <ScrollView style={{ maxHeight: 210 }}>
            {managedInvites.length === 0 ? (
              <Text style={styles.emptyText}>No invitations for this account.</Text>
            ) : managedInvites.map((invite, index) => (
              <View key={invite.id} style={styles.manageRow} {...uiProps(uiPath('invitations_modal', 'tokens', 'token_row', String(index)))}>
                <View style={styles.managePrimary}>
                  <Text style={styles.manageTitle}>{invite.name || 'Invite token'}</Text>
                  <Text style={styles.manageMeta}>{invite.token}</Text>
                  <Text style={styles.manageMeta}>
                    {invite.used_at ? 'Used by another user' : 'Available'} • Expires {formatShortDate(invite.expires_at)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.manageIconButton}
                  onPress={() => { logUI(uiPath('invitations_modal', 'tokens', 'share_button', String(index)), 'press'); void shareInvite(invite.token); }}
                  {...uiProps(uiPath('invitations_modal', 'tokens', 'share_button', String(index)))}
                >
                  <Icon name="share" size={16} color="#8FA8C9" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manageIconButton}
                  onPress={() => {
                    logUI(uiPath('invitations_modal', 'tokens', 'edit_button', String(index)), 'press');
                    setEditingInviteId(invite.id);
                    setInviteName(invite.name || 'Invite token');
                    const msLeft = new Date(invite.expires_at).getTime() - Date.now();
                    const days = Math.max(1, Math.ceil(msLeft / 86400000));
                    setInviteExpiresDays(String(days));
                  }}
                  {...uiProps(uiPath('invitations_modal', 'tokens', 'edit_button', String(index)))}
                >
                  <Text style={styles.manageIconText}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manageIconButtonDanger}
                  onPress={() => {
                    logUI(uiPath('invitations_modal', 'tokens', 'remove_button', String(index)), 'press');
                    Alert.alert('Remove token', 'Delete this invitation token?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => void removeInviteToken(invite.id) },
                    ]);
                  }}
                  {...uiProps(uiPath('invitations_modal', 'tokens', 'remove_button', String(index)))}
                >
                  <Text style={styles.manageIconText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.modalLabel}>Join with token</Text>
          <TextInput
            placeholder="Paste token"
            placeholderTextColor="#64748B"
            value={joinToken}
            onChangeText={setJoinToken}
            style={styles.input}
            {...uiProps(uiPath('invitations_modal', 'join', 'token_input'))}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => { logUI(uiPath('invitations_modal', 'actions', 'close_button'), 'press'); onClose(); }}
              {...uiProps(uiPath('invitations_modal', 'actions', 'close_button'))}
            >
              <Text style={styles.modalSecondaryText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => { logUI(uiPath('invitations_modal', 'join', 'join_button'), 'press'); void joinByToken(); }}
              disabled={saving}
              {...uiProps(uiPath('invitations_modal', 'join', 'join_button'))}
            >
              <Text style={styles.modalPrimaryText}>Join</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default React.memo(InvitationsModal);
