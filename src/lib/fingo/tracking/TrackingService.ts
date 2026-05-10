import { Capacitor } from '@capacitor/core';
import type { ITrackingProvider } from './ITrackingProvider';
import { ManualTrackingProvider } from './ManualTrackingProvider';
import { GpsTrackingProvider } from './GpsTrackingProvider';

// Capacitor.isNativePlatform() is synchronous — safe at module init time.
// Web/PWA → ManualTrackingProvider; native APK → GpsTrackingProvider.
function buildProvider(): ITrackingProvider {
  if (Capacitor.isNativePlatform()) return new GpsTrackingProvider();
  return new ManualTrackingProvider();
}

let _provider: ITrackingProvider = buildProvider();

export const TrackingService = {
  get provider(): ITrackingProvider {
    return _provider;
  },
  setProvider(p: ITrackingProvider): void {
    _provider = p;
  },
};
