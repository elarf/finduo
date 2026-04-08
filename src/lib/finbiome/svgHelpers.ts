/**
 * SVG path generation utilities for FinBiome 2D
 *
 * Helpers for creating Bezier curves, smooth paths, and other SVG path strings.
 */

import type { Point2D } from './types2D';

/**
 * Generate SVG cubic Bezier curve path through control points
 *
 * @param points - Array of points: [start, cp1, cp2, end, cp3, cp4, end2, ...]
 * @returns SVG path string (e.g., "M x y C x1 y1, x2 y2, x3 y3")
 */
export function generateBezierPath(points: Point2D[]): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  // Generate cubic Bezier curves (requires 3 points per segment)
  for (let i = 1; i < points.length - 2; i += 3) {
    const cp1 = points[i];
    const cp2 = points[i + 1] || points[i];
    const end = points[i + 2] || points[i + 1];

    path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
  }

  // If remaining points don't form complete curve, draw line
  const remainingPoints = (points.length - 1) % 3;
  if (remainingPoints > 0) {
    const lastPoint = points[points.length - 1];
    path += ` L ${lastPoint.x} ${lastPoint.y}`;
  }

  return path;
}

/**
 * Generate smooth quadratic curve through points
 *
 * Simpler than cubic Bezier, good for river flows and roots.
 *
 * @param points - Array of points to connect
 * @returns SVG path string
 */
export function generateSmoothPath(points: Point2D[]): string {
  if (points.length  < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  if (points.length === 2) {
    path += ` L ${points[1].x} ${points[1].y}`;
    return path;
  }

  // Use quadratic curves for smooth transitions
  for (let i = 1; i < points.length; i++) {
    const current = points[i];

    if (i === 1) {
      // First segment
      path += ` L ${current.x} ${current.y}`;
    } else {
      // Calculate control point (midpoint between prev and current)
      const prev = points[i - 1];
      const cpX = (prev.x + current.x) / 2;
      const cpY = (prev.y + current.y) / 2;
      path += ` Q ${cpX} ${cpY}, ${current.x} ${current.y}`;
    }
  }

  return path;
}

/**
 * Generate line path (straight connection between two points)
 *
 * @param start - Start point
 * @param end - End point
 * @returns SVG path string
 */
export function generateLinePath(start: Point2D, end: Point2D): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/**
 * Generate arc path (curved connection, useful for branches)
 *
 * @param start - Start point
 * @param end - End point
 * @param radius - Arc radius
 * @param largeArc - Use large arc (0 or 1)
 * @param sweep - Sweep direction (0 or 1)
 * @returns SVG path string
 */
export function generateArcPath(
  start: Point2D,
  end: Point2D,
  radius: number,
  largeArc: 0 | 1 = 0,
  sweep: 0 | 1 = 1
): string {
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

/**
 * Generate root path with natural curve
 *
 * Roots flow downward with slight wave for organic feel.
 *
 * @param start - Root start (at branch)
 * @param end - Root end (at merge point)
 * @returns SVG path string
 */
export function generateRootPath(start: Point2D, end: Point2D): string {
  const midY = (start.y + end.y) / 2;
  const waveOffset = (start.x - end.x) * 0.3; // Horizontal curve

  const cp1: Point2D = { x: start.x + waveOffset, y: midY - 20 };
  const cp2: Point2D = { x: end.x - waveOffset, y: midY + 20 };

  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
}

/**
 * Generate waterfall cascade path
 *
 * Creates stepped waterfall effect for FinFlow visualization.
 *
 * @param steps - Array of step heights
 * @param barWidth - Width of each bar
 * @param barSpacing - Spacing between bars
 * @param startX - Starting X position
 * @param baseY - Baseline Y position
 * @returns SVG path string
 */
export function generateWaterfallPath(
  steps: number[],
  barWidth: number,
  barSpacing: number,
  startX: number,
  baseY: number
): string {
  if (steps.length === 0) return '';

  let path = `M ${startX} ${baseY}`;
  let currentX = startX;
  let currentY = baseY;

  steps.forEach((height) => {
    // Go up to bar height
    const nextY = currentY - height;
    path += ` L ${currentX} ${nextY}`;
    // Go right for bar width
    path += ` L ${currentX + barWidth} ${nextY}`;
    // Go down to baseline
    path += ` L ${currentX + barWidth} ${currentY}`;
    // Move to next bar
    currentX += barWidth + barSpacing;
    path += ` L ${currentX} ${currentY}`;
  });

  return path;
}
