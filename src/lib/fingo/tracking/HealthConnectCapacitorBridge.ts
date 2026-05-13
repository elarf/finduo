import { registerPlugin } from '@capacitor/core';

export interface HealthConnectCapacitorPlugin {
  getSdkStatus(): Promise<{ status: number }>;
  requestPermission(): Promise<{ granted: string[] }>;
  readRecords(options: {
    recordType: string;
    startTime: string;
    endTime: string;
  }): Promise<{ records: RawRecord[] }>;
}

export type RawRecord = {
  id: string;
  startTime: string;
  endTime: string;
  count?: number;
  distanceMeters?: number;
  exerciseType?: number;
  dataOrigin?: string;
  energyKcal?: number;
};

const HealthConnectBridge = registerPlugin<HealthConnectCapacitorPlugin>(
  'HealthConnect',
  {
    web: () => ({
      getSdkStatus: async () => ({ status: 1 }),
      requestPermission: async () => ({ granted: [] }),
      readRecords: async () => ({ records: [] }),
    }),
  },
);

export default HealthConnectBridge;
