import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from '../components/Icon';
import { ModalShell } from '../components/ModalShell';
import { styles } from './DashboardScreen.styles';
import { formatShortDate } from '../types/dashboard';
import { useDashboard } from '../context/DashboardContext';
import { uiPath, uiProps, logUI } from '../lib/devtools';

export default function InvitationsScreen() {
  const navigation = useNavigation();
  const {
    accounts,
    invitationAccountId,
    setInvitationAccountId,
    loadManagedInvites,
    openAcctPickerSheet,
    inviteName,
    setInviteName,
    inviteExpiresDays,
    setInviteExpiresDays,
    managedInvites,
    joinToken,
    setJoinToken,
    saveInviteToken,
    removeInviteToken,
    joinByToken,
    shareInvite,
    saving,
  } = useDashboard();

  const [editingInviteId, setEditingInviteId] = useState<string | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 1024;

  useEffect(() => {
    logUI(uiPath('invitations_screen', 'modal', 'container'), 'mount');
  }, []);

  const handleClose = () => navigation.goBack();

  return (
    <ModalShell onDismiss={handleClose} maxWidth={400} fullscreen={false}>
      <View style={[styles.modalCard, { padding: 20 }]}>
        <Text style={styles.modalTitle} {...uiProps(uiPath('invitations_screen', 'modal', 'title'))}>
          Invitations
        </Text>

        <Text style={styles.modalLabel}>Account</Text>
        {isWide ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipsRow}>
            {accounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[styles.modalChip, invitationAccountId === account.id && styles.modalChipActive]}
                onPress={() => {
                  logUI(uiPath('invitations_screen', 'form', 'account_chip', account.id), 'press');
                  setInvitationAccountId(account.id);
                  void loadManagedInvites(account.id);
                }}
                {...uiProps(uiPath('invitations_screen', 'form', 'account_chip', account.id))}
              >
                <Text style={styles.modalChipText}>{account.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity
            style={[styles.entryAccountBtn, styles.entryAccountBtnFull]}
            onPress={() => { logUI(uiPath('invitations_screen', 'form', 'account_chip', invitationAccountId ?? 'none'), 'press'); openAcctPickerSheet('invite'); }}
            {...uiProps(uiPath('invitations_screen', 'form', 'account_chip', invitationAccountId ?? 'none'))}
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
          {...uiProps(uiPath('invitations_screen', 'form', 'name_input'))}
        />
        <TextInput
          placeholder="Expire in days (default 7)"
          placeholderTextColor="#64748B"
          keyboardType="number-pad"
          value={inviteExpiresDays}
          onChangeText={setInviteExpiresDays}
          style={styles.input}
          {...uiProps(uiPath('invitations_screen', 'form', 'expire_input'))}
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
            onPress={() => { logUI(uiPath('invitations_screen', 'actions', 'create_button'), 'press'); void saveInviteToken(editingInviteId); }}
            disabled={saving}
            {...uiProps(uiPath('invitations_screen', 'actions', 'create_button'))}
          >
            <Text style={styles.modalPrimaryText}>{editingInviteId ? 'Save Token' : 'Create Token'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.modalLabel}>Existing tokens</Text>
        <ScrollView style={{ maxHeight: 210 }}>
          {managedInvites.length === 0 ? (
            <Text style={styles.emptyText}>No invitations for this account.</Text>
          ) : managedInvites.map((invite, index) => (
            <View key={invite.id} style={styles.manageRow} {...uiProps(uiPath('invitations_screen', 'tokens', 'token_row', String(index)))}>
              <View style={styles.managePrimary}>
                <Text style={styles.manageTitle}>{invite.name || 'Invite token'}</Text>
                <Text style={styles.manageMeta}>{invite.token}</Text>
                <Text style={styles.manageMeta}>
                  {invite.used_at ? 'Used by another user' : 'Available'} • Expires {formatShortDate(invite.expires_at)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.manageIconButton}
                onPress={() => { logUI(uiPath('invitations_screen', 'tokens', 'share_button', String(index)), 'press'); void shareInvite(invite.token); }}
                {...uiProps(uiPath('invitations_screen', 'tokens', 'share_button', String(index)))}
              >
                <Icon name="share" size={16} color="#8FA8C9" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manageIconButton}
                onPress={() => {
                  logUI(uiPath('invitations_screen', 'tokens', 'edit_button', String(index)), 'press');
                  setEditingInviteId(invite.id);
                  setInviteName(invite.name || 'Invite token');
                  const msLeft = new Date(invite.expires_at).getTime() - Date.now();
                  const days = Math.max(1, Math.ceil(msLeft / 86400000));
                  setInviteExpiresDays(String(days));
                }}
                {...uiProps(uiPath('invitations_screen', 'tokens', 'edit_button', String(index)))}
              >
                <Text style={styles.manageIconText}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manageIconButtonDanger}
                onPress={() => {
                  logUI(uiPath('invitations_screen', 'tokens', 'remove_button', String(index)), 'press');
                  Alert.alert('Remove token', 'Delete this invitation token?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => void removeInviteToken(invite.id) },
                  ]);
                }}
                {...uiProps(uiPath('invitations_screen', 'tokens', 'remove_button', String(index)))}
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
          {...uiProps(uiPath('invitations_screen', 'join', 'token_input'))}
        />
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalSecondary}
            onPress={() => { logUI(uiPath('invitations_screen', 'actions', 'close_button'), 'press'); handleClose(); }}
            {...uiProps(uiPath('invitations_screen', 'actions', 'close_button'))}
          >
            <Text style={styles.modalSecondaryText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalPrimary}
            onPress={() => { logUI(uiPath('invitations_screen', 'join', 'join_button'), 'press'); void joinByToken(); }}
            disabled={saving}
            {...uiProps(uiPath('invitations_screen', 'join', 'join_button'))}
          >
            <Text style={styles.modalPrimaryText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ModalShell>
  );
}
