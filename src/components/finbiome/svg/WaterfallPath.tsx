/**
 * WaterfallPath SVG Component
 *
 * Two grey cliffs with water falling between them for FinFlow.
 * Positioned at top-right, completely static on background.
 */
import React from 'react';
import { G, Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface WaterfallPathProps {
  canvasWidth: number;
  canvasHeight: number;
}

export default function WaterfallPath({ canvasWidth, canvasHeight }: WaterfallPathProps) {
  // Waterfall positioned at top-right
  const cliffWidth = 80; // Width of each cliff block
  const waterfallWidth = 40; // Width of falling water
  const cliffHeight = 300; // Height of cliffs
  const gap = 10; // Gap at top for water source

  // Position from right edge
  const rightPadding = 50;
  const totalWidth = cliffWidth * 2 + waterfallWidth;
  const xStart = canvasWidth - totalWidth - rightPadding;

  return (
    <G>
      <Defs>
        {/* Water gradient - cyan to white */}
        <LinearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#00F5D4" stopOpacity="0.8" />
          <Stop offset="0.5" stopColor="#56cfe1" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#80ffdb" stopOpacity="0.4" />
        </LinearGradient>
      </Defs>

      {/* Left cliff (grey block) */}
      <Rect
        x={xStart}
        y={gap}
        width={cliffWidth}
        height={cliffHeight}
        fill="#4A5568"
        stroke="#2D3748"
        strokeWidth={2}
        rx={4}
      />

      {/* Right cliff (grey block) */}
      <Rect
        x={xStart + cliffWidth + waterfallWidth}
        y={gap}
        width={cliffWidth}
        height={cliffHeight}
        fill="#4A5568"
        stroke="#2D3748"
        strokeWidth={2}
        rx={4}
      />

      {/* Falling water (animated appearance - straight down between cliffs) */}
      <Rect
        x={xStart + cliffWidth}
        y={gap}
        width={waterfallWidth}
        height={cliffHeight}
        fill="url(#waterGradient)"
        opacity={0.7}
      />

      {/* Water source at top (small pool) */}
      <Rect
        x={xStart + cliffWidth}
        y={0}
        width={waterfallWidth}
        height={gap + 5}
        fill="#00F5D4"
        opacity={0.9}
        rx={2}
      />
    </G>
  );
}
