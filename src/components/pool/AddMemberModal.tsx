import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import Icon from '../Icon';
import { poolSharedStyles as sh } from './poolStyles';
import type { PoolMember } from '../../types/pools';
import type { ResolvedFriend } from '../../types/friends';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAddFriend: (friend: ResolvedFriend) => Promise<void>;
  onAddExternal: (name: string) => Promise<void>;
  poolMembers: PoolMember[];
  friends: ResolvedFriend[];
  friendsLoading: boolean;
}

export function AddMemberModal({
  visible,
  onClose,
  onAddFriend,
  onAddExternal,
  poolMembers,
  friends,
  friendsLoading,
}: Props) {
  const [mode, setMode] = useState<'friends' | 'external'>('friends');
  const [search, setSearch] = useState('');
  const [externalName, setExternalName] = useState('');

  useEffect(() => {
    if (!visible) return;
    logUI(uiPath('add_member_modal', 'card', 'container'), 'opened');
    setSearch('');
    setExternalName('');
  }, [visible]);

  useEffect(() => {
    if (visible && !friendsLoading && friends.length === 0) {
      setMode('external');
    }
  }, [friendsLoading, friends.length, visible]);

  const filteredFriends = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const name = (f.profile?.display_name ?? '').toLowerCase();
      const email = (f.profile?.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [friends, search]);

  const handleAddExternal = useCallback(async () => {
    const name = externalName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the external member.');
      return;
    }
    const alreadyAdded = poolMembers.some(
      (m) => m.display_name?.toLowerCase() === name.toLowerCase(),
    );
    if (alreadyAdded) {
      Alert.alert('Duplicate', `"${name}" is already a member of this pool.`);
      return;
    }
    await onAddExternal(name);
  }, [externalName, onAddExternal, poolMembers]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={sh.modalBackdrop}
        onPress={onClose}
        {...uiProps(uiPath('add_member_modal', 'backdrop', 'container'))}
      >
        <Pressable
          style={sh.modalCard}
          onPress={(e) => e.stopPropagation()}
          {...uiProps(uiPath('add_member_modal', 'card', 'container'))}
        >
          <Text style={sh.modalTitle} {...uiProps(uiPath('add_member_modal', 'card', 'title'))}>
            Add member
          </Text>

          {/* Tab toggle */}
          <View style={s.tabRow} {...uiProps(uiPath('add_member_modal', 'tabs', 'container'))}>
            <TouchableOpacity
              style={[s.tab, mode === 'friends' && s.tabActive]}
              onPress={() => {
                logUI(uiPath('add_member_modal', 'tabs', 'friends_tab'), 'press');
                setMode('friends');
              }}
              {...uiProps(uiPath('add_member_modal', 'tabs', 'friends_tab'))}
            >
              <Icon name="Users" size={13} color={mode === 'friends' ? '#53E3A6' : '#64748B'} />
              <Text style={[s.tabText, mode === 'friends' && s.tabTextActive]}>Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, mode === 'external' && s.tabActive]}
              onPress={() => {
                logUI(uiPath('add_member_modal', 'tabs', 'external_tab'), 'press');
                setMode('external');
              }}
              {...uiProps(uiPath('add_member_modal', 'tabs', 'external_tab'))}
            >
              <Icon name="UserPlus" size={13} color={mode === 'external' ? '#53E3A6' : '#64748B'} />
              <Text style={[s.tabText, mode === 'external' && s.tabTextActive]}>Add manually</Text>
            </TouchableOpacity>
          </View>

          {mode === 'friends' ? (
            <View>
              <TextInput
                placeholder="Search friends…"
                placeholderTextColor="#64748B"
                value={search}
                onChangeText={setSearch}
                style={[sh.input, { marginTop: 10 }]}
                {...uiProps(uiPath('add_member_modal', 'friends', 'search_input'))}
              />
              {friendsLoading ? (
                <ActivityIndicator color="#53E3A6" style={{ marginVertical: 16 }} />
              ) : filteredFriends.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
                  <Icon name="Users" size={28} color="#1F3A59" />
                  <Text style={[sh.hintText, { textAlign: 'center' }]}>
                    {friends.length === 0
                      ? 'No friends yet. Use "Add manually" to add anyone by name.'
                      : 'No results for that search'}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 250 }}
                  keyboardShouldPersistTaps="handled"
                  {...uiProps(uiPath('add_member_modal', 'friends', 'scroll'))}
                >
                  {filteredFriends.map((f) => {
                    const alreadyAdded = poolMembers.some((m) => m.user_id === f.userId);
                    const label = f.profile?.display_name ?? f.profile?.email ?? f.userId;
                    const sub =
                      f.profile?.display_name && f.profile?.email ? f.profile.email : null;
                    return (
                      <TouchableOpacity
                        key={f.rowId}
                        style={[s.friendRow, alreadyAdded && s.friendRowDisabled]}
                        disabled={alreadyAdded}
                        onPress={() => {
                          logUI(uiPath('add_member_modal', 'friends', 'row', f.rowId), 'press');
                          void onAddFriend(f);
                        }}
                        {...uiProps(uiPath('add_member_modal', 'friends', 'row', f.rowId))}
                      >
                        <View style={s.avatar} {...uiProps(uiPath('add_member_modal', 'friends', 'avatar', f.rowId))}>
                          {f.profile?.avatar_url ? (
                            <Image
                              source={{ uri: f.profile.avatar_url }}
                              style={s.avatarImg}
                            />
                          ) : (
                            <Text style={s.avatarInitial}>
                              {label[0]?.toUpperCase() ?? '?'}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[s.friendName, alreadyAdded && { color: '#475569' }]}
                            {...uiProps(uiPath('add_member_modal', 'friends', 'name', f.rowId))}
                          >
                            {label}
                          </Text>
                          {sub && (
                            <Text style={s.friendEmail} {...uiProps(uiPath('add_member_modal', 'friends', 'email', f.rowId))}>
                              {sub}
                            </Text>
                          )}
                        </View>
                        {alreadyAdded && <Icon name="Check" size={14} color="#475569" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <Text style={sh.hintText}>Add anyone — no app account needed.</Text>
              <TextInput
                placeholder="Name (required)"
                placeholderTextColor="#64748B"
                value={externalName}
                onChangeText={setExternalName}
                style={sh.input}
                autoCorrect={false}
                {...uiProps(uiPath('add_member_modal', 'external', 'name_input'))}
              />
            </View>
          )}

          <View style={sh.modalActions}>
            <TouchableOpacity
              style={sh.modalSecondary}
              onPress={() => {
                logUI(uiPath('add_member_modal', 'actions', 'cancel_button'), 'press');
                onClose();
              }}
              {...uiProps(uiPath('add_member_modal', 'actions', 'cancel_button'))}
            >
              <Text style={sh.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            {mode === 'external' && (
              <TouchableOpacity
                style={[sh.modalPrimary, !externalName.trim() && { opacity: 0.4 }]}
                disabled={!externalName.trim()}
                onPress={() => {
                  logUI(uiPath('add_member_modal', 'actions', 'add_button'), 'press');
                  void handleAddExternal();
                }}
                {...uiProps(uiPath('add_member_modal', 'actions', 'add_button'))}
              >
                <Text style={sh.modalPrimaryText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  tabActive: {
    borderColor: '#53E3A6',
    backgroundColor: '#0D2818',
  },
  tabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#53E3A6',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111E2E',
  },
  friendRowDisabled: {
    opacity: 0.45,
  },
  friendName: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '500',
  },
  friendEmail: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1F3A59',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 34,
    height: 34,
  },
  avatarInitial: {
    color: '#53E3A6',
    fontSize: 13,
    fontWeight: '700',
  },
});
