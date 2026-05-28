# Android Background Sync — WorkManager Implementation

<!-- markdownlint-disable MD013 MD040 MD060 -->

## What this does

Registers a native Android WorkManager `PeriodicWorkRequest` that fires every hour,
even when the app is completely killed. It reads Health Connect records and caches a
"sync pending" flag in `SharedPreferences`. The next time the user opens the app,
`useHCAutoSync` detects the flag and calls `runHCAutoAttach()` immediately instead of
waiting for the JS hourly timer.

**Limitation (store-and-forward):** Supabase writes still happen in JS on next app
open — not silently in the background. The worker's job is: read HC data → persist it
→ ensure the sync runs the instant the app is next launched. This avoids rewriting the
TypeScript business logic in Kotlin. If you later want true silent background Supabase
writes (app stays killed, data uploaded), see the upgrade note at the bottom.

---

## Step 0 — Confirm your Android package name

Open `android/app/build.gradle` and find:

```gradle
android {
    defaultConfig {
        applicationId "com.finduo.???"   // <-- this is your package name
    }
}
```

`capacitor.config.ts` says `com.finduo.fingo`.  
`app.json` says `com.finduo.app`.  
**Whichever `applicationId` is in `build.gradle` is the truth.** Replace every
occurrence of `YOUR_PACKAGE` in this guide with that value.

---

## Step 1 — Add Gradle dependencies

File: `android/app/build.gradle`

Find the `dependencies { }` block and add:

```gradle
dependencies {
    // ... existing entries ...

    // WorkManager (Kotlin coroutines extension)
    implementation "androidx.work:work-runtime-ktx:2.9.1"

    // Health Connect client
    implementation "androidx.health.connect:connect-client:1.1.0-rc01"
}
```

After editing, sync Gradle in Android Studio (or `./gradlew dependencies` to verify).

---

## Step 2 — Create HCSyncWorker.kt

Create the file at:

```
android/app/src/main/java/YOUR_PACKAGE/HCSyncWorker.kt
```

Full contents:

```kotlin
package YOUR_PACKAGE

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

class HCSyncWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HCSyncWorker"
        const val WORK_NAME = "hc_auto_sync"
        const val PREFS_NAME = "hc_sync_prefs"
        const val KEY_PENDING_AT = "pending_sync_at"
        const val KEY_PENDING_SESSIONS = "pending_sessions"
        const val KEY_PENDING_STEPS = "pending_steps"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val request = PeriodicWorkRequestBuilder<HCSyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 15, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                // KEEP: don't reset the 1-hour clock on every app open
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.d(TAG, "Scheduled (KEEP policy)")
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Cancelled")
        }
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "doWork() started")
        return try {
            val client = HealthConnectClient.getOrCreate(context)
            val now = Instant.now()
            // Look back 25h to overlap with previous worker run and catch any late records
            val from = now.minus(25, ChronoUnit.HOURS)

            val sessions = readExerciseSessions(client, from, now)
            val steps = readSteps(client, from, now)

            // Store for JS to pick up on next app open
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putLong(KEY_PENDING_AT, System.currentTimeMillis())
                .putString(KEY_PENDING_SESSIONS, sessions.toString())
                .putString(KEY_PENDING_STEPS, steps.toString())
                .apply()

            Log.d(TAG, "Cached ${sessions.length()} sessions, ${steps.length()} step entries")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "doWork() failed: ${e.message}", e)
            Result.retry()
        }
    }

    private suspend fun readExerciseSessions(
        client: HealthConnectClient,
        from: Instant,
        to: Instant
    ): JSONArray {
        // Activity types 8 = BIKING, 9 = MOUNTAIN_BIKING — matches hcAutoAttach.ts
        val cyclingTypes = setOf(
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        )
        val response = client.readRecords(
            ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(from, to)
            )
        )
        val arr = JSONArray()
        response.records
            .filter { it.exerciseType in cyclingTypes }
            .forEach { r ->
                arr.put(JSONObject().apply {
                    put("id", r.metadata.id)
                    put("startTime", r.startTime.toString())
                    put("endTime", r.endTime.toString())
                    put("exerciseType", r.exerciseType)
                })
            }
        return arr
    }

    private suspend fun readSteps(
        client: HealthConnectClient,
        from: Instant,
        to: Instant
    ): JSONArray {
        val response = client.readRecords(
            ReadRecordsRequest(
                recordType = StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(from, to)
            )
        )
        // Aggregate per day — same synthetic ID format as hcAutoAttach.ts: "steps-YYYY-MM-DD"
        val byDay = response.records.groupBy { it.startTime.toString().substring(0, 10) }
        val arr = JSONArray()
        byDay.forEach { (date, records) ->
            arr.put(JSONObject().apply {
                put("id", "steps-$date")
                put("date", date)
                put("totalSteps", records.sumOf { it.count })
            })
        }
        return arr
    }
}
```

---

## Step 3 — Create HCSyncPlugin.kt

Create the file at:

```
android/app/src/main/java/YOUR_PACKAGE/HCSyncPlugin.kt
```

Full contents:

