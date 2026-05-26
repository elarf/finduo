import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { cancelIntervalNotifications } from '../lib/fingo/notifications';
import { isMissingTableError } from '../types/dashboard';
import type { ComponentServiceInterval, TrackingMethod, ServiceIntervalType } from '../types/fingo';

export function useServiceIntervals() {
  const [intervals, setIntervals] = useState<Record<string, ComponentServiceInterval[]>>({});

  const loadIntervals = useCallback(async (componentId: string) => {
    try {
      logAPI('supabase://component_service_intervals', { source: 'fingo.component_row', action: 'loadIntervals' });
      const { data, error } = await supabase
        .from('component_service_intervals')
        .select('*')
        .eq('component_id', componentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setIntervals((prev) => ({ ...prev, [componentId]: (data ?? []) as ComponentServiceInterval[] }));
    } catch (err) {
      if (!isMissingTableError(err)) {
        webAlert('Error', err instanceof Error ? err.message : 'Failed to load service intervals');
      }
    }
  }, []);

  const createInterval = useCallback(async (
    componentId: string,
    name: string,
    trackingMethod: TrackingMethod,
    intervalValue: number,
    serviceType: ServiceIntervalType = 'general',
  ): Promise<boolean> => {
    try {
      logAPI('supabase://component_service_intervals', { source: 'fingo.service_interval_sheet', action: 'create' });
      const { error } = await supabase
        .from('component_service_intervals')
        .insert({ component_id: componentId, name, tracking_method: trackingMethod, interval_value: intervalValue, service_type: serviceType });
      if (error) throw error;
      await loadIntervals(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create interval');
      return false;
    }
  }, [loadIntervals]);

  const updateInterval = useCallback(async (
    id: string,
    componentId: string,
    patch: Partial<Pick<ComponentServiceInterval, 'name' | 'tracking_method' | 'interval_value' | 'service_type'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://component_service_intervals', { source: 'fingo.service_interval_sheet', action: 'update' });
      const { error } = await supabase.from('component_service_intervals').update(patch).eq('id', id);
      if (error) throw error;
      await loadIntervals(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update interval');
      return false;
    }
  }, [loadIntervals]);

  const deleteInterval = useCallback(async (id: string, componentId: string): Promise<boolean> => {
    try {
      logAPI('supabase://component_service_intervals', { source: 'fingo.component_row', action: 'deleteInterval' });
      const { error } = await supabase.from('component_service_intervals').delete().eq('id', id);
      if (error) throw error;
      await loadIntervals(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete interval');
      return false;
    }
  }, [loadIntervals]);

  /** Mark all intervals on a component as serviced at the given tracking value */
  const markServiced = useCallback(async (
    intervalId: string,
    componentId: string,
    currentValue: number,
    servicedAt?: string | null,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://component_service_intervals', { source: 'fingo.component_row', action: 'markServiced' });
      const patch: Record<string, unknown> = { last_serviced_value: currentValue };
      if (servicedAt) patch.last_serviced_at = servicedAt;
      const { error } = await supabase
        .from('component_service_intervals')
        .update(patch)
        .eq('id', intervalId);
      if (error) throw error;
      cancelIntervalNotifications([intervalId]).catch(() => {});
      await loadIntervals(componentId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to mark serviced');
      return false;
    }
  }, [loadIntervals]);

  return { intervals, loadIntervals, createInterval, updateInterval, deleteInterval, markServiced };
}
