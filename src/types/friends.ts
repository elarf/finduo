export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export type UserProfile = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

/** An accepted friend (either direction). */
export type ResolvedFriend = {
  rowId: string;
  userId: string;
  profile: UserProfile | null;
  direction: 'sent' | 'received';
  since: string;
};

/** A pending friend request (incoming or outgoing). */
export type ResolvedRequest = {
  rowId: string;
  otherUserId: string;
  profile: UserProfile | null;
  createdAt: string;
  direction: 'sent' | 'received';
};
