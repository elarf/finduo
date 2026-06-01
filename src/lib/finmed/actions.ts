import { supabase } from '../supabase';
import { scheduleStockAlert } from './notifications';
import type { FinmedMedication } from '../../types/finmed';

export async function confirmMedicationIntake(
  userId: string,
  medication: FinmedMedication,
  scheduleId: string | null,
  doseAmount: number,
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Log intake
    const { error: logError } = await supabase.from('finmed_intake_logs').insert({
      user_id: userId,
      medication_id: medication.id,
      schedule_id: scheduleId,
      taken_at: new Date().toISOString(),
      dose_amount: doseAmount,
      note,
    });
    if (logError) throw logError;

    // Update stock
    const newStock = Math.max(0, medication.stock_quantity - doseAmount);
    const { error: stockError } = await supabase
      .from('finmed_medications')
      .update({ stock_quantity: newStock })
      .eq('id', medication.id);
    if (stockError) throw stockError;

    // Check for low stock alert
    if (newStock <= medication.stock_low_threshold) {
      await scheduleStockAlert({ ...medication, stock_quantity: newStock });
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to confirm intake',
    };
  }
}
