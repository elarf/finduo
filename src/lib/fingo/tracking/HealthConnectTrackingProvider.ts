import { Capacitor } from '@capacitor/core';
import HealthConnectBridge from './HealthConnectCapacitorBridge';
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
  dataOrigin?: string;
  calories?: number;
};

const SDK_AVAILABLE = 3;

export class HealthConnectTrackingProvider implements ITrackingProvider {
  readonly mode = 'health_connect' as const;

  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { status } = await HealthConnectBridge.getSdkStatus();
      return status === SDK_AVAILABLE;
    } catch {
      return false;
    }
  }
}

export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { granted } = await HealthConnectBridge.requestPermission();
    return granted.length > 0;
  } catch {
    return false;
  }
}

export async function readHealthConnectData(startDate: Date, endDate: Date): Promise<HCRecord[]> {
  if (!Capacitor.isNativePlatform()) return [];

  const startTime = startDate.toISOString();
  const endTime = endDate.toISOString();

  const [stepsResult, distanceResult, exerciseResult, caloriesResult] = await Promise.allSettled([
    HealthConnectBridge.readRecords({ recordType: 'Steps', startTime, endTime }),
    HealthConnectBridge.readRecords({ recordType: 'Distance', startTime, endTime }),
    HealthConnectBridge.readRecords({ recordType: 'ExerciseSession', startTime, endTime }),
    HealthConnectBridge.readRecords({ recordType: 'ActiveCaloriesBurned', startTime, endTime }),
  ]);

  const records: HCRecord[] = [];

  if (stepsResult.status === 'fulfilled') {
    for (const r of stepsResult.value.records) {
      records.push({
        id: r.id ?? `steps-${r.startTime}`,
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
        id: r.id ?? `dist-${r.startTime}`,
        type: 'distance',
        startTime: r.startTime,
        endTime: r.endTime,
        distanceKm: (r.distanceMeters ?? 0) / 1000,
      });
    }
  }

  if (exerciseResult.status === 'fulfilled') {
    for (const r of exerciseResult.value.records) {
      const movingTimeMin =
        (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000;
      records.push({
        id: r.id ?? `exercise-${r.startTime}`,
        type: 'exercise',
        startTime: r.startTime,
        endTime: r.endTime,
        movingTimeMin,
        activityType: String(r.exerciseType ?? ''),
        dataOrigin: r.dataOrigin,
      });
    }
  }

  if (caloriesResult.status === 'fulfilled') {
    for (const r of caloriesResult.value.records) {
      records.push({
        id: r.id ?? `cal-${r.startTime}`,
        type: 'calories',
        startTime: r.startTime,
        endTime: r.endTime,
        calories: r.energyKcal,
      });
    }
  }

  return records.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
