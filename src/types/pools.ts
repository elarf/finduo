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
  /** Enriched client-side from user_profiles; null for external members */
  avatar_url?: string | null;
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
 *
 * kind='debt'  → write to the debts table (both parties are auth users)
 * kind='entry' → at least one party is external; auth user should record as a
 *                personal transaction entry instead of a debt record.
 */
export type PreTransaction = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  metadata: {
    reason: 'settlement';
    sourcePoolId: string;
    kind: 'debt' | 'entry';
    /** Only present when kind='entry'. 'income' = auth user is owed; 'expense' = auth user owes. */
    entryType?: 'income' | 'expense';
  };
};

/**
 * Result returned from settlePoolDebts — drives the UI after confirmation.
 */
export type SettleResult =
  | { kind: 'settled'; debtCount: number }
  | { kind: 'balanced' }
  | { kind: 'entry'; amount: number; entryType: 'income' | 'expense' }
  | { kind: 'error' };

export type DebtStatus = 'pending' | 'confirmed' | 'paid';

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
};
