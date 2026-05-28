import { Capacitor, registerPlugin } from '@capacitor/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { ITrackingProvider } from './ITrackingProvider';
import type { RoutePoint } from '../../types/fingo';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation',
);

const ROUTE_BUFFER_KEY = 'FINGO_ROUTE_BUFFER';
// Flush the route buffer to AsyncStorage every N points so progress survives
// if the app is killed while a session is active.
const BUFFER_FLUSH_EVERY = 10;

export class GpsTrackingProvider implements ITrackingProvider {
  readonly mode = 'gps' as const;
  private watchId: string | null = null;
  private points: RoutePoint[] = [];

  async isAvailable(): Promise<boolean> {
    return Capacitor.isNativePlatform();
  }

  async startSession(): Promise<void> {
    await AsyncStorage.removeItem(ROUTE_BUFFER_KEY);
    this.points = [];
    await this.attachWatcher();
  }

  async pauseSession(): Promise<void> {
    if (this.watchId !== null) {
      await BackgroundGeolocation.removeWatcher({ id: this.watchId });
      this.watchId = null;
    }
    if (this.points.length > 0) {
      await AsyncStorage.setItem(ROUTE_BUFFER_KEY, JSON.stringify(this.points));
    }
  }

  async resumeSession(): Promise<void> {
    if (this.points.length === 0) {
      const buffered = await AsyncStorage.getItem(ROUTE_BUFFER_KEY);
      if (buffered) this.points = JSON.parse(buffered) as RoutePoint[];
    }
    await this.attachWatcher();
  }

  async stopSession(): Promise<{ distanceKm: number; route: RoutePoint[] }> {
    if (this.watchId !== null) {
      await BackgroundGeolocation.removeWatcher({ id: this.watchId });
      this.watchId = null;
    }

    // Recover points from AsyncStorage if the app was killed mid-session
    // and the in-memory array is empty.
    if (this.points.length === 0) {
      const buffered = await AsyncStorage.getItem(ROUTE_BUFFER_KEY);
      if (buffered) this.points = JSON.parse(buffered) as RoutePoint[];
    }

    await AsyncStorage.removeItem(ROUTE_BUFFER_KEY);

    const route = [...this.points];
    const distanceKm = this.calcDistance(route);
    this.points = [];

    return { distanceKm, route };
  }

  private async attachWatcher(): Promise<void> {
    this.watchId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Recording your route…',
        backgroundTitle: 'FinDuo Tracking',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      },
      (location, error) => {
        if (error || !location) return;
        this.points.push({
          lat: location.latitude,
          lng: location.longitude,
          ts: location.time ?? Date.now(),
        });
        if (this.points.length % BUFFER_FLUSH_EVERY === 0) {
          void AsyncStorage.setItem(ROUTE_BUFFER_KEY, JSON.stringify(this.points));
        }
      },
    );
  }

  isSessionActive(): boolean {
    return this.watchId !== null;
  }

  getCurrentDistance(): number {
    return this.calcDistance(this.points);
  }

  private calcDistance(points: RoutePoint[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.haversine(points[i - 1], points[i]);
    }
    return Math.round(total * 1000) / 1000;
  }

  private haversine(a: RoutePoint, b: RoutePoint): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(s));
  }
}
