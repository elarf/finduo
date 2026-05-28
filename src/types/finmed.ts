export interface FinmedMedication {
  id: string;
  user_id: string;
  name: string;
  form: string;
  unit: string;
  stock_quantity: number;
  stock_low_threshold: number;
  notes: string | null;
  created_at: string;
}

export type FinmedScheduleType = 'finite' | 'ongoing';

export interface FinmedSchedule {
  id: string;
  medication_id: string;
  user_id: string;
  type: FinmedScheduleType;
  dose_amount: number;
  dose_unit: string;
  times_per_day: number;
  times_of_day: string[];
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

export interface FinmedIntakeLog {
  id: string;
  medication_id: string;
  schedule_id: string | null;
  user_id: string;
  taken_at: string;
  dose_amount: number;
  note: string | null;
}

export interface FinmedStockTransaction {
  id: string;
  medication_id: string;
  transaction_id: string;
  user_id: string;
  quantity_added: number;
  price_allocated: number;
  created_at: string;
}
