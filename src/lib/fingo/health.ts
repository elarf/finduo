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
 * Return the most urgent interval health for a component (highest % consumed).
 * Returns null if there are no intervals.
 */
export function worstIntervalHealth(
  intervals: ComponentServiceInterval[],
  component: Component,
): IntervalHealth | null {
  if (intervals.length === 0) return null;
  return intervals
    .map((i) => computeIntervalHealth(i, component))
    .sort((a, b) => {
      const pctA = a.totalSinceService / a.interval.interval_value;
      const pctB = b.totalSinceService / b.interval.interval_value;
      return pctB - pctA;
    })[0] ?? null;
}

/** Format a service interval remaining value for display */
export function formatIntervalRemaining(health: IntervalHealth): string {
  if (health.isOverdue) return 'Overdue';
  const unit = trackingMethodUnit(health.interval.tracking_method);
  const val = health.interval.tracking_method === 'rides'
    ? Math.round(health.remaining)
    : Math.round(health.remaining * 10) / 10;
  return `${val.toLocaleString()} ${unit}`;
}
