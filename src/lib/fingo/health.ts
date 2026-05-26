/**
 * FinGo — pure health math utilities.
 * No side effects — easy to unit-test and reuse anywhere.
 */

import type {
  AssetPart,
  Component,
  ComponentServiceInterval,
  IntervalHealth,
  PartHealth,
  TrackingMethod,
  UsageLog,
} from '../../types/fingo';

// ─── Legacy asset-part health ─────────────────────────────────────────────────

/**
 * Compute health metrics for a part relative to its asset's current usage.
 *
 * Note: a part's usage_at_last_reset and reset_interval are in the part's OWN
 * usage_unit. The caller is responsible for ensuring the asset's current_usage
 * is expressed in the same unit before passing it here.
 */
export function computePartHealth(part: AssetPart, assetCurrentUsage: number): PartHealth {
  const consumed = assetCurrentUsage - part.usage_at_last_reset;
  const healthRatio = 1 - consumed / part.reset_interval;
  const remaining = part.reset_interval - consumed;

  return {
    part,
    healthRatio,
    remaining,
    isWarning: healthRatio <= (1 - part.warn_at_pct),
    isOverdue: remaining <= 0,
  };
}

/** Format a remaining value with its unit for display */
export function formatRemaining(remaining: number, unit: string): string {
  if (remaining <= 0) return 'Overdue';
  return `${Math.round(remaining).toLocaleString()} ${unit}`;
}

/** Health ratio → colour token used throughout FinGo UI */
export function healthColor(healthRatio: number): string {
  if (healthRatio <= 0) return '#f72323';   // red — overdue
  if (healthRatio <= 0.2) return '#fb923c'; // orange — critical
  if (healthRatio <= 0.4) return '#fbbf24'; // yellow — warning
  return '#4ade80';                          // green — good
}

// ─── Component interval health ────────────────────────────────────────────────

/** Read the accumulated tracking counter for a given method from a component */
export function getTrackingValue(component: Component, method: TrackingMethod): number {
  switch (method) {
    case 'distance':       return component.track_distance;
    case 'moving_time':    return component.track_moving_time;
    case 'elapsed_time':   return component.track_elapsed_time;
    case 'rides':          return component.track_rides;
    case 'elevation_gain': return component.track_elevation_gain;
  }
}

/** Human-readable unit label for a tracking method */
export function trackingMethodUnit(method: TrackingMethod): string {
  switch (method) {
    case 'distance':       return 'km';
    case 'moving_time':    return 'h';
    case 'elapsed_time':   return 'h';
    case 'rides':          return 'rides';
    case 'elevation_gain': return 'm';
  }
}

/** Display label for a tracking method */
export function trackingMethodLabel(method: TrackingMethod): string {
  switch (method) {
    case 'distance':       return 'Distance';
    case 'moving_time':    return 'Moving time';
    case 'elapsed_time':   return 'Elapsed time';
    case 'rides':          return 'Rides';
    case 'elevation_gain': return 'Elevation gain';
  }
}

/** Compute health for one service interval against the component's current tracking */
export function computeIntervalHealth(
  interval: ComponentServiceInterval,
  component: Component,
): IntervalHealth {
  const current = getTrackingValue(component, interval.tracking_method);
  const totalSinceService = current - interval.last_serviced_value;
  const remaining = interval.interval_value - totalSinceService;
  const isWarning = totalSinceService >= interval.interval_value * 0.8;

  return { interval, totalSinceService, remaining, isWarning, isOverdue: remaining <= 0 };
}

/**
 * Compute health by summing usage_logs recorded after lastServiceDate.
 * Use this when date-accurate progress is needed (e.g. after editing ride/service dates).
 * Falls back to computeIntervalHealth when lastServiceDate is null.
 * elapsed_time intervals track wall-clock hours, not ride activity.
 */
export function computeIntervalHealthFromLogs(
  interval: ComponentServiceInterval,
  component: Component,
  logs: UsageLog[],
  lastServiceDate: string | null,
): IntervalHealth {
  if (!lastServiceDate) {
    if (interval.tracking_method === 'elapsed_time' && component.installed_at) {
      const totalSinceService = (Date.now() - new Date(component.installed_at).getTime()) / (1000 * 60 * 60);
      const remaining = interval.interval_value - totalSinceService;
      return { interval, totalSinceService, remaining, isWarning: totalSinceService >= interval.interval_value * 0.8, isOverdue: remaining <= 0 };
    }
    return computeIntervalHealth(interval, component);
  }
  const cutoff = new Date(lastServiceDate);
  const relevantLogs = logs.filter((l) => new Date(l.recorded_at) > cutoff);

  let totalSinceService = 0;
  switch (interval.tracking_method) {
    case 'distance':
      totalSinceService = relevantLogs.reduce((s, l) => s + (l.usage_delta ?? 0), 0);
      break;
    case 'moving_time':
      totalSinceService = relevantLogs.reduce((s, l) => s + (l.moving_time_delta ?? 0), 0) / 60;
      break;
    case 'elapsed_time':
      // Wall-clock hours since last service date, not just ride activity time
      totalSinceService = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60);
      break;
    case 'rides':
      totalSinceService = relevantLogs.length;
      break;
    case 'elevation_gain':
      totalSinceService = relevantLogs.reduce((s, l) => s + (l.elevation_delta ?? 0), 0);
      break;
  }

  const remaining = interval.interval_value - totalSinceService;
  const isWarning = totalSinceService >= interval.interval_value * 0.8;
  return { interval, totalSinceService, remaining, isWarning, isOverdue: remaining <= 0 };
}

/**
 * Return the most urgent interval health for a component (highest % consumed).
 * Returns null if there are no intervals.
 * Pass logs to enable date-based calculation (uses last_serviced_at per interval).
 */
export function worstIntervalHealth(
  intervals: ComponentServiceInterval[],
  component: Component,
  logs?: UsageLog[],
): IntervalHealth | null {
  if (intervals.length === 0) return null;
  return intervals
    .map((i) =>
      logs
        ? computeIntervalHealthFromLogs(i, component, logs, i.last_serviced_at ?? null)
        : computeIntervalHealth(i, component),
    )
    .sort((a, b) => {
      const pctA = a.totalSinceService / a.interval.interval_value;
      const pctB = b.totalSinceService / b.interval.interval_value;
      return pctB - pctA;
    })[0] ?? null;
}

/**
 * Format a duration given in hours using the most readable unit:
 * < 1 h  → "Xm"
 * < 24 h → "Xh" or "Xh Ym"
 * < 1 y  → "Xd Yh"
 * ≥ 1 y  → "Xy Zd"
 */
export function formatTimeHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 365) {
    const h = Math.round(hours % 24);
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }
  const years = Math.floor(days / 365);
  const remDays = days % 365;
  return remDays > 0 ? `${years}y ${remDays}d` : `${years}y`;
}

/** Format a service interval remaining value for display */
export function formatIntervalRemaining(health: IntervalHealth): string {
  if (health.isOverdue) return 'Overdue';
  const { tracking_method } = health.interval;
  if (tracking_method === 'moving_time' || tracking_method === 'elapsed_time') {
    return formatTimeHours(health.remaining);
  }
  const unit = trackingMethodUnit(tracking_method);
  const val = tracking_method === 'rides'
    ? Math.round(health.remaining)
    : Math.round(health.remaining * 10) / 10;
  return `${val.toLocaleString()} ${unit}`;
}
