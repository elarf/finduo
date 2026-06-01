import { supabase } from '../supabase';
import { cancelIntervalNotifications } from './notifications';

export async function acknowledgeServiceInterval(
  userId: string,
  intervalId: string,
  componentId: string,
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update interval last_serviced_at
    const { error } = await supabase
      .from('component_service_intervals')
      .update({ last_serviced_at: new Date().toISOString() })
      .eq('id', intervalId);

    if (error) throw error;

    // Cancel any pending OS notifications for this interval
    await cancelIntervalNotifications([intervalId]);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to acknowledge service',
    };
  }
}
