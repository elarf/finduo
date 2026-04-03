export type PoolType = 'event' | 'continuous';
export type PoolStatus = 'active' | 'closed';
export type PoolParticipantType = 'auth' | 'external';

export type Pool = {
  id: string;
  name: string;
  type: PoolType;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  status: PoolStatus;
  created_at: string;
};

/** Unified participant row — mirrors pool_participants table */
export type PoolParticipant = {
  id: string;
  pool_id: string;
  type: PoolParticipantType;
  /** Non-null when type = 'auth' */
  user_id: string | null;
  /** Non-null when type = 'external' */
  external_name: string | null;
  /** Denormalized display name for UI (works for both types) */
  display_name: string | null;
  /** Enriched client-side from user_profiles or contacts; null for unlinked external members */
  avatar_url?: string | null;
  /** FK to contacts table — set for both auth (via linked_user_id) and external members */
  contact_id: string | null;
  created_at: string;
};

/** Alias kept for compatibility with existing UI components */
export type PoolMember = PoolParticipant;

export type PoolTransaction = {
  id: string;
  pool_id: string;
  paid_by: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
};

/**
 * In-memory settlement result — not persisted until the user explicitly commits.
 * Handles both auth-to-auth debts and debts involving external participants (contacts).
 */
export type PreTransaction = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  metadata: {
    reason: 'settlement';
    sourcePoolId: string;
    /** Participant display names for UI */
    fromParticipantName?: string;
    toParticipantName?: string;
    /** Original participant database IDs */
    fromParticipantDbId?: string;
    toParticipantDbId?: string;
    /** Auth user IDs when both parties are authenticated */
    fromUserId?: string | null;
    toUserId?: string | null;
    /** Contact IDs for both parties */
    fromContactId?: string | null;
    toContactId?: string | null;
  };
};

/**
 * Result returned from settlePoolDebts — drives the UI after confirmation.
 */
export type SettleResult =
  | { kind: 'settled'; debtCount: number }
  | { kind: 'balanced' }
  | { kind: 'error' };

export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'recorded' | 'archived';

export type AppDebt = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  pool_id: string | null;
  status: DebtStatus;
  from_confirmed: boolean;
  to_confirmed: boolean;
  created_at: string;
  updated_at: string;
  /** Participant IDs from pool_participants (for display resolution) */
  from_participant_id?: string;
  to_participant_id?: string;
  from_participant_name?: string;
  to_participant_name?: string;
  /** Contact IDs for both parties */
  from_contact_id?: string;
  to_contact_id?: string;
};
