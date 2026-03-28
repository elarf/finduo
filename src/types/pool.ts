export type PoolType = 'event' | 'continuous';
export type PoolStatus = 'active' | 'settled' | 'archived';
export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed';

export type Pool = {
  id: string;
  name: string;
  description: string | null;
  type: PoolType;
  currency: string;
  icon: string | null;
  status: PoolStatus;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PoolMember = {
  id: string;
  pool_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
};

export type PoolExpense = {
  id: string;
  pool_id: string;
  paid_by: string;
  amount: number;
  description: string;
  date: string;
  split_among: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PoolSettlement = {
  id: string;
  pool_id: string;
  settled_by: string;
  balances: Record<string, number>;
  transfers: SettlementTransfer[];
  expense_ids: string[];
  settled_at: string;
  note: string | null;
};

export type SettlementTransfer = {
  from: string;
  to: string;
  amount: number;
};

export type PoolDebt = {
  id: string;
  pool_id: string;
  settlement_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  status: DebtStatus;
  confirmed_by_from: boolean;
  confirmed_by_to: boolean;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedPoolMember = PoolMember & {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type ResolvedPool = Pool & {
  members: ResolvedPoolMember[];
  myRole: 'owner' | 'member';
  expenseCount: number;
  totalSpent: number;
  unsettledExpenseCount: number;
};

export type ResolvedDebt = PoolDebt & {
  otherUser: {
    user_id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  direction: 'owe' | 'owed';
  poolName: string;
};

export type SettlementPreview = {
  balances: Record<string, number>;
  transfers: SettlementTransfer[];
  expenseIds: string[];
};

export type CreatePoolData = {
  name: string;
  description?: string;
  type: PoolType;
  currency: string;
  icon?: string;
  start_date?: string;
  end_date?: string;
};

export type CreateExpenseData = {
  paid_by: string;
  amount: number;
  description: string;
  date: string;
  split_among?: string[];
};
