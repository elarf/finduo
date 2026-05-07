import type { ITrackingProvider } from './ITrackingProvider';
import { ManualTrackingProvider } from './ManualTrackingProvider';

/**
 * TrackingService — singleton that holds the active tracking provider.
 *
 * Swap providers without touching any UI code:
 *
 *   // When Capacitor is installed:
 *   import { CapacitorTrackingProvider } from './CapacitorTrackingProvider';
 *   TrackingService.setProvider(new CapacitorTrackingProvider());
 */
let _provider: ITrackingProvider = new ManualTrackingProvider();

export const TrackingService = {
  get provider(): ITrackingProvider {
    return _provider;
  },
  setProvider(p: ITrackingProvider): void {
    _provider = p;
  },
};
