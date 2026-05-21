import { readHealthConnectData, type HCRecord } from './tracking/HealthConnectTrackingProvider';
import type { FinGoAsset, UsageEntry, UsageSource } from '../../types/fingo';

const BIKING_HC_TYPES = new Set([8, 9]);

function isBikingHC(activityType: string): boolean {
  return BIKING_HC_TYPES.has(parseInt(activityType, 10));
}

type WorkoutCandidate = {
  sessionId: string;
  distanceKm: number | null;
  durationMin: number;
  rawRecord: HCRecord;
};

function detectDuplicates(workouts: WorkoutCandidate[]): Set<string> {
  const dupes = new Set<string>();
  for (let i = 0; i < workouts.length; i++) {
    if (dupes.has(workouts[i]!.sessionId)) continue;
    for (let j = i + 1; j < workouts.length; j++) {
      if (dupes.has(workouts[j]!.sessionId)) continue;
      const a = workouts[i]!;
      const b = workouts[j]!;
      const timeDiff = Math.abs(
        new Date(a.rawRecord.startTime).getTime() - new Date(b.rawRecord.startTime).getTime(),
      );
      if (timeDiff > 4 * 60 * 60 * 1000) continue;
      const durationDiff = Math.abs(a.durationMin - b.durationMin);
      if (durationDiff > Math.max(5, Math.min(a.durationMin, b.durationMin) * 0.1)) continue;
      const aDist = a.distanceKm ?? 0;
      const bDist = b.distanceKm ?? 0;
      if (aDist > 0 && bDist > 0) {
        const distDiff = Math.abs(aDist - bDist);
        if (distDiff > Math.max(0.5, Math.min(aDist, bDist) * 0.1)) continue;
      }
      if (aDist >= bDist && (aDist > bDist || a.durationMin >= b.durationMin)) {
        dupes.add(b.sessionId);
      } else {
        dupes.add(a.sessionId);
      }
    }
  }
  return dupes;
}

function buildEntry(r: HCRecord, _asset: FinGoAsset): UsageEntry {
  switch (r.type) {
    case 'steps':
      return { steps: r.steps ?? 0, recordedAt: r.startTime };
    case 'distance':
      return { distance: r.distanceKm ?? 0, recordedAt: r.startTime };
    case 'exercise':
      return {
        distance: r.distanceKm,
        movingTime: r.movingTimeMin != null ? Math.round(r.movingTimeMin) : undefined,
        elevation: r.elevationGainM,
        recordedAt: r.startTime,
      };
    default:
      return {};
  }
}

type AddUsageLogFn = (
  asset: FinGoAsset,
  entry: UsageEntry,
  linkedExpenseId: string | null,
  source: UsageSource,
  externalId: string | null,
) => Promise<boolean>;

type FetchLoggedIdsFn = (source: UsageSource) => Promise<Set<string>>;

/** Run HC auto-attach for active assets. Returns count of newly logged items. */
export async function runHCAutoAttach(
  assets: FinGoAsset[],
  addUsageLog: AddUsageLogFn,
  fetchLoggedExternalIds: FetchLoggedIdsFn,
): Promise<number> {
  const activeBike = assets.find((a) => a.type === 'bike' && a.is_active);
  const activeShoe = assets.find((a) => a.type === 'shoe' && a.is_active);
  if (!activeBike && !activeShoe) return 0;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 2); // 2-day window to catch recent workouts
  const records = await readHealthConnectData(start, end);
  if (records.length === 0) return 0;

  const attachedIds = await fetchLoggedExternalIds('health_connect');
  let count = 0;
  const newIds: string[] = [];

  if (activeBike) {
    const distanceRecs = records.filter((d) => d.type === 'distance');
    const unloggedRides = records.filter(
      (r) => r.type === 'exercise' && isBikingHC(r.activityType ?? '') && !attachedIds.has(r.id),
    );

    const rideWorkouts: WorkoutCandidate[] = unloggedRides.map((r) => {
      const distR = distanceRecs.find((d) => {
        const ds = new Date(d.startTime).getTime();
        const de = new Date(d.endTime).getTime();
        const rs = new Date(r.startTime).getTime();
        const re = new Date(r.endTime).getTime();
        return ds >= rs && de <= re;
      });
      return {
        sessionId: r.id,
        distanceKm: r.distanceKm ?? distR?.distanceKm ?? null,
        durationMin: r.movingTimeMin ??
          (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000,
        rawRecord: r,
      };
    });
    const dupeRideIds = detectDuplicates(rideWorkouts);

    let runningBike = activeBike;
    for (const workout of rideWorkouts) {
      if (dupeRideIds.has(workout.sessionId)) continue;
      const enriched = { ...workout.rawRecord, distanceKm: workout.distanceKm ?? undefined };
      const entry = buildEntry(enriched, runningBike);
      const ok = await addUsageLog(runningBike, entry, null, 'health_connect', workout.rawRecord.id);
      if (ok) {
        newIds.push(workout.rawRecord.id);
        count++;
        const dist = entry.distance ?? 0;
        runningBike = {
          ...runningBike,
          current_usage: runningBike.current_usage + dist,
          total_distance: runningBike.total_distance + dist,
          total_rides: runningBike.total_rides + 1,
          total_moving_time: runningBike.total_moving_time + (entry.movingTime ?? 0),
          total_elevation: runningBike.total_elevation + (entry.elevation ?? 0),
        };
      }
    }
  }

  if (activeShoe) {
    const stepsByDay = new Map<string, { total: number; lastEndTime: string }>();
    for (const r of records.filter((r) => r.type === 'steps')) {
      const date = r.startTime.slice(0, 10);
      const syntheticId = `steps-${date}`;
      if (attachedIds.has(syntheticId) || newIds.includes(syntheticId)) continue;
      const prev = stepsByDay.get(date);
      if (prev) {
        stepsByDay.set(date, {
          total: prev.total + (r.steps ?? 0),
          lastEndTime: r.endTime > prev.lastEndTime ? r.endTime : prev.lastEndTime,
        });
      } else {
        stepsByDay.set(date, { total: r.steps ?? 0, lastEndTime: r.endTime });
      }
    }
    let runningShoe = activeShoe;
    for (const [date, { total, lastEndTime }] of stepsByDay) {
      const syntheticId = `steps-${date}`;
      if (total <= 0) continue;
      const entry: UsageEntry = { steps: total, recordedAt: lastEndTime };
      const ok = await addUsageLog(runningShoe, entry, null, 'health_connect', syntheticId);
      if (ok) {
        newIds.push(syntheticId);
        count++;
        runningShoe = {
          ...runningShoe,
          current_usage: runningShoe.current_usage + total,
          total_steps: (runningShoe.total_steps ?? 0) + total,
        };
      }
    }
  }

  return count;
}
