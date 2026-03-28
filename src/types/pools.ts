export type PoolType = 'event' | 'continuous';
export type PoolStatus = 'active' | 'closed';

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

export type PoolMember = {
  pool_id: string;
  user_id: string;
  joined_at: string;
};

export type PoolTransaction = {
  id: string;
  pool_id: string;
  paid_by: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
};

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
