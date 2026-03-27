/**
 * Icon – web implementation (Material Symbols Outlined, ligature-based).
 * Metro resolves this file over Icon.tsx on web platform.
 *
 * Renders a <span class="material-symbols-outlined"> containing the icon name
 * as text; the variable font converts the ligature to the corresponding glyph.
 * Font is loaded by loadMaterialSymbols.web.ts at app start (dev) and by
 * patch-web.js at build time (production).
 */
import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export default function Icon({ name, size = 24, color = '#EAF2FF', style }: IconProps) {
  return React.createElement(
    'span',
    {
      className: 'material-symbols-outlined',
      style: {
        fontSize: size,
        color,
        lineHeight: 1,
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...(style || {}),
      },
    },
    name,
  );
}
