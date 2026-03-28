/**
 * Types for standalone debt system (person-to-person lending).
 */

export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';

export type Debt = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  description: string;
  status: DebtStatus;
  confirmed_by_from: boolean;
  confirmed_by_to: boolean;
  created_by: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedDebt = Debt & {
  otherUser: {
    user_id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  direction: 'owe' | 'owed'; // 'owe' = I owe them, 'owed' = they owe me
};

export type CreateDebtData = {
  other_user_id: string;
  amount: number;
  currency: string;
  description: string;
  direction: 'owe' | 'owed'; // who owes whom
  due_date?: string;
};
