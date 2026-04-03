import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useContacts } from '../../hooks/useContacts';
import { useFriends } from '../../hooks/useFriends';
import Icon from '../Icon';
import ContextBar from '../dashboard/layout/ContextBar';
import type { Contact } from '../../types/contacts';
import type { ResolvedFriend } from '../../types/friends';
import { uiPath, uiProps } from '../../lib/devtools';

// ── Merged display type ───────────────────────────────────────────────────────

type MergedContact = {
  key: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isAppUser: boolean;   // source='app_user' or friend-only
  contact: Contact | null;   // null for friend-only
  friend: ResolvedFriend | null;  // null for manual contacts
};

// ── Avatar helpers ────────────────────────────────────────────────────────────

function AvatarFallback({ name, size = 36 }: { name: string; size?: number }) {
  const initial = (name.charAt(0) || '?').toUpperCase();
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarFallbackText, { fontSize: size * 0.39 }]}>{initial}</Text>
    </View>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────

function ContactRow({ item, onEdit, onDelete, onAddContact }: {
  item: MergedContact;
  onEdit: (item: MergedContact) => void;
  onDelete: (id: string) => void;
  onAddContact: (friend: ResolvedFriend) => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const subtitle = item.email ?? item.phone;
  const isFriendOnly = item.contact === null;
  const size = 36;

  return (
    <View style={s.row} {...uiProps(uiPath('contacts', 'contact_row', 'container', item.key))}>
      {item.avatarUrl && !avatarFailed ? (
        <Image
          source={{ uri: item.avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1E3552' }}
          resizeMode="cover"
          onError={() => setAvatarFailed(true)}
          {...uiProps(uiPath('contacts', 'contact_row', 'avatar', item.key))}
        />
      ) : (
        <AvatarFallback name={item.displayName} size={size} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} {...uiProps(uiPath('contacts', 'contact_row', 'name', item.key))}>
          {item.displayName}
        </Text>
        {subtitle ? (
          <Text style={s.rowSub}>{subtitle}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          {item.isAppUser && <Text style={s.badgeGreen}>app user</Text>}
          {isFriendOnly && <Text style={s.badgeMuted}>friend</Text>}
        </View>
      </View>
      <View style={s.rowActions}>
        {isFriendOnly ? (
          <TouchableOpacity
            style={s.addContactBtn}
            onPress={() => onAddContact(item.friend!)}
            {...uiProps(uiPath('contacts', 'contact_row', 'add_contact_button', item.key))}
          >
            <Icon name="UserPlus" size={13} color="#53E3A6" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => onEdit(item)}
              {...uiProps(uiPath('contacts', 'contact_row', 'edit_button', item.key))}
            >
              <Icon name="Pencil" size={14} color="#8FA8C9" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.iconBtnDelete}
              onPress={() => onDelete(item.contact!.id)}
              {...uiProps(uiPath('contacts', 'contact_row', 'delete_button', item.key))}
            >
              <Icon name="Trash2" size={14} color="#f87171" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ── Contact Form Modal ────────────────────────────────────────────────────────

function ContactFormModal({ visible, item, onSave, onClose }: {
  visible: boolean;
  item: MergedContact | null;
  onSave: (data: { display_name: string; email: string | null; phone: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const isAppUser = item?.isAppUser ?? false;

  useEffect(() => {
    if (visible) {
      setName(item?.displayName ?? '');
      setEmail(item?.email ?? '');
      setPhone(item?.phone ?? '');
    }
  }, [visible, item]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSave({
      display_name: trimmed,
      email: isAppUser ? (item?.email ?? null) : (email.trim() || null),
      phone: phone.trim() || null,
    });
    setSaving(false);
  }, [name, email, phone, onSave, isAppUser, item?.email]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalSheet} {...uiProps(uiPath('contacts', 'form_modal', 'container'))}>
          <Text style={s.modalTitle}>
            {item?.contact ? 'Edit contact' : 'New contact'}
          </Text>

          <Text style={s.inputLabel}>Name *</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Display name"
            placeholderTextColor="#2A4163"
            autoFocus
            {...uiProps(uiPath('contacts', 'form_modal', 'name_input'))}
          />

          <Text style={s.inputLabel}>Email{isAppUser ? ' (from account)' : ''}</Text>
          <TextInput
            style={[s.input, isAppUser && s.inputDisabled]}
            value={email}
            onChangeText={isAppUser ? undefined : setEmail}
            placeholder="email@example.com"
            placeholderTextColor="#2A4163"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isAppUser}
            {...uiProps(uiPath('contacts', 'form_modal', 'email_input'))}
          />

          <Text style={s.inputLabel}>Phone</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 000 0000"
            placeholderTextColor="#2A4163"
            keyboardType="phone-pad"
            {...uiProps(uiPath('contacts', 'form_modal', 'phone_input'))}
          />

          <View style={s.modalActions}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={onClose}
              {...uiProps(uiPath('contacts', 'form_modal', 'cancel_button'))}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, (!name.trim() || saving) && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              {...uiProps(uiPath('contacts', 'form_modal', 'save_button'))}
            >
              {saving
                ? <ActivityIndicator size="small" color="#060A14" />
                : <Text style={s.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export default function ContactsSection() {
  const { user } = useAuth();
  const { setActiveSection } = useDashboard();
  const {
    contacts, loading: contactsLoading,
    getContacts, createContact, updateContact, deleteContact, findOrCreateContactForUser,
  } = useContacts(user);
  const { friends, loading: friendsLoading, loadFriends } = useFriends(user);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MergedContact | null>(null);

  const loading = contactsLoading || friendsLoading;

  useEffect(() => {
    void getContacts();
    void loadFriends();
  }, [getContacts, loadFriends]);

  // Build merged list: contacts + friends not yet in contacts
  const mergedList = useMemo((): MergedContact[] => {
    // Map userId → friend for quick avatar lookup
    const friendByUserId = new Map(friends.map((f) => [f.userId, f]));

    // 1. All contacts, enriched with friend avatar where available
    const contactItems: MergedContact[] = contacts.map((c) => {
      const linkedFriend = c.linked_user_id ? friendByUserId.get(c.linked_user_id) : undefined;
      return {
        key: c.id,
        displayName: c.display_name,
        email: c.email,
        phone: c.phone,
        avatarUrl: linkedFriend?.profile?.avatar_url ?? c.avatar_url ?? null,
        isAppUser: c.source === 'app_user',
        contact: c,
        friend: linkedFriend ?? null,
      };
    });

    // 2. Friends without a contact entry (no contact has linked_user_id matching this friend)
    const linkedUserIds = new Set(contacts.map((c) => c.linked_user_id).filter(Boolean));
    const friendOnlyItems: MergedContact[] = friends
      .filter((f) => !linkedUserIds.has(f.userId))
      .map((f) => ({
        key: `friend-${f.userId}`,
        displayName: f.profile?.display_name ?? f.profile?.email ?? f.userId.slice(0, 8),
        email: f.profile?.email ?? null,
        phone: null,
        avatarUrl: f.profile?.avatar_url ?? null,
        isAppUser: true,
        contact: null,
        friend: f,
      }));

    return [...contactItems, ...friendOnlyItems].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [contacts, friends]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((item: MergedContact) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const handleAddFriendContact = useCallback(async (friend: ResolvedFriend) => {
    const displayName = friend.profile?.display_name ?? friend.profile?.email ?? friend.userId.slice(0, 8);
    await findOrCreateContactForUser(friend.userId, displayName, friend.profile?.email, friend.profile?.avatar_url);
  }, [findOrCreateContactForUser]);

  const handleSave = useCallback(async (data: {
    display_name: string;
    email: string | null;
    phone: string | null;
  }) => {
    if (editingItem?.contact) {
      await updateContact(editingItem.contact.id, data);
    } else {
      await createContact(data);
    }
    setShowForm(false);
  }, [editingItem, createContact, updateContact]);

  const addButton = (
    <TouchableOpacity
      style={s.addBtn}
      onPress={openCreate}
      {...uiProps(uiPath('contacts', 'context_bar', 'add_button'))}
    >
      <Icon name="Plus" size={16} color="#53E3A6" />
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <ContextBar
        label="Contacts"
        onDismiss={() => setActiveSection(null)}
        rightElement={addButton}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        {...uiProps(uiPath('contacts', 'scroll_view', 'root'))}
      >
        {loading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 24 }} />}

        {!loading && mergedList.length === 0 && (
          <View style={s.emptyContainer} {...uiProps(uiPath('contacts', 'empty_state', 'container'))}>
            <Icon name="Users" size={40} color="#1F3A59" />
            <Text style={s.emptyText}>No contacts yet</Text>
            <Text style={s.emptyHint}>Contacts are created when you add members to pools, or add friends</Text>
            <TouchableOpacity
              style={s.emptyAddBtn}
              onPress={openCreate}
              {...uiProps(uiPath('contacts', 'empty_state', 'add_button'))}
            >
              <Icon name="Plus" size={14} color="#060A14" />
              <Text style={s.emptyAddBtnText}>Add contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {mergedList.map((item) => (
          <ContactRow
            key={item.key}
            item={item}
            onEdit={openEdit}
            onDelete={deleteContact}
            onAddContact={handleAddFriendContact}
          />
        ))}
      </ScrollView>

      <ContactFormModal
        visible={showForm}
        item={editingItem}
        onSave={handleSave}
        onClose={() => setShowForm(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A14' },

  // List row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#101A2A',
    gap: 12,
  },
  avatarFallback: {
    backgroundColor: '#1E3552',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#8FA8C9', fontWeight: '700' },
  rowName: { color: '#EAF3FF', fontSize: 14, fontWeight: '500' },
  rowSub: { color: '#475569', fontSize: 12, marginTop: 2 },
  badgeGreen: { color: '#53E3A6', fontSize: 10 },
  badgeMuted: { color: '#475569', fontSize: 10 },
  rowActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    backgroundColor: '#0E1A2B',
    borderRadius: 6,
    padding: 7,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  iconBtnDelete: {
    backgroundColor: '#1A0A0A',
    borderRadius: 6,
    padding: 7,
    borderWidth: 1,
    borderColor: '#f8717144',
  },
  addContactBtn: {
    backgroundColor: '#0E1A2B',
    borderRadius: 6,
    padding: 7,
    borderWidth: 1,
    borderColor: '#53E3A644',
  },

  // Empty state
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 12 },
  emptyHint: { color: '#475569', fontSize: 12, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#53E3A6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  emptyAddBtnText: { color: '#060A14', fontSize: 13, fontWeight: '700' },

  // Context bar add button
  addBtn: { padding: 6 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000BB',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0E1A2B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 24,
    gap: 6,
  },
  modalTitle: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: { color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  input: {
    backgroundColor: '#060A14',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#EAF3FF',
    fontSize: 14,
    marginTop: 4,
  },
  inputDisabled: {
    color: '#475569',
    borderColor: '#1F3A5944',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0E1A2B',
    borderWidth: 1,
    borderColor: '#1F3A59',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    backgroundColor: '#53E3A6',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#060A14', fontSize: 13, fontWeight: '700' },
});
