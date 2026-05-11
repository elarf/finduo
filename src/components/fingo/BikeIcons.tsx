import React from 'react';
import Svg, { Circle, Line, Path, Rect, G } from 'react-native-svg';

export type BikeIconName =
  | 'chain'
  | 'cassette'
  | 'brake-rotor'
  | 'fork'
  | 'tire'
  | 'handlebar'
  | 'saddle'
  | 'derailleur';

export const BIKE_ICON_NAMES = new Set<string>([
  'chain', 'cassette', 'brake-rotor', 'fork', 'tire', 'handlebar', 'saddle', 'derailleur',
]);

interface Props {
  name: BikeIconName;
  size?: number;
  color?: string;
}

export function BikeIcon({ name, size = 24, color = 'currentColor' }: Props) {
  const c = color;
  const sw = 1.5; // stroke width
  const common = { stroke: c, strokeWidth: sw, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  let content: React.ReactNode;

  switch (name) {
    // ── Chain ──────────────────────────────────────────────────────────────
    // Three outer plates (pills) + two inner plates (narrower) + rollers
    case 'chain':
      content = (
        <G {...common}>
          {/* Outer plate 1 */}
          <Rect x="1" y="10" width="6.5" height="4" rx="2" />
          {/* Roller */}
          <Circle cx="9.5" cy="12" r="1.5" fill={c} stroke="none" />
          {/* Inner plate */}
          <Rect x="11" y="10.5" width="2" height="3" rx="1" />
          {/* Roller */}
          <Circle cx="14.5" cy="12" r="1.5" fill={c} stroke="none" />
          {/* Outer plate 2 */}
          <Rect x="16.5" y="10" width="6.5" height="4" rx="2" />
        </G>
      );
      break;

    // ── Cassette / Sprocket cluster ────────────────────────────────────────
    // Concentric rings viewed face-on
    case 'cassette':
      content = (
        <G fill="none">
          <Circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="2" />
          <Circle cx="12" cy="12" r="7.5" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="5.5" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="3.5" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="1.5" fill={c} />
        </G>
      );
      break;

    // ── Brake Rotor ────────────────────────────────────────────────────────
    // Disc with 6 symmetrical holes at r=7 and an inner mounting ring
    case 'brake-rotor':
      content = (
        <G fill="none">
          <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="3.5" stroke={c} strokeWidth={sw} />
          {/* 6 holes at radius 7: angles 0°,60°,120°,180°,240°,300° from top */}
          <Circle cx="12"    cy="5"     r="1.5" fill={c} />
          <Circle cx="18.06" cy="8.5"   r="1.5" fill={c} />
          <Circle cx="18.06" cy="15.5"  r="1.5" fill={c} />
          <Circle cx="12"    cy="19"    r="1.5" fill={c} />
          <Circle cx="5.94"  cy="15.5"  r="1.5" fill={c} />
          <Circle cx="5.94"  cy="8.5"   r="1.5" fill={c} />
        </G>
      );
      break;

    // ── Fork ───────────────────────────────────────────────────────────────
    // Steerer tube, crown, two curved legs, and dropout tabs
    case 'fork':
      content = (
        <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round">
          {/* Steerer tube */}
          <Line x1="12" y1="2" x2="12" y2="7" />
          {/* Crown */}
          <Line x1="8" y1="7" x2="16" y2="7" />
          {/* Left leg */}
          <Path d="M8 7 C8 11 7 16 6.5 21" />
          {/* Right leg */}
          <Path d="M16 7 C16 11 17 16 17.5 21" />
          {/* Dropout tabs */}
          <Line x1="4.5" y1="21" x2="8"   y2="21" strokeWidth="2" />
          <Line x1="17.5" y1="21" x2="20.5" y2="21" strokeWidth="2" />
        </G>
      );
      break;

    // ── Tire / Wheel ───────────────────────────────────────────────────────
    // Three concentric circles: tread, sidewall, rim + hub dot
    case 'tire':
      content = (
        <G fill="none">
          <Circle cx="12" cy="12" r="10"  stroke={c} strokeWidth="2" />
          <Circle cx="12" cy="12" r="7"   stroke={c} strokeWidth="1" />
          <Circle cx="12" cy="12" r="4.5" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="1.5" fill={c} />
        </G>
      );
      break;

    // ── Handlebar ─────────────────────────────────────────────────────────
    // Drop-bar style: top bar + stem clamp + two drops
    case 'handlebar':
      content = (
        <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round">
          {/* Top bar */}
          <Line x1="3" y1="9" x2="21" y2="9" />
          {/* Stem clamp box */}
          <Rect x="10" y="9" width="4" height="4" rx="1" />
          {/* Left drop */}
          <Path d="M3 9 C3 9 2 13 3 17 C3.5 19 5 19 5 17" />
          {/* Right drop */}
          <Path d="M21 9 C21 9 22 13 21 17 C20.5 19 19 19 19 17" />
        </G>
      );
      break;

    // ── Saddle ─────────────────────────────────────────────────────────────
    // Side-profile saddle shell + two rails
    case 'saddle':
      content = (
        <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round">
          {/* Saddle shell (top view curve) */}
          <Path d="M3 14 Q4 10 8 10 Q12 9.5 16 10 Q20 10 21 14" strokeWidth="2" />
          {/* Nose tip */}
          <Path d="M21 14 Q22.5 15 20.5 15.5" />
          {/* Tail curve */}
          <Path d="M3 14 Q1.5 15 3.5 15.5" />
          {/* Rails */}
          <Line x1="7"  y1="15" x2="5"  y2="19" />
          <Line x1="17" y1="15" x2="19" y2="19" />
          <Line x1="5"  y1="19" x2="19" y2="19" />
        </G>
      );
      break;

    // ── Derailleur ─────────────────────────────────────────────────────────
    // Two pulley wheels (guide + tension) connected by a parallelogram cage
    case 'derailleur':
      content = (
        <G stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round">
          {/* Guide pulley (upper) */}
          <Circle cx="9" cy="7.5" r="3.5" />
          <Circle cx="9" cy="7.5" r="1" fill={c} stroke="none" />
          {/* Tension pulley (lower) */}
          <Circle cx="16" cy="17" r="3.5" />
          <Circle cx="16" cy="17" r="1" fill={c} stroke="none" />
          {/* Cage plates */}
          <Line x1="6"  y1="9.5"  x2="13" y2="20" />
          <Line x1="12" y1="9.5"  x2="19.5" y2="19" />
        </G>
      );
      break;

    default:
      content = null;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {content}
    </Svg>
  );
}
