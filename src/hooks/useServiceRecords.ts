import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';
import type { ComponentServiceRecord, ServiceIntervalType } from '../types/fingo';

export function useServiceRecords(user: User | null) {
  const [records, setRecords] = useState<ComponentServiceRecord[]>([]);

  const loadRecords = useCallback(async (assetId: string) => {
    try {
      logAPI('supabase://component_service_records', { source: 'fingo.asset_accordion.stats', action: 'loadRecords' });
      const { data, error } = await supabase
        .from('component_service_records')
        .select('*')
        .eq('asset_id', assetId)
        .order('serviced_at', { ascending: false });
      if (error) throw error;
      setRecords((data ?? []) as ComponentServiceRecord[]);
    } catch (err) {
      if (!isMissingTableError(err)) {
        webAlert('Error', err instanceof Error ? err.message : 'Failed to load service records');
      }
    }
  }, []);

  const createRecord = useCallback(async (
    assetId: string,
    componentId: string | null,
    name: string,
    servicedAt: string,
    notes?: string | null,
    cost?: number | null,
    serviceType?: ServiceIntervalType | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://component_service_records', { source: 'fingo.service_record_sheet', action: 'create' });
      const { error } = await supabase
        .from('component_service_records')
        .insert({
          asset_id: assetId,
          component_id: componentId,
          name,
          service_type: serviceType ?? null,
          serviced_at: servicedAt,
          notes: notes ?? null,
          cost: cost ?? null,
          created_by: user.id,
        });
      if (error) throw error;
      await loadRecords(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create service record');
      return false;
    }
  }, [user, loadRecords]);

  const updateRecord = useCallback(async (
    id: string,
    assetId: string,
    fields: { name: string; serviced_at: string; notes: string | null; cost: number | null; service_type?: ServiceIntervalType | null },
  ): Promise<boolean> => {
    try {
      logAPI('supabase://component_service_records', { source: 'fingo.service_record_sheet', action: 'update' });
      const { error } = await supabase
        .from('component_service_records')
        .update({ name: fields.name, serviced_at: fields.serviced_at, notes: fields.notes, cost: fields.cost, service_type: fields.service_type ?? null })
        .eq('id', id);
      if (error) throw error;
      await loadRecords(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update service record');
      return false;
    }
  }, [loadRecords]);

  const deleteRecord = useCallback(async (id: string, assetId: string): Promise<boolean> => {
    try {
      logAPI('supabase://component_service_records', { source: 'fingo.asset_accordion.stats', action: 'deleteRecord' });
      const { error } = await supabase.from('component_service_records').delete().eq('id', id);
      if (error) throw error;
      await loadRecords(assetId);
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete service record');
      return false;
    }
  }, [loadRecords]);

  const totalServiceCost = records.reduce((sum, r) => sum + (r.cost ?? 0), 0);

  return { records, totalServiceCost, loadRecords, createRecord, updateRecord, deleteRecord };
}
