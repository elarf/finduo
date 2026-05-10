import { Capacitor } from '@capacitor/core';
import type { ITrackingProvider } from './ITrackingProvider';

/**
 * GpsTrackingProvider — Phase 2 (Capacitor/native).
 *
 * isAvailable() returns true only when running as a native Capacitor app.
 * startSession() / stopSession() are Phase 2 stubs — wire to
 * @capacitor/geolocation when the GO button is activated.
 */
export class GpsTrackingProvider implements ITrackingProvider {
  readonly mode = 'gps' as const;

  async isAvailable(): Promise<boolean> {
    return Capacitor.isNativePlatform();
  }

  // Phase 2: uncomment and import { Geolocation } from '@capacitor/geolocation'
  // async startSession(assetId: string): Promise<void> { ... }
  // async stopSession(): Promise<{ distanceKm: number }> { ... }
}
