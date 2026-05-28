import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';
import type { FinmedMedication, FinmedSchedule, FinmedIntakeLog } from '../types/finmed';

export const finmedMedsQueryKey = (userId: string | undefined) =>
  ['finmed_medications', userId] as const;

export function useFinmed(user: User | null) {
  const queryClient = useQueryClient();
  const userId = user?.id;

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

  const invalidateMeds = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: finmedMedsQueryKey(userId) });
  }, [queryClient, userId]);

  const createMedication = useCallback(async (
    name: string,
    form: string,
    unit: string,
    stock_quantity: number,
    stock_low_threshold: number,
    notes: string | null,
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
        user_id: user.id,
        medication_id: medicationId,
        ...schedule,
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
    medication: FinmedMedication,
    scheduleId: string | null,
    doseAmount: number,
    note: string | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_intake_logs', { source: 'finmed.detail_sheet', action: 'logIntake' });
      const { error: logError } = await supabase.from('finmed_intake_logs').insert({
        user_id: user.id,
        medication_id: medication.id,
        schedule_id: scheduleId,
        taken_at: new Date().toISOString(),
        dose_amount: doseAmount,
        note,
      });
      if (logError) throw logError;
      const newStock = Math.max(0, medication.stock_quantity - doseAmount);
      const { error: stockError } = await supabase
        .from('finmed_medications')
        .update({ stock_quantity: newStock })
        .eq('id', medication.id);
      if (stockError) throw stockError;
      await invalidateMeds();
      await loadIntakeLogs(medication.id);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to log intake');
      return false;
    }
  }, [user, invalidateMeds, loadIntakeLogs]);

  const createStockTransaction = useCallback(async (
    medication: FinmedMedication,
    transactionId: string,
    quantityAdded: number,
    priceAllocated: number,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finmed_stock_transactions', { source: 'finmed.detail_sheet', action: 'createStockTransaction' });
      const { error: txError } = await supabase.from('finmed_stock_transactions').insert({
        user_id: user.id,
        medication_id: medication.id,
        transaction_id: transactionId,
        quantity_added: quantityAdded,
        price_allocated: priceAllocated,
      });
      if (txError) throw txError;
      const { error: stockError } = await supabase
        .from('finmed_medications')
        .update({ stock_quantity: medication.stock_quantity + quantityAdded })
        .eq('id', medication.id);
      if (stockError) throw stockError;
      await invalidateMeds();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to link transaction');
      return false;
    }
  }, [user, invalidateMeds]);

  return {
    medications,
    loading,
    schedulesByMed,
    intakeLogsByMed,
    loadSchedules,
    loadIntakeLogs,
    createMedication,
    updateMedication,
    deleteMedication,
    createSchedule,
    deactivateSchedule,
    logIntake,
    createStockTransaction,
  };
}
