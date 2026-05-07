import type { ITrackingProvider } from './ITrackingProvider';

/**
 * ManualTrackingProvider — Phase 1 implementation.
 * All usage data comes from manual odometer/counter entries by the user.
 * No background processes, no sensors.
 */
export class ManualTrackingProvider implements ITrackingProvider {
  readonly mode = 'manual' as const;

  async isAvailable(): Promise<boolean> {
    return true; // always available — just form inputs
  }
}
