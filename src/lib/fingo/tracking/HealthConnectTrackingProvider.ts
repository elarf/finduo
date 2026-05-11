import { Platform } from 'react-native';
import type { ITrackingProvider } from './ITrackingProvider';

export type HCRecord = {
  id: string;
  type: 'steps' | 'distance' | 'exercise' | 'calories';
  startTime: string;
  endTime: string;
  steps?: number;
  distanceKm?: number;
  movingTimeMin?: number;
  elevationGainM?: number;
  activityType?: string;
  calories?: number;
};

export class HealthConnectTrackingProvider implements ITrackingProvider {
  readonly mode = 'health_connect' as const;

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const { getSdkStatus, SdkAvailabilityStatus } = await import('react-native-health-connect');
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  }
}

export async function readHealthConnectData(startDate: Date, endDate: Date): Promise<HCRecord[]> {
  if (Platform.OS !== 'android') return [];

  try {
    const {
      readRecords,
    } = await import('react-native-health-connect');

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const [stepsResult, distanceResult, exerciseResult, caloriesResult] = await Promise.allSettled([
      readRecords('Steps', { timeRangeFilter }),
      readRecords('Distance', { timeRangeFilter }),
      readRecords('ExerciseSession', { timeRangeFilter }),
      readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
    ]);

    const records: HCRecord[] = [];

    if (stepsResult.status === 'fulfilled') {
      for (const r of stepsResult.value.records) {
        records.push({
          id: r.metadata?.id ?? `steps-${r.startTime}`,
          type: 'steps',
          startTime: r.startTime,
          endTime: r.endTime,
          steps: r.count,
        });
      }
    }

    if (distanceResult.status === 'fulfilled') {
      for (const r of distanceResult.value.records) {
        records.push({
          id: r.metadata?.id ?? `dist-${r.startTime}`,
          type: 'distance',
          startTime: r.startTime,
          endTime: r.endTime,
          distanceKm: (r.distance?.inMeters ?? 0) / 1000,
        });
      }
    }

    if (exerciseResult.status === 'fulfilled') {
      for (const r of exerciseResult.value.records) {
        const startMs = new Date(r.startTime).getTime();
        const endMs = new Date(r.endTime).getTime();
        const movingTimeMin = (endMs - startMs) / 60000;
        records.push({
          id: r.metadata?.id ?? `exercise-${r.startTime}`,
          type: 'exercise',
          startTime: r.startTime,
          endTime: r.endTime,
          distanceKm: r.exerciseType !== undefined ? undefined : undefined,
          movingTimeMin,
          activityType: String(r.exerciseType ?? ''),
        });
      }
    }

    if (caloriesResult.status === 'fulfilled') {
      for (const r of caloriesResult.value.records) {
        records.push({
          id: r.metadata?.id ?? `cal-${r.startTime}`,
          type: 'calories',
          startTime: r.startTime,
          endTime: r.endTime,
          calories: r.energy?.inKilocalories,
        });
      }
    }

    return records.sort((a, b) => b.startTime.localeCompare(a.startTime));
  } catch {
    return [];
  }
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const { requestPermission } = await import('react-native-health-connect');
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
    return granted.length > 0;
  } catch {
    return false;
  }
}
