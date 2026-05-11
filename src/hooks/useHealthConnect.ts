import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import {
  readHealthConnectData,
  requestHealthConnectPermissions,
  HealthConnectTrackingProvider,
} from '../lib/fingo/tracking/HealthConnectTrackingProvider';
import type { HCRecord } from '../lib/fingo/tracking/HealthConnectTrackingProvider';

export type { HCRecord };

export function useHealthConnect() {
  const isAvailable = Platform.OS === 'android';

  const [records, setRecords] = useState<HCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const granted = await requestHealthConnectPermissions();
    setHasPermission(granted);
    return granted;
  }, []);

  const fetchRecords = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const data = await readHealthConnectData(start, end);
      setRecords(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read Health Connect data');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSdkAvailable = useCallback(async (): Promise<boolean> => {
    const provider = new HealthConnectTrackingProvider();
    return provider.isAvailable();
  }, []);

  return { isAvailable, records, loading, error, hasPermission, requestPermissions, fetchRecords, checkSdkAvailable };
}
