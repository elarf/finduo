// ─── Existing medication types (preserved) ───────────────────────────────────

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
  cycle_intake_days: number | null;
  cycle_pause_days: number | null;
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

// ─── Reminder system ──────────────────────────────────────────────────────────

export type ReminderType = 'medication' | 'measurement' | 'symptom_check' | 'appointment';

export type FrequencyType =
  | 'interval'
  | 'multiple_times_daily'
  | 'specific_day_of_week'
  | 'cyclic'
  | 'on_demand';

export interface FrequencyConfig {
  /** hours between doses — used by 'interval' */
  interval_hours?: number;
  /** HH:MM strings — used by 'multiple_times_daily' */
  times?: string[];
  /** 0=Sun … 6=Sat — used by 'specific_day_of_week' */
  weekdays?: number[];
  /** used by 'cyclic' */
  cycle_intake_days?: number;
  cycle_pause_days?: number;
}

// ─── Type-specific configs ────────────────────────────────────────────────────

export interface MedicationReminderConfig {
  medication_id: string;
  dose_amount: number;
  dose_unit: string;
}

export type MeasurementKind =
  | 'weight'
  | 'temperature'
  | 'blood_pressure'
  | 'heart_rate'
  | 'blood_oxygen'
  | 'blood_glucose'
  | 'nicotine'
  | 'sleep_duration'
  | 'water_intake'
  | 'steps'
  | 'mood_score'
  | 'custom';

export interface MeasurementConfig {
  kind: MeasurementKind;
  custom_name?: string;
  unit: string;
  /** for blood pressure */
  secondary_unit?: string;
  /** weight target, etc. */
  target_value?: number;
  /** nicotine: 'yes_no' | 'cigarettes' */
  nicotine_mode?: 'yes_no' | 'cigarettes';
  /** temperature unit toggle */
  temperature_unit?: 'C' | 'F';
}

export interface SymptomCheckConfig {
  // config reserved — active symptoms stored in finmed_persistent_symptoms
}

export interface AppointmentConfig {
  date: string;
  time: string;
  description: string;
  archived?: boolean;
}

export type ReminderTypeConfig =
  | MedicationReminderConfig
  | MeasurementConfig
  | SymptomCheckConfig
  | AppointmentConfig;

export interface FinmedReminder {
  id: string;
  user_id: string;
  type: ReminderType;
  label: string;
  frequency_type: FrequencyType;
  frequency_config: FrequencyConfig;
  start_date: string;
  end_date: string | null;
  active: boolean;
  type_config: ReminderTypeConfig;
  created_at: string;
}

// ─── Log value types ──────────────────────────────────────────────────────────

export interface MeasurementValue {
  primary: number;
  secondary?: number;
  nicotine_taken?: boolean;
}

export interface SymptomEntry {
  name: string;
  severity: number; // 0–10
}

export interface SymptomCheckValue {
  mood: 1 | 2 | 3 | 4 | 5;
  symptoms: SymptomEntry[];
}

export type ReminderLogValue = MeasurementValue | SymptomCheckValue | Record<string, never>;

export interface FinmedReminderLog {
  id: string;
  reminder_id: string;
  user_id: string;
  scheduled_for: string;
  action: 'complete' | 'ignore' | 'snooze';
  completed_at: string | null;
  ignored_at: string | null;
  snoozed_until: string | null;
  value: ReminderLogValue | null;
  note: string | null;
  created_at: string;
}

// ─── Persistent symptoms ──────────────────────────────────────────────────────

export interface PersistentSymptom {
  id: string;
  user_id: string;
  symptom_name: string;
  is_custom: boolean;
  created_at: string;
}