```kotlin
package YOUR_PACKAGE

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

@CapacitorPlugin(name = "HCSyncPlugin")
class HCSyncPlugin : Plugin() {

    @PluginMethod
    fun scheduleSync(call: PluginCall) {
        HCSyncWorker.schedule(context)
        call.resolve()
    }

    @PluginMethod
    fun cancelSync(call: PluginCall) {
        HCSyncWorker.cancel(context)
        call.resolve()
    }

    /**
     * Returns any cached records written by the last worker run, then clears them.
     * JS calls this on app open to decide whether to trigger an immediate sync.
     */
    @PluginMethod
    fun readPendingSync(call: PluginCall) {
        val prefs = context.getSharedPreferences(
            HCSyncWorker.PREFS_NAME, android.content.Context.MODE_PRIVATE
        )
        val pendingAt = prefs.getLong(HCSyncWorker.KEY_PENDING_AT, 0L)

        if (pendingAt == 0L) {
            // No pending data
            val ret = com.getcapacitor.JSObject()
            ret.put("pendingSyncAt", 0)
            call.resolve(ret)
            return
        }

        val ret = com.getcapacitor.JSObject()
        ret.put("pendingSyncAt", pendingAt)
        // Pass raw cached records so JS can log them for debugging if needed
        ret.put("sessions", prefs.getString(HCSyncWorker.KEY_PENDING_SESSIONS, "[]"))
        ret.put("steps", prefs.getString(HCSyncWorker.KEY_PENDING_STEPS, "[]"))

        // Clear — JS will now run the real sync via runHCAutoAttach()
        prefs.edit()
            .remove(HCSyncWorker.KEY_PENDING_AT)
            .remove(HCSyncWorker.KEY_PENDING_SESSIONS)
            .remove(HCSyncWorker.KEY_PENDING_STEPS)
            .apply()

        call.resolve(ret)
    }
}
```

---

## Step 4 — Register the plugin in MainActivity

Open `android/app/src/main/java/YOUR_PACKAGE/MainActivity.kt`.

It should look like this after editing:

```kotlin
package YOUR_PACKAGE

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HCSyncPlugin::class.java)  // <-- add this line
        super.onCreate(savedInstanceState)
    }
}
```

If your `MainActivity` is Java (`.java`), add instead:

```java
@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HCSyncPlugin.class);  // <-- add this line
    super.onCreate(savedInstanceState);
}
```

---

## Step 5 — Add permissions to AndroidManifest.xml

File: `android/app/src/main/AndroidManifest.xml`

Add these `<uses-permission>` tags inside `<manifest>`, before `<application>`:

```xml
<!-- Health Connect permissions — must match what the user granted in the app -->
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />

<!-- Required on Android 13 and below for activity recognition -->
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />

<!-- Allows prompting the user to disable battery optimization (optional but recommended) -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

Also add this inside `<application>` (required by Health Connect policy — the app must
declare where it shows the permissions rationale):

```xml
<activity
    android:name=".PermissionsRationaleActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
    </intent-filter>
</activity>
```

> **Note on reboots:** WorkManager persists work across reboots automatically since
> v2.1 — you do NOT need a `BOOT_COMPLETED` receiver.

---

## Step 6 — Create the TypeScript plugin bridge

Create `src/lib/fingo/hcSyncNative.ts`:

```typescript
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

interface HCSyncPlugin {
  scheduleSync(): Promise<void>;
  cancelSync(): Promise<void>;
  readPendingSync(): Promise<{
    pendingSyncAt: number;       // ms timestamp, 0 if nothing pending
    sessions: string;            // JSON string
    steps: string;               // JSON string
  }>;
}

const HCSyncPlugin = registerPlugin<HCSyncPlugin>('HCSyncPlugin', {
  web: {
    scheduleSync: async () => {},
    cancelSync: async () => {},
    readPendingSync: async () => ({ pendingSyncAt: 0, sessions: '[]', steps: '[]' }),
  },
});

export async function scheduleNativeHCSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await HCSyncPlugin.scheduleSync();
}

export async function cancelNativeHCSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await HCSyncPlugin.cancelSync();
}

/**
 * Returns a timestamp (ms) if the background worker ran since the last JS sync,
 * and clears the flag from native storage. Returns 0 if nothing is pending.
 */
