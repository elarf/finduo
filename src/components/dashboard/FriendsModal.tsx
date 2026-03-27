import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../screens/DashboardScreen.styles';
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
}) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [addEmail, setAddEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [friendsEditMode, setFriendsEditMode] = useState(false);

  // Load data when modal opens
  const handleOpen = () => {
    setTab('friends');
    setAddEmail('');
    setFriendsEditMode(false);
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

  const incoming = pendingRequests.filter((r) => r.direction === 'received');
  const outgoing = pendingRequests.filter((r) => r.direction === 'sent');

  const displayName = (r: ResolvedFriend | ResolvedRequest) => {
    const profile = 'profile' in r ? r.profile : null;
    return profile?.display_name ?? profile?.email ?? 'Unknown user';
  };

  const displaySub = (r: ResolvedFriend | ResolvedRequest) => {
    const profile = 'profile' in r ? r.profile : null;
    return profile?.email ?? null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
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
                      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                        {friends.map((f) => (
                          <View key={f.rowId} style={styles.manageRow}>
                            <View style={styles.managePrimary}>
                              <Text style={styles.manageTitle}>{displayName(f)}</Text>
                              {displaySub(f) ? (
                                <Text style={styles.manageMeta}>{displaySub(f)}</Text>
                              ) : null}
                            </View>
                            {friendsEditMode && (
                              <>
                                <TouchableOpacity
                                  style={styles.manageIconButton}
                                  onPress={() =>
                                    Alert.alert('Remove friend', `Remove ${displayName(f)} from friends?`, [
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
                                    Alert.alert('Block user', `Block ${displayName(f)}? They won't be able to find you.`, [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Block', style: 'destructive', onPress: () => void blockUser(f.rowId) },
                                    ])
                                  }
                                >
                                  <Text style={[styles.manageIconText, { fontSize: 10 }]}>BLK</Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        ))}
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
                      {incoming.map((r) => (
                        <View key={r.rowId} style={styles.manageRow}>
                          <View style={styles.managePrimary}>
                            <Text style={styles.manageTitle}>{displayName(r)}</Text>
                            {displaySub(r) ? <Text style={styles.manageMeta}>{displaySub(r)}</Text> : null}
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
                      ))}
                    </>
                  )}

                  {outgoing.length > 0 && (
                    <>
                      <Text style={[styles.modalLabel, { marginTop: 8 }]}>Sent</Text>
                      {outgoing.map((r) => (
                        <View key={r.rowId} style={styles.manageRow}>
                          <View style={styles.managePrimary}>
                            <Text style={styles.manageTitle}>{displayName(r)}</Text>
                            {displaySub(r) ? <Text style={styles.manageMeta}>{displaySub(r)}</Text> : null}
                            <Text style={[styles.manageMeta, { color: '#8FA8C9' }]}>Pending</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.manageIconButtonDanger}
                            onPress={() =>
                              Alert.alert('Cancel request', `Cancel request to ${displayName(r)}?`, [
                                { text: 'Keep', style: 'cancel' },
                                { text: 'Cancel request', style: 'destructive', onPress: () => void cancelRequest(r.rowId) },
                              ])
                            }
                          >
                            <Text style={styles.manageIconText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
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

export default React.memo(FriendsModal);
