/**
 * ITrackingProvider — contract for all future tracking backends.
 *
 * Phase 1: ManualTrackingProvider (odometer input)
 * Phase 2: CapacitorTrackingProvider (GPS, route, elevation)
 * Phase 3: HealthConnectTrackingProvider (steps, bike rides)
 */

export type TrackingMode = 'manual' | 'gps' | 'health_connect';

export interface ITrackingProvider {
  readonly mode: TrackingMode;
  /** Returns true if this provider is available in the current environment */
  isAvailable(): Promise<boolean>;
}