export async function drainPendingSyncFlag(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const { pendingSyncAt } = await HCSyncPlugin.readPendingSync();
  return pendingSyncAt;
}
```

---

## Step 7 — Update useHCAutoSync.ts

The hook needs to check for the native pending flag on app open/resume and fire
`sync()` immediately if the worker ran while the app was killed.

Replace the contents of `src/hooks/useHCAutoSync.ts` with:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useAssets } from './useAssets';
import { useUsageLogs } from './useUsageLogs';
import { runHCAutoAttach } from '../lib/fingo/hcAutoAttach';
import { drainPendingSyncFlag } from '../lib/fingo/hcSyncNative';

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function useHCAutoSync(): void {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const { assets, loadAssets } = useAssets(user);
  const { addUsageLog, fetchLoggedExternalIds } = useUsageLogs(user);

  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    if (isSyncingRef.current) return;
    if (assets.length === 0) return;

    isSyncingRef.current = true;
    try {
      await runHCAutoAttach(assets, addUsageLog, fetchLoggedExternalIds);
      lastSyncRef.current = Date.now();
    } catch {
      // non-fatal
    } finally {
      isSyncingRef.current = false;
    }
  }, [assets, addUsageLog, fetchLoggedExternalIds]);

  // Load assets once
  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // Hourly timer while in foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const timer = setInterval(() => { void sync(); }, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sync]);

  // Sync on app resume — also drain any flag left by the background worker
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;

    const checkAndSync = async (isResume: boolean) => {
      // Check if the native WorkManager ran while the app was killed
      const workerRanAt = await drainPendingSyncFlag();
      if (workerRanAt > lastSyncRef.current) {
        void sync();
        return;
      }
      // Fall back to the normal elapsed-time check on resume
      if (isResume) {
        const elapsed = Date.now() - lastSyncRef.current;
        if (elapsed >= SYNC_INTERVAL_MS) void sync();
      }
    };

    // Check once on mount (covers cold start after worker ran)
    void checkAndSync(false);

    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void checkAndSync(true);
      })
        .then((handle) => { removeListener = () => handle.remove(); })
        .catch(() => {});
    }).catch(() => {});

    return () => removeListener?.();
  }, [sync]);
}
```

---

## Step 8 — Wire schedule/cancel to auth events

After the user logs in, call `scheduleNativeHCSync()`. On logout, call
`cancelNativeHCSync()`.

Find where your app handles session changes (likely in `AuthContext` or wherever you
call `supabase.auth.signIn`). Add:

```typescript
import { scheduleNativeHCSync, cancelNativeHCSync } from '../lib/fingo/hcSyncNative';

// After successful login:
await scheduleNativeHCSync();

// After logout:
await cancelNativeHCSync();
```

The plugin call is idempotent — calling `scheduleSync` again uses
`ExistingPeriodicWorkPolicy.KEEP` so it won't reset the 1-hour clock.

---

## Step 9 — Build and verify

```bash
# 1. Sync web assets into the android project
npx cap sync android

# 2. Build and install a debug APK
cd android && ./gradlew assembleDebug
# Or open Android Studio and hit Run

# 3. Watch logcat for worker output (filter by tag)
adb logcat -s HCSyncWorker:D HCSyncPlugin:D
```

To force the worker to fire immediately for testing (without waiting 1 hour):

```bash
# In Android Studio → App Inspection → Background Task Inspector
# Find "hc_auto_sync" → click "Run"

# Or via adb:
adb shell am broadcast -a androidx.work.diagnostics.REQUEST_DIAGNOSTICS \
    --receiver-foreground -p YOUR_PACKAGE
```

Expected logcat output when working:

```
D HCSyncWorker: doWork() started
D HCSyncWorker: Cached 2 sessions, 1 step entries
```

Then on next app open:

```
D HCSyncPlugin: readPendingSync called — returning pendingSyncAt=1748824000
```

---

## Battery optimization — OEM doze (Samsung/Xiaomi)

WorkManager's constraints (`CONNECTED` + `BATTERY_NOT_LOW`) handle stock Android well.
On aggressive OEM builds, prompt the user to exempt the app once:

```kotlin
// Add to HCSyncPlugin.kt as an optional @PluginMethod, or call from MainActivity.onCreate
val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
    val intent = android.content.Intent(
        android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
    ).apply { data = android.net.Uri.parse("package:${context.packageName}") }
    context.startActivity(intent)
}
```

---

## Summary of new files

| File | Action |
|---|---|
| `android/app/build.gradle` | Add `work-runtime-ktx` + `connect-client` deps |
| `android/.../YOUR_PACKAGE/HCSyncWorker.kt` | Create — WorkManager worker |
| `android/.../YOUR_PACKAGE/HCSyncPlugin.kt` | Create — Capacitor bridge |
| `android/.../YOUR_PACKAGE/MainActivity.kt` | Edit — register plugin |
| `android/app/src/main/AndroidManifest.xml` | Edit — Health Connect permissions |
| `src/lib/fingo/hcSyncNative.ts` | Create — TypeScript plugin wrapper |
| `src/hooks/useHCAutoSync.ts` | Edit — drain pending flag on app open |
| Auth sign-in / sign-out code | Edit — schedule/cancel worker |

---

## Upgrading to true silent background Supabase writes (optional)

If you later want the worker to write to Supabase without the app ever opening:

1. In `HCSyncWorker.kt`, add OkHttp (`com.squareup.okhttp3:okhttp:4.12.0` to Gradle)
2. Store the Supabase URL, anon key, and user JWT in SharedPreferences via a new
   `HCSyncPlugin.setCredentials(url, key, jwt)` method (call it after login and on
   each token refresh — JWT expires)
3. Replace the SharedPreferences cache write in `doWork()` with direct HTTP POSTs to
   your Supabase REST API or Edge Functions
4. The deduplication logic (`external_id` checks) needs to run server-side or be
   reimplemented in Kotlin
