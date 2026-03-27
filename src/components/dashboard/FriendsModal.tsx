import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import type { ResolvedFriend, ResolvedRequest } from '../../types/friends';

type Tab = 'friends' | 'requests' | 'add';

type FriendsModalProps = {
  visible: boolean;
  onClose: () => void;
  friends: ResolvedFriend[];
  pendingRequests: ResolvedRequest[];
  loading: boolean;
  onOpen: () => void;
  sendRequest: (email: string) => Promise<boolean>;
  acceptRequest: (rowId: string) => Promise<void>;
  rejectRequest: (rowId: string) => Promise<void>;
  cancelRequest: (rowId: string) => Promise<void>;
  removeFriend: (rowId: string) => Promise<void>;
  blockUser: (rowId: string) => Promise<void>;
  // Account sharing
  ownedAccounts: AppAccount[];
  friendAccountMap: Record<string, string[]>;
  addFriendToAccount: (friendUserId: string, accountId: string) => Promise<boolean>;
  removeFriendFromAccount: (friendUserId: string, accountId: string) => Promise<boolean>;
  reloadDashboard: () => Promise<void>;
};

const FriendsModal: React.FC<FriendsModalProps> = ({
  visible,
  onClose,
  friends,
  pendingRequests,
  loading,
  onOpen,
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeFriend,
  blockUser,
  ownedAccounts,
  friendAccountMap,
  addFriendToAccount,
  removeFriendFromAccount,
  reloadDashboard,
}) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [addEmail, setAddEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [friendsEditMode, setFriendsEditMode] = useState(false);
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);

  const handleOpen = () => {
    setTab('friends');
    setAddEmail('');
    setFriendsEditMode(false);
    setExpandedFriendId(null);
    onOpen();
  };

  const handleSend = async () => {
    if (!addEmail.trim()) return;
    setSending(true);
    const ok = await sendRequest(addEmail);
    setSending(false);
    if (ok) {
      setAddEmail('');
      setTab('friends');
    }
  };

  const handleToggleAccount = async (friendUserId: string, accountId: string, hasAccess: boolean) => {
    if (hasAccess) {
      Alert.alert('Revoke access', 'Remove this friend from the account?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            await removeFriendFromAccount(friendUserId, accountId);
            void reloadDashboard();
          },
        },
      ]);
    } else {
      const ok = await addFriendToAccount(friendUserId, accountId);
      if (ok) void reloadDashboard();
    }
  };

  const incoming = pendingRequests.filter((r) => r.direction === 'received');
  const outgoing = pendingRequests.filter((r) => r.direction === 'sent');

  const getName = (r: ResolvedFriend | ResolvedRequest) =>
    r.profile?.display_name ?? r.profile?.email ?? 'Unknown user';

  const getEmail = (r: ResolvedFriend | ResolvedRequest) =>
    r.profile?.email ?? null;

  const getAvatar = (r: ResolvedFriend | ResolvedRequest) =>
    r.profile?.avatar_url ?? null;

  const avatarFallback = (r: ResolvedFriend | ResolvedRequest) =>
    (getName(r)[0] ?? '?').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onShow={handleOpen}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Friends</Text>

          {/* Tab chips */}
          <View style={[styles.modalChipsRow, { marginBottom: 12 }]}>
            {(['friends', 'requests', 'add'] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.modalChip,
                  tab === t && styles.modalChipActive,
                  t === 'requests' && incoming.length > 0 && { borderColor: '#f87171' },
                ]}
                onPress={() => setTab(t)}
              >
                <Text style={styles.modalChipText}>
                  {t === 'friends' ? `Friends${friends.length > 0 ? ` (${friends.length})` : ''}` : null}
                  {t === 'requests' ? `Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` : null}
                  {t === 'add' ? 'Add Friend' : null}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color="#53E3A6" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* ── Friends tab ── */}
              {tab === 'friends' && (
                <>
                  {friends.length === 0 ? (
                    <Text style={styles.emptyText}>No friends yet. Use "Add Friend" to get started.</Text>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
                        <TouchableOpacity
                          style={[styles.manageIconButton, friendsEditMode && { backgroundColor: '#2C4669' }]}
                          onPress={() => setFriendsEditMode((p) => !p)}
                        >
                          <Text style={styles.manageIconText}>✎</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                        {friends.map((f) => {
                          const avatar = getAvatar(f);
                          const isExpanded = expandedFriendId === f.userId;
                          const sharedAccountIds = friendAccountMap[f.userId] ?? [];

                          return (
                            <View key={f.rowId}>
                              <TouchableOpacity
                                style={local.friendCard}
                                activeOpacity={0.7}
                                onPress={() => setExpandedFriendId(isExpanded ? null : f.userId)}
                              >
                                {/* Avatar */}
                                {avatar ? (
                                  <Image source={{ uri: avatar }} style={local.avatar} />
                                ) : (
                                  <View style={local.avatarFallback}>
                                    <Text style={local.avatarFallbackText}>{avatarFallback(f)}</Text>
                                  </View>
                                )}
                                {/* Name + email aligned right */}
                                <View style={local.friendInfo}>
                                  <Text style={local.friendName}>{getName(f)}</Text>
                                  {getEmail(f) ? (
                                    <Text style={local.friendEmail}>{getEmail(f)}</Text>
                                  ) : null}
                                  {sharedAccountIds.length > 0 && (
                                    <Text style={local.sharedBadge}>
                                      {sharedAccountIds.length} account{sharedAccountIds.length > 1 ? 's' : ''} shared
                                    </Text>
                                  )}
                                </View>
                                {/* Edit mode actions */}
                                {friendsEditMode && (
                                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 6 }}>
                                    <TouchableOpacity
                                      style={styles.manageIconButton}
                                      onPress={() =>
                                        Alert.alert('Remove friend', `Remove ${getName(f)} from friends?`, [
                                          { text: 'Cancel', style: 'cancel' },
                                          { text: 'Remove', style: 'destructive', onPress: () => void removeFriend(f.rowId) },
                                        ])
                                      }
                                    >
                                      <Text style={styles.manageIconText}>✕</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.manageIconButtonDanger}
                                      onPress={() =>
                                        Alert.alert('Block user', `Block ${getName(f)}? They won't be able to find you.`, [
                                          { text: 'Cancel', style: 'cancel' },
                                          { text: 'Block', style: 'destructive', onPress: () => void blockUser(f.rowId) },
                                        ])
                                      }
                                    >
                                      <Text style={[styles.manageIconText, { fontSize: 10 }]}>BLK</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                                {/* Expand chevron */}
                                {!friendsEditMode && (
                                  <Text style={{ color: '#8FA8C9', fontSize: 14, marginLeft: 6 }}>
                                    {isExpanded ? '▾' : '▸'}
                                  </Text>
                                )}
                              </TouchableOpacity>

                              {/* Expanded: account sharing panel */}
                              {isExpanded && !friendsEditMode && ownedAccounts.length > 0 && (
                                <View style={local.accountPanel}>
                                  <Text style={local.accountPanelTitle}>Share accounts with {getName(f)}</Text>
                                  {ownedAccounts.map((acct) => {
                                    const hasAccess = sharedAccountIds.includes(acct.id);
                                    return (
                                      <TouchableOpacity
                                        key={acct.id}
                                        style={[local.accountRow, hasAccess && local.accountRowActive]}
                                        onPress={() => void handleToggleAccount(f.userId, acct.id, hasAccess)}
                                      >
                                        <Text style={local.accountCheck}>{hasAccess ? '☑' : '☐'}</Text>
                                        <Text style={local.accountName}>{acct.name}</Text>
                                        <Text style={local.accountCurrency}>{acct.currency}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </>
                  )}
                </>
              )}

              {/* ── Requests tab ── */}
              {tab === 'requests' && (
                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  {incoming.length === 0 && outgoing.length === 0 ? (
                    <Text style={styles.emptyText}>No pending requests.</Text>
                  ) : null}

                  {incoming.length > 0 && (
                    <>
                      <Text style={[styles.modalLabel, { color: '#4ade80' }]}>Incoming</Text>
                      {incoming.map((r) => {
                        const avatar = getAvatar(r);
                        return (
                          <View key={r.rowId} style={local.friendCard}>
                            {avatar ? (
                              <Image source={{ uri: avatar }} style={local.avatarSmall} />
                            ) : (
                              <View style={[local.avatarFallback, local.avatarSmall]}>
                                <Text style={local.avatarFallbackText}>{avatarFallback(r)}</Text>
                              </View>
                            )}
                            <View style={local.friendInfo}>
                              <Text style={local.friendName}>{getName(r)}</Text>
                              {getEmail(r) ? <Text style={local.friendEmail}>{getEmail(r)}</Text> : null}
                            </View>
                            <TouchableOpacity
                              style={[styles.manageIconButton, { borderColor: '#4ade80' }]}
                              onPress={() => void acceptRequest(r.rowId)}
                            >
                              <Text style={[styles.manageIconText, { color: '#4ade80' }]}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.manageIconButtonDanger}
                              onPress={() => void rejectRequest(r.rowId)}
                            >
                              <Text style={styles.manageIconText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {outgoing.length > 0 && (
                    <>
                      <Text style={[styles.modalLabel, { marginTop: 8 }]}>Sent</Text>
                      {outgoing.map((r) => {
                        const avatar = getAvatar(r);
                        return (
                          <View key={r.rowId} style={local.friendCard}>
                            {avatar ? (
                              <Image source={{ uri: avatar }} style={local.avatarSmall} />
                            ) : (
                              <View style={[local.avatarFallback, local.avatarSmall]}>
                                <Text style={local.avatarFallbackText}>{avatarFallback(r)}</Text>
                              </View>
                            )}
                            <View style={local.friendInfo}>
                              <Text style={local.friendName}>{getName(r)}</Text>
                              {getEmail(r) ? <Text style={local.friendEmail}>{getEmail(r)}</Text> : null}
                              <Text style={{ color: '#8FA8C9', fontSize: 11 }}>Pending</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.manageIconButtonDanger}
                              onPress={() =>
                                Alert.alert('Cancel request', `Cancel request to ${getName(r)}?`, [
                                  { text: 'Keep', style: 'cancel' },
                                  { text: 'Cancel request', style: 'destructive', onPress: () => void cancelRequest(r.rowId) },
                                ])
                              }
                            >
                              <Text style={styles.manageIconText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </>
                  )}
                </ScrollView>
              )}

              {/* ── Add Friend tab ── */}
              {tab === 'add' && (
                <>
                  <Text style={styles.modalLabel}>Search by email</Text>
                  <TextInput
                    placeholder="friend@example.com"
                    placeholderTextColor="#64748B"
                    value={addEmail}
                    onChangeText={setAddEmail}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={() => void handleSend()}
                  />
                  <Text style={[styles.manageMeta, { marginBottom: 10, marginTop: -4 }]}>
                    The other person must have opened the app at least once.
                  </Text>
                </>
              )}
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
              <Text style={styles.modalSecondaryText}>Close</Text>
            </TouchableOpacity>
            {tab === 'add' && (
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => void handleSend()}
                disabled={sending || !addEmail.trim()}
              >
                <Text style={styles.modalPrimaryText}>{sending ? 'Sending…' : 'Send Request'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const local = StyleSheet.create({
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E3552',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#8FA8C9',
    fontSize: 16,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  friendName: {
    color: '#EAF3FF',
    fontSize: 14,
    fontWeight: '600',
  },
  friendEmail: {
    color: '#8FA8C9',
    fontSize: 12,
  },
  sharedBadge: {
    color: '#53E3A6',
    fontSize: 11,
    marginTop: 2,
  },
  accountPanel: {
    backgroundColor: '#0D1B2A',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  accountPanelTitle: {
    color: '#8FA8C9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  accountRowActive: {
    backgroundColor: '#142235',
  },
  accountCheck: {
    color: '#53E3A6',
    fontSize: 16,
  },
  accountName: {
    color: '#EAF3FF',
    fontSize: 13,
    flex: 1,
  },
  accountCurrency: {
    color: '#64748B',
    fontSize: 11,
  },
});

export default React.memo(FriendsModal);
