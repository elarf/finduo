import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { logAPI } from '../lib/devtools';
import type { User } from '@supabase/supabase-js';
import type { Contact } from '../types/contacts';

export function useContacts(user: User | null) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const getContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      logAPI('supabase://contacts', { source: 'contacts.list', action: 'getContacts' });
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('owner_id', user.id)
        .order('display_name', { ascending: true });
      if (error) throw error;
      setContacts((data ?? []) as Contact[]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createContact = useCallback(async (data: {
    display_name: string;
    email?: string | null;
    phone?: string | null;
    linked_user_id?: string | null;
    avatar_url?: string | null;
    source?: Contact['source'];
  }): Promise<Contact | null> => {
    if (!user) return null;
    try {
      logAPI('supabase://contacts', { source: 'contacts.create', action: 'createContact' });
      const { data: row, error } = await supabase
        .from('contacts')
        .insert({
          owner_id: user.id,
          display_name: data.display_name,
          email: data.email ?? null,
          phone: data.phone ?? null,
          linked_user_id: data.linked_user_id ?? null,
          avatar_url: data.avatar_url ?? null,
          source: data.source ?? 'manual',
        })
        .select('*')
        .single();
      if (error) throw error;
      const contact = row as Contact;
      setContacts((prev) => [...prev, contact]);
      return contact;
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create contact');
      return null;
    }
  }, [user]);

  const updateContact = useCallback(async (
    contactId: string,
    data: Partial<Pick<Contact, 'display_name' | 'email' | 'phone' | 'avatar_url' | 'notes' | 'linked_user_id'>>,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://contacts', { source: 'contacts.update', action: 'updateContact' });
      const { error } = await supabase
        .from('contacts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (error) throw error;
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, ...data } : c)),
      );
      return true;
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update contact');
      return false;
    }
  }, [user]);

  const deleteContact = useCallback(async (contactId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://contacts', { source: 'contacts.delete', action: 'deleteContact' });
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);
      if (error) throw error;
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      return true;
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete contact');
      return false;
    }
  }, [user]);

  /**
   * Find an existing contact linked to the given auth user, or create one.
   * Used when adding a friend to a pool — ensures we don't create duplicate contacts.
   */
  const findOrCreateContactForUser = useCallback(async (
    linkedUserId: string,
    displayName: string,
    email?: string | null,
    avatarUrl?: string | null,
  ): Promise<Contact | null> => {
    if (!user) return null;

    // Check local cache first
    const existing = contacts.find((c) => c.linked_user_id === linkedUserId);
    if (existing) return existing;

    // Check DB (may not be in local cache yet)
    try {
      logAPI('supabase://contacts', { source: 'contacts.findOrCreate', action: 'findOrCreateContactForUser' });
      const { data: found } = await supabase
        .from('contacts')
        .select('*')
        .eq('owner_id', user.id)
        .eq('linked_user_id', linkedUserId)
        .maybeSingle();

      if (found) {
        const contact = found as Contact;
        setContacts((prev) => {
          if (prev.some((c) => c.id === contact.id)) return prev;
          return [...prev, contact];
        });
        return contact;
      }
    } catch {
      // Fall through to create
    }

    return createContact({
      display_name: displayName,
      email,
      avatar_url: avatarUrl,
      linked_user_id: linkedUserId,
      source: 'app_user',
    });
  }, [contacts, createContact, user]);

  return {
    contacts,
    loading,
    getContacts,
    createContact,
    updateContact,
    deleteContact,
    findOrCreateContactForUser,
  };
}
