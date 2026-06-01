import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { AppTransaction } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';
import type {
  FinmedMedication, FinmedSchedule, FinmedIntakeLog,
  FinmedReminder, FinmedReminderLog, PersistentSymptom,
  ReminderLogValue, FrequencyConfig, ReminderTypeConfig,
  FrequencyType, ReminderType,
} from '../types/finmed';
import {
  scheduleIntakeReminder,
  cancelIntakeReminder,
  cancelReminderTimeSlot,
  rescheduleAfterSnooze,
  scheduleStockAlert,
} from '../lib/finmed/notifications';

export const finmedMedsQueryKey = (userId: string | undefined) =>
  ['finmed_medications', userId] as const;

export const finmedRemindersQueryKey = (userId: string | undefined) =>
  ['finmed_reminders', userId] as const;

export const finmedPersistentSymptomsQueryKey = (userId: string | undefined) =>
  ['finmed_persistent_symptoms', userId] as const;

export function useFinmed(user: User | null) {
  const queryClient = useQueryClient();
  const userId = user?.id;

  // ─── Medications ────────────────────────────────────────────────────────────

  const { data: medications = [], isLoading: loading } = useQuery({
    queryKey: finmedMedsQueryKey(userId),
    queryFn: async () => {
      logAPI('supabase://finmed_medications', { source: 'finmed.screen', action: 'loadMedications' });
      const { data, error } = await supabase
        .from('finmed_medications')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      return (data ?? []) as FinmedMedication[];
    },
    enabled: !!userId,
  });

  const [schedulesByMed, setSchedulesByMed] = useState<Record<string, FinmedSchedule[]>>({});
  const [intakeLogsByMed, setIntakeLogsByMed] = useState<Record<string, FinmedIntakeLog[]>>({});
  const [categoryTransactions, setCategoryTransactions] = useState<AppTransaction[]>([]);

  const loadSchedules = useCallback(async (medicationId: string) => {
    try {
      logAPI('supabase://finmed_schedules', { source: 'finmed.detail_sheet', action: 'loadSchedules' });
      const { data, error } = await supabase
        .from('finmed_schedules')
        .select('*')
        .eq('medication_id', medicationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSchedulesByMed((prev) => ({ ...prev, [medicationId]: (data ?? []) as FinmedSchedule[] }));
    } catch {
      // non-fatal
    }
  }, []);

  const loadIntakeLogs = useCallback(async (medicationId: string) => {
    try {
      logAPI('supabase://finmed_intake_logs', { source: 'finmed.detail_sheet', action: 'loadIntakeLogs' });
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from('finmed_intake_logs')
        .select('*')
        .eq('medication_id', medicationId)
        .gte('taken_at', sevenDaysAgo.toISOString())
        .order('taken_at', { ascending: false });
      if (error) throw error;
      setIntakeLogsByMed((prev) => ({ ...prev, [medicationId]: (data ?? []) as FinmedIntakeLog[] }));
    } catch {
      // non-fatal
    }
  }, []);

  const loadCategoryTransactions = useCallback(async (categoryId: string) => {
    try {
      logAPI('supabase://transactions', { source: 'finmed.stock_picker', action: 'loadCategoryTransactions' });

      // Direct matches
      const { data: directData, error: directError } = await supabase
        .from('transactions')
        .select('id,account_id,category_id,amount,note,type,date,created_at,has_splits')
        .eq('category_id', categoryId)
        .order('date', { ascending: false });
      if (directError) throw directError;
      const directTxs: AppTransaction[] = (directData ?? []).map((t: any) => ({ ...t, tag_ids: [] }));
      const directIds = new Set(directTxs.map((t) => t.id));

      // Split-sourced
      logAPI('supabase://transaction_splits', { source: 'finmed.stock_picker', action: 'loadSplitMatches' });
      const { data: splitsData, error: splitsError } = await supabase
        .from('transaction_splits')
        .select('parent_transaction_id, amount')
        .eq('category_id', categoryId);
      if (splitsError) {
        if (isMissingTableError(splitsError)) {
          setCategoryTransactions(directTxs);
          return;
        }
        throw splitsError;
      }

      const splitAmounts: Record<string, number> = {};
      for (const s of splitsData ?? []) {
        splitAmounts[s.parent_transaction_id] = (splitAmounts[s.parent_transaction_id] ?? 0) + s.amount;
      }

      const parentIds = Object.keys(splitAmounts).filter((id) => !directIds.has(id));
      let splitParentTxs: AppTransaction[] = [];
      if (parentIds.length > 0) {
        const { data: parentData, error: parentError } = await supabase
          .from('transactions')
          .select('id,account_id,category_id,amount,note,type,date,created_at,has_splits')
          .in('id', parentIds);
        if (parentError) throw parentError;
        splitParentTxs = (parentData ?? []).map((t: any) => ({
          ...t,
          tag_ids: [],
          amount: splitAmounts[t.id] ?? t.amount,
        }));
      }

      const all = [...directTxs, ...splitParentTxs].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
      );
      setCategoryTransactions(all);
    } catch {
      setCategoryTransactions([]);
    }
  }, []);

  const invalidateMeds = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: finmedMedsQueryKey(userId) });
  }, [queryClient, userId]);

  const createMedication = useCallback(async (
    name: string, form: string, unit: string,
    stock_quantity: number, stock_low_threshold: number, notes: string | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_medications', { source: 'finmed.med_modal', action: 'createMedication' });
      const { error } = await supabase.from('finmed_medications').insert({
        user_id: user.id, name, form, unit, stock_quantity, stock_low_threshold, notes,
      });
      if (error) throw error;
      await invalidateMeds();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create medication');
      return false;
    }
  }, [user, invalidateMeds]);

  const updateMedication = useCallback(async (
    medicationId: string,
    patch: Partial<Pick<FinmedMedication, 'name' | 'form' | 'unit' | 'stock_quantity' | 'stock_low_threshold' | 'notes'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://finmed_medications', { source: 'finmed.detail_sheet', action: 'updateMedication' });
      const { error } = await supabase.from('finmed_medications').update(patch).eq('id', medicationId);
      if (error) throw error;
      await invalidateMeds();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update medication');
      return false;
    }
  }, [invalidateMeds]);

  const deleteMedication = useCallback(async (medicationId: string): Promise<boolean> => {
    try {
      logAPI('supabase://finmed_medications', { source: 'finmed.detail_sheet', action: 'deleteMedication' });
      const { error } = await supabase.from('finmed_medications').delete().eq('id', medicationId);
      if (error) throw error;
      await invalidateMeds();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete medication');
      return false;
    }
  }, [invalidateMeds]);

  const createSchedule = useCallback(async (
    medicationId: string,
    schedule: Omit<FinmedSchedule, 'id' | 'medication_id' | 'user_id' | 'created_at'>,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_schedules', { source: 'finmed.schedule_modal', action: 'createSchedule' });
      const { error } = await supabase.from('finmed_schedules').insert({
        user_id: user.id, medication_id: medicationId, ...schedule,
      });
      if (error) throw error;
      await loadSchedules(medicationId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create schedule');
      return false;
    }
  }, [user, loadSchedules]);

  const deactivateSchedule = useCallback(async (scheduleId: string, medicationId: string): Promise<boolean> => {
    try {
      logAPI('supabase://finmed_schedules', { source: 'finmed.detail_sheet', action: 'deactivateSchedule' });
      const { error } = await supabase.from('finmed_schedules').update({ active: false }).eq('id', scheduleId);
      if (error) throw error;
      await loadSchedules(medicationId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to deactivate schedule');
      return false;
    }
  }, [loadSchedules]);

  const logIntake = useCallback(async (
    medication: FinmedMedication, scheduleId: string | null,
    doseAmount: number, note: string | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_intake_logs', { source: 'finmed.detail_sheet', action: 'logIntake' });
      const { error: logError } = await supabase.from('finmed_intake_logs').insert({
        user_id: user.id, medication_id: medication.id,
        schedule_id: scheduleId, taken_at: new Date().toISOString(),
        dose_amount: doseAmount, note,
      });
      if (logError) throw logError;
      const newStock = Math.max(0, medication.stock_quantity - doseAmount);
      const { error: stockError } = await supabase
        .from('finmed_medications').update({ stock_quantity: newStock }).eq('id', medication.id);
      if (stockError) throw stockError;
      if (newStock <= medication.stock_low_threshold) {
        await scheduleStockAlert({ ...medication, stock_quantity: newStock });
      }
      await invalidateMeds();
      await loadIntakeLogs(medication.id);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to log intake');
      return false;
    }
  }, [user, invalidateMeds, loadIntakeLogs]);

  const createStockTransaction = useCallback(async (
    medication: FinmedMedication, transactionId: string,
    quantityAdded: number, priceAllocated: number,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_stock_transactions', { source: 'finmed.detail_sheet', action: 'createStockTransaction' });
      const { error: txError } = await supabase.from('finmed_stock_transactions').insert({
        user_id: user.id, medication_id: medication.id,
        transaction_id: transactionId, quantity_added: quantityAdded, price_allocated: priceAllocated,
      });
      if (txError) throw txError;
      const { error: stockError } = await supabase
        .from('finmed_medications').update({ stock_quantity: medication.stock_quantity + quantityAdded }).eq('id', medication.id);
      if (stockError) throw stockError;
      await invalidateMeds();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to link transaction');
      return false;
    }
  }, [user, invalidateMeds]);

  // ─── Reminders ───────────────────────────────────────────────────────────────

  const { data: reminders = [], isLoading: remindersLoading } = useQuery({
    queryKey: finmedRemindersQueryKey(userId),
    queryFn: async () => {
      logAPI('supabase://finmed_reminders', { source: 'finmed.screen', action: 'loadReminders' });
      const { data, error } = await supabase
        .from('finmed_reminders')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      return (data ?? []) as FinmedReminder[];
    },
    enabled: !!userId,
  });

  const invalidateReminders = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: finmedRemindersQueryKey(userId) });
  }, [queryClient, userId]);

  // Reschedule notifications for all active reminders on first load after boot.
  // Runs once per mount so notifications survive app restarts.
  const scheduledRef = useRef(false);
  useEffect(() => {
    if (reminders.length === 0 || scheduledRef.current) return;
    scheduledRef.current = true;
    void (async () => {
      for (const reminder of reminders) {
        if (!reminder.active) continue;
        await cancelIntakeReminder(reminder);
        await scheduleIntakeReminder(reminder);
      }
    })();
  }, [reminders]);

  const saveReminder = useCallback(async (
    reminder: Omit<FinmedReminder, 'id' | 'user_id' | 'created_at'> & { id?: string },
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_reminders', { source: 'finmed.reminder_setup', action: 'saveReminder' });
      // strip client-only fields before writing to DB
      const { notification_ids: _ids, id: maybeId, ...payload } = reminder as FinmedReminder & { id?: string };
      if (maybeId) {
        const old = reminders.find(r => r.id === maybeId);
        if (old) await cancelIntakeReminder(old);
        const { error } = await supabase.from('finmed_reminders').update(payload).eq('id', maybeId);
        if (error) throw error;
        if (old && payload.active) await scheduleIntakeReminder({ ...old, ...payload, id: maybeId });
      } else {
        const { data, error } = await supabase.from('finmed_reminders').insert({
          user_id: user.id, ...payload,
        }).select().single();
        if (error) throw error;
        await scheduleIntakeReminder(data as FinmedReminder);
      }
      await invalidateReminders();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to save reminder');
      return false;
    }
  }, [user, invalidateReminders, reminders]);

  const deleteReminder = useCallback(async (id: string): Promise<boolean> => {
    try {
      logAPI('supabase://finmed_reminders', { source: 'finmed.treatment', action: 'deleteReminder' });
      const reminder = reminders.find(r => r.id === id);
      const { error } = await supabase.from('finmed_reminders').update({ active: false }).eq('id', id);
      if (error) throw error;
      if (reminder) await cancelIntakeReminder(reminder);
      await invalidateReminders();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete reminder');
      return false;
    }
  }, [invalidateReminders, reminders]);

  const logReminderAction = useCallback(async (
    reminderId: string,
    action: 'complete' | 'ignore' | 'snooze',
    value?: ReminderLogValue,
    note?: string,
    snoozedUntil?: string,
    slotIndex?: number,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_reminder_logs', { source: 'finmed.log_sheet', action: 'logReminderAction' });
      const now = new Date().toISOString();
      const { error } = await supabase.from('finmed_reminder_logs').insert({
        user_id: user.id,
        reminder_id: reminderId,
        scheduled_for: now,
        action,
        completed_at: action === 'complete' ? now : null,
        ignored_at: action === 'ignore' ? now : null,
        snoozed_until: action === 'snooze' ? (snoozedUntil ?? null) : null,
        value: value ?? null,
        note: note ?? null,
        metadata: slotIndex !== undefined ? { slotIndex } : null,
      });
      if (error) throw error;

      const reminder = reminders.find(r => r.id === reminderId);
      if (!reminder) return true;

      if (action === 'complete' || action === 'ignore') {
        // For multiple_times_daily, only cancel notifications for the specific slot
        if (reminder.frequency_type === 'multiple_times_daily' && slotIndex !== undefined) {
          await cancelReminderTimeSlot(
            reminderId,
            slotIndex,
            reminder.max_repeat_window_minutes,
          );
        } else {
          // For other frequencies, cancel all notifications for this reminder
          await cancelIntakeReminder(reminder);
        }
      } else if (action === 'snooze' && snoozedUntil && slotIndex !== undefined) {
        // Reschedule from snoozed time
        const snoozedDate = new Date(snoozedUntil);
        await rescheduleAfterSnooze(reminder, slotIndex, snoozedDate);
      }

      await queryClient.invalidateQueries({ queryKey: ['finmed_reminder_logs', userId] });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to log action');
      return false;
    }
  }, [user, queryClient, userId, reminders]);

  const getReminderLogs = useCallback(async (reminderId?: string): Promise<FinmedReminderLog[]> => {
    try {
      logAPI('supabase://finmed_reminder_logs', { source: 'finmed.progress', action: 'getReminderLogs' });
      let q = supabase
        .from('finmed_reminder_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (reminderId) q = q.eq('reminder_id', reminderId);
      const { data, error } = await q;
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      return (data ?? []) as FinmedReminderLog[];
    } catch {
      return [];
    }
  }, []);

  // ─── Persistent symptoms ─────────────────────────────────────────────────────

  const { data: persistentSymptoms = [] } = useQuery({
    queryKey: finmedPersistentSymptomsQueryKey(userId),
    queryFn: async () => {
      logAPI('supabase://finmed_persistent_symptoms', { source: 'finmed.symptom_check', action: 'getPersistentSymptoms' });
      const { data, error } = await supabase
        .from('finmed_persistent_symptoms')
        .select('*')
        .order('symptom_name', { ascending: true });
      if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
      }
      return (data ?? []) as PersistentSymptom[];
    },
    enabled: !!userId,
  });

  const addPersistentSymptom = useCallback(async (name: string, isCustom = false): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_persistent_symptoms', { source: 'finmed.symptom_check', action: 'addPersistentSymptom' });
      const { error } = await supabase.from('finmed_persistent_symptoms').upsert(
        { user_id: user.id, symptom_name: name, is_custom: isCustom },
        { onConflict: 'user_id,symptom_name' },
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finmedPersistentSymptomsQueryKey(userId) });
      return true;
    } catch {
      return false;
    }
  }, [user, queryClient, userId]);

  const removePersistentSymptom = useCallback(async (name: string): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_persistent_symptoms', { source: 'finmed.symptom_check', action: 'removePersistentSymptom' });
      const { error } = await supabase.from('finmed_persistent_symptoms')
        .delete().eq('user_id', user.id).eq('symptom_name', name);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finmedPersistentSymptomsQueryKey(userId) });
      return true;
    } catch {
      return false;
    }
  }, [user, queryClient, userId]);

  // ─── Derived: today's reminder slots ─────────────────────────────────────────

  const getTodayReminders = useCallback((): Array<{ reminder: FinmedReminder; time: string | null }> => {
    const now = new Date();
    const todayDow = now.getDay();
    const todayStr = now.toISOString().slice(0, 10);

    return reminders
      .filter((r) => r.active && r.start_date <= todayStr && (!r.end_date || r.end_date >= todayStr))
      .flatMap((r) => {
        if (r.frequency_type === 'on_demand') return [];
        if (r.type === 'appointment') {
          const cfg = r.type_config as { date?: string; time?: string };
          if (cfg.date === todayStr) return [{ reminder: r, time: cfg.time ?? null }];
          return [];
        }
        const fc = r.frequency_config;
        if (r.frequency_type === 'multiple_times_daily') {
          return (fc.times ?? ['08:00']).map((t) => ({ reminder: r, time: t }));
        }
        if (r.frequency_type === 'specific_day_of_week') {
          if (!(fc.weekdays ?? []).includes(todayDow)) return [];
          return [{ reminder: r, time: null }];
        }
        // interval / cyclic — show once without specific time
        return [{ reminder: r, time: null }];
      })
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  }, [reminders]);

  return {
    // legacy medication API
    medications, loading,
    schedulesByMed, intakeLogsByMed,
    loadSchedules, loadIntakeLogs,
    createMedication, updateMedication, deleteMedication,
    createSchedule, deactivateSchedule,
    logIntake, createStockTransaction,
    // category transaction picker
    categoryTransactions, loadCategoryTransactions,
    // reminder API
    reminders, remindersLoading,
    saveReminder, deleteReminder,
    logReminderAction, getReminderLogs,
    getTodayReminders,
    // persistent symptoms API
    persistentSymptoms,
    addPersistentSymptom, removePersistentSymptom,
  };
}
