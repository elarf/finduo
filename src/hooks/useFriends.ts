import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { logAPI } from '../lib/devtools';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, ResolvedFriend, ResolvedRequest } from '../types/friends';

export function useFriends(user: User | null) {
  const [friends, setFriends] = useState<ResolvedFriend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ResolvedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  /** Map of friendUserId → list of account IDs they're members of (among accounts current user owns). */
  const [friendAccountMap, setFriendAccountMap] = useState<Record<string, string[]>>({});

  /** Upsert the current user's public profile so others can find them by email. */
  const ensureProfile = useCallback(async () => {
    if (!user) return;
    logAPI('supabase://user_profiles', { source: 'friends_modal.tab.friends', action: 'ensureProfile' });
    await supabase.from('user_profiles').upsert(
      {
        user_id: user.id,
        display_name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          user.email?.split('@')[0] ??
          null,
        email: user.email?.toLowerCase() ?? null,
        avatar_url:
          (user.user_metadata?.avatar_url as string | undefined) ||
          (user.user_metadata?.picture as string | undefined) ||
          null,
      },
      { onConflict: 'user_id' },
    );
  }, [user]);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await ensureProfile();

      logAPI('supabase://friends', { source: 'friends_modal.tab.friends', action: 'loadFriends' });
      const { data: rows, error } = await supabase
        .from('friends')
        .select('id, user_id, friend_user_id, status, created_at, updated_at')
        .or(`user_id.eq.${user.id},friend_user_id.eq.${user.id}`)
        .not('status', 'eq', 'rejected');

      if (error) throw error;

      // Collect unique other-user IDs for profile lookup
      const otherIds = [
        ...new Set(
          (rows ?? []).map((r: any) =>
            r.user_id === user.id ? r.friend_user_id : r.user_id,
          ),
        ),
      ] as string[];

      const profileMap: Record<string, UserProfile> = {};
      if (otherIds.length > 0) {
        logAPI('supabase://user_profiles', { source: 'friends_modal.tab.friends', action: 'loadFriends' });
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, email, avatar_url')
          .in('user_id', otherIds);
        for (const p of profileData ?? []) profileMap[p.user_id] = p;
      }

      const resolvedFriends: ResolvedFriend[] = [];
      const resolvedRequests: ResolvedRequest[] = [];

      for (const row of rows ?? []) {
        const isSent = row.user_id === user.id;
        const otherId: string = isSent ? row.friend_user_id : row.user_id;
        const profile = profileMap[otherId] ?? null;

        if (row.status === 'accepted') {
          resolvedFriends.push({
            rowId: row.id,
            userId: otherId,
            profile,
            direction: isSent ? 'sent' : 'received',
            since: row.updated_at,
          });
        } else if (row.status === 'pending') {
          resolvedRequests.push({
            rowId: row.id,
            otherUserId: otherId,
            profile,
            createdAt: row.created_at,
            direction: isSent ? 'sent' : 'received',
          });
        }
        // 'blocked' rows: visible only to the blocker (SELECT policy hides them from the other side)
      }

      setFriends(resolvedFriends);
      setPendingRequests(resolvedRequests);

      // Load which accounts each friend is a member of (only accounts the current user owns)
      const acceptedFriendIds = resolvedFriends.map((f) => f.userId);
      if (acceptedFriendIds.length > 0) {
        logAPI('supabase://account_members', { source: 'friends_modal.tab.friends', action: 'loadFriends' });
        const { data: memberRows } = await supabase
          .from('account_members')
          .select('account_id, user_id')
          .in('user_id', acceptedFriendIds);

        const map: Record<string, string[]> = {};
        for (const m of memberRows ?? []) {
          if (!map[m.user_id]) map[m.user_id] = [];
          map[m.user_id].push(m.account_id);
        }
        setFriendAccountMap(map);
      } else {
        setFriendAccountMap({});
      }
    } catch (err) {
      Alert.alert('Friends error', err instanceof Error ? err.message : 'Failed to load friends.');
    } finally {
      setLoading(false);
    }
  }, [ensureProfile, user]);

  /** Send a friend request by looking up the target user's email. */
  const sendRequest = useCallback(
    async (email: string): Promise<boolean> => {
      if (!user) return false;
      try {
        logAPI('supabase://user_profiles', { source: 'friends_modal.send_button', action: 'sendFriendRequest' });
        const { data: target, error: lookupErr } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();

        if (lookupErr) throw lookupErr;
        if (!target) throw new Error('No user found with that email address.');
        if (target.user_id === user.id) throw new Error('You cannot add yourself.');

        // Check for an existing non-rejected relationship in either direction
        logAPI('supabase://friends', { source: 'friends_modal.send_button', action: 'sendFriendRequest' });
        const { data: existing } = await supabase
          .from('friends')
          .select('id, status')
          .or(
            `and(user_id.eq.${user.id},friend_user_id.eq.${target.user_id}),` +
            `and(user_id.eq.${target.user_id},friend_user_id.eq.${user.id})`,
          );

        const active = (existing ?? []).find((r: any) => r.status !== 'rejected');
        if (active) {
          if (active.status === 'pending') throw new Error('A friend request is already pending.');
          if (active.status === 'accepted') throw new Error('You are already friends.');
          if (active.status === 'blocked') throw new Error('Cannot send a request to this user.');
        }

        logAPI('supabase://friends', { source: 'friends_modal.send_button', action: 'sendFriendRequest' });
        const { error } = await supabase.from('friends').insert({
          user_id: user.id,
          friend_user_id: target.user_id,
          status: 'pending',
        });
        if (error) throw error;

        await loadFriends();
        return true;
      } catch (err) {
        Alert.alert('Request failed', err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [loadFriends, user],
  );

  const acceptRequest = useCallback(
    async (rowId: string) => {
      if (!user) return;
      try {
        logAPI('supabase://friends', { source: 'friends_modal.accept_button', action: 'acceptRequest' });
        const { error } = await supabase
          .from('friends')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', rowId)
          .eq('friend_user_id', user.id)
          .eq('status', 'pending');
        if (error) throw error;
        await loadFriends();
      } catch (err) {
        Alert.alert('Accept failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [loadFriends, user],
  );

  const rejectRequest = useCallback(
    async (rowId: string) => {
      if (!user) return;
      try {
        logAPI('supabase://friends', { source: 'friends_modal.reject_button', action: 'rejectRequest' });
        const { error } = await supabase
          .from('friends')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', rowId);
        if (error) throw error;
        await loadFriends();
      } catch (err) {
        Alert.alert('Reject failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [loadFriends, user],
  );

  /** Cancel an outgoing pending request (hard delete since we own the row). */
  const cancelRequest = useCallback(
    async (rowId: string) => {
      if (!user) return;
      try {
        logAPI('supabase://friends', { source: 'friends_modal.cancel_button', action: 'cancelRequest' });
        const { error } = await supabase
          .from('friends')
          .delete()
          .eq('id', rowId)
          .eq('user_id', user.id);
        if (error) throw error;
        await loadFriends();
      } catch (err) {
        Alert.alert('Cancel failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [loadFriends, user],
  );

  /**
   * Remove an accepted friend.
   * If we sent the original request (user_id = us) we can DELETE.
   * If we received it (friend_user_id = us) we update to rejected.
   */
  const removeFriend = useCallback(
    async (rowId: string) => {
      if (!user) return;
      try {
        const row = friends.find((f) => f.rowId === rowId);
        if (row?.direction === 'sent') {
          logAPI('supabase://friends', { source: 'friends_modal.remove_button', action: 'removeFriend' });
          const { error } = await supabase.from('friends').delete().eq('id', rowId).eq('user_id', user.id);
          if (error) throw error;
        } else {
          logAPI('supabase://friends', { source: 'friends_modal.remove_button', action: 'removeFriend' });
          const { error } = await supabase
            .from('friends')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', rowId);
          if (error) throw error;
        }
        await loadFriends();
      } catch (err) {
        Alert.alert('Remove failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [friends, loadFriends, user],
  );

  const blockUser = useCallback(
    async (rowId: string) => {
      if (!user) return;
      try {
        logAPI('supabase://friends', { source: 'friends_modal.block_button', action: 'blockFriend' });
        const { error } = await supabase
          .from('friends')
          .update({ status: 'blocked', updated_at: new Date().toISOString() })
          .eq('id', rowId);
        if (error) throw error;
        await loadFriends();
      } catch (err) {
        Alert.alert('Block failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [loadFriends, user],
  );

  /** Add a friend to one of your accounts (non-expiring share). */
  const addFriendToAccount = useCallback(
    async (friendUserId: string, accountId: string): Promise<boolean> => {
      try {
        logAPI('supabase://account_members', { source: 'friends_modal.add_to_account_button', action: 'addFriendToAccount' });
        const { error } = await supabase.from('account_members').upsert(
          { account_id: accountId, user_id: friendUserId, role: 'member' },
          { onConflict: 'account_id,user_id', ignoreDuplicates: true },
        );
        if (error) throw error;
        // Update local map
        setFriendAccountMap((prev) => ({
          ...prev,
          [friendUserId]: [...(prev[friendUserId] ?? []), accountId],
        }));
        return true;
      } catch (err) {
        Alert.alert('Share failed', err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [],
  );

  /** Revoke a friend's access to an account. */
  const removeFriendFromAccount = useCallback(
    async (friendUserId: string, accountId: string): Promise<boolean> => {
      try {
        logAPI('supabase://account_members', { source: 'friends_modal.remove_from_account_button', action: 'removeFriendFromAccount' });
        const { error } = await supabase
          .from('account_members')
          .delete()
          .eq('account_id', accountId)
          .eq('user_id', friendUserId);
        if (error) throw error;
        // Update local map
        setFriendAccountMap((prev) => ({
          ...prev,
          [friendUserId]: (prev[friendUserId] ?? []).filter((id) => id !== accountId),
        }));
        return true;
      } catch (err) {
        Alert.alert('Revoke failed', err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [],
  );

  return {
    friends,
    pendingRequests,
    loading,
    friendAccountMap,
    loadFriends,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
    blockUser,
    addFriendToAccount,
    removeFriendFromAccount,
  };
}
