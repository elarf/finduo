# Background GPS Tracking — Implementation Guide

<!-- markdownlint-disable MD013 MD031 -->

## Current State

GPS tracking uses `@capacitor/geolocation` `watchPosition()`, which only fires while the app is in the **foreground**. When the user taps the Tracking shortcut and the app minimizes, position updates stop. Elapsed time is always accurate (derived from stored `started_at`), but route coordinates and distance will be 0 unless the app stayed visible.

---

## What Needs to Change

### 1. Install a background geolocation plugin

The standard Capacitor Geolocation plugin does not support background operation. Use one of:

**Option A — `@transistorsoft/capacitor-background-geolocation`** (recommended, production-grade, paid license for commercial use)
```bash
npm install @transistorsoft/capacitor-background-geolocation
npx cap sync android
```

**Option B — `@capacitor-community/background-geolocation`** (open-source, simpler)
```bash
npm install @capacitor-community/background-geolocation
npx cap sync android
```

---

### 2. Android manifest additions

In `android/app/src/main/AndroidManifest.xml`, add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

For Option A (transistorsoft), also register their service and boot receiver — see their docs.

For Option B (community plugin), register the background service:
```xml
<service
    android:name="com.equimapper.capacitor.backgroundgeolocation.BGSLocationService"
    android:foregroundServiceType="location"
    android:exported="false" />
```

---

### 3. Request `ACCESS_BACKGROUND_LOCATION` permission

Android 10+ requires a separate runtime prompt for background location. The user must select **"Allow all the time"** (not just "While using the app").

Update `GpsTrackingProvider.ts`:
```typescript
// Replace the existing requestPermissions call:
await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
// Then separately request background (shows system dialog):
// For transistorsoft: handled by their BackgroundGeolocation.ready() config
// For community plugin: no separate call needed if manifest is set
```

---

### 4. Rewrite `GpsTrackingProvider.ts`

Replace the current `watchPosition` implementation with the background plugin.

**Using `@capacitor-community/background-geolocation`:**

```typescript
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';

async startSession(): Promise<void> {
  this.points = [];
  const watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: 'Recording your route…',
      backgroundTitle: 'FinDuo Tracking',
      requestPermissions: true,
      stale: false,
      distanceFilter: 10, // meters, reduces noise
    },
    (location, error) => {
      if (error || !location) return;
      this.points.push({ lat: location.latitude, lng: location.longitude, ts: location.time });
    },
  );
  this.watchId = watcherId;
}

async stopSession(): Promise<{ distanceKm: number; route: RoutePoint[] }> {
  if (this.watchId) {
    await BackgroundGeolocation.removeWatcher({ id: this.watchId });
    this.watchId = null;
  }
  // ... rest unchanged
}
```

---

### 5. Route data persistence across cold-start stops

Currently, `GpsTrackingProvider` holds collected points in memory (`this.points`). If the app is killed mid-session and the user taps the shortcut to stop, the route is empty.

**Fix:** Persist points to AsyncStorage as they arrive, then load them on stop:

```typescript
// In the watcher callback:
this.points.push(point);
// Debounced write every ~10 points to avoid excessive I/O:
if (this.points.length % 10 === 0) {
  void AsyncStorage.setItem('FINGO_ROUTE_BUFFER', JSON.stringify(this.points));
}

// In stopSession(), before clearing:
const buffered = await AsyncStorage.getItem('FINGO_ROUTE_BUFFER');
if (buffered && this.points.length === 0) {
  this.points = JSON.parse(buffered);
}
await AsyncStorage.removeItem('FINGO_ROUTE_BUFFER');
```

---

### 6. `distanceFilter` tuning

Set `distanceFilter: 10` (meters) to avoid recording stationary noise. For cycling, 5–15 m is a good range. Too low = noisy route; too high = missed corners.

---

### 7. Battery / notification

Android requires a persistent **foreground service notification** for background location. Both plugins handle this automatically. You can customise the notification text via their config (see step 4 above — `backgroundMessage` / `backgroundTitle`).

---

## Checklist

- [ ] Choose and install background plugin (transistorsoft or community)
- [ ] Add Android manifest permissions and service entry
- [ ] Rewrite `GpsTrackingProvider.startSession()` / `stopSession()` to use new plugin
- [ ] Add AsyncStorage route buffer for cold-start stop recovery
- [ ] Test "Allow all the time" permission flow on device
- [ ] Tune `distanceFilter` for your typical exercise speed
- [ ] Verify foreground service notification appears correctly
- [ ] Run `npm run build:android` and test full shortcut → minimize → exercise → shortcut → stop flow
