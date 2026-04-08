/**
 * Icon – unified Lucide icon component for both native and web.
 * Maps legacy Material Symbol names (stored in DB) to Lucide PascalCase names,
 * and also accepts any Lucide PascalCase name directly.
 */
import React from 'react';
import type { LucideProps } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

/** Legacy Material Symbol name → Lucide PascalCase name */
const ICON_MAP: Record<string, string> = {
  // UI icons
  'add': 'Plus',
  'remove': 'Minus',
  'swap_horiz': 'ArrowLeftRight',
  'smartphone': 'Smartphone',
  'laptop': 'Laptop',
  'add_circle': 'CirclePlus',
  'label': 'Tag',
  'block': 'Ban',
  'expand_less': 'ChevronUp',
  'expand_more': 'ChevronDown',
  'keyboard_arrow_up': 'ChevronUp',
  'close': 'X',
  'arrow_up': 'ArrowUp',
  'arrow-left': 'ArrowLeft',
  'calendar': 'Calendar',
  'calendar_today': 'CalendarDays',
  'share': 'Share2',
  // Legacy category icons
  'restaurant': 'UtensilsCrossed',
  'shopping_cart': 'ShoppingCart',
  'directions_car': 'Car',
  'local_hospital': 'Hospital',
  'movie': 'Film',
  'coffee': 'Coffee',
  'bolt': 'Zap',
  'home': 'House',
  'account_balance_wallet': 'Wallet',
  'card_giftcard': 'Gift',
  'fitness_center': 'Dumbbell',
  'school': 'GraduationCap',
  'security': 'Shield',
  'local_bar': 'BottleWine',
  'devices': 'Monitor',
  'subscriptions': 'Rss',
  'face': 'Smile',
  'pets': 'PawPrint',
  'trending_up': 'TrendingUp',
  'savings': 'PiggyBank',
  'local_taxi': 'CarTaxiFront',
  'local_gas_station': 'Fuel',
  'sports_esports': 'Gamepad2',
  'flight': 'Plane',
  'music_note': 'Music',
  'work': 'Briefcase',
  'attach_money': 'DollarSign',
  'receipt': 'Receipt',
  'fastfood': 'Sandwich',
  'sports': 'Trophy',
  'tv': 'Tv',
  'spa': 'Leaf',
  'child_care': 'Baby',
  'local_pharmacy': 'Pill',
  'local_grocery_store': 'ShoppingBasket',
  'theater_comedy': 'Theater',
};

/** All Lucide icon names available in lucide-react-native, sorted alphabetically */
export const LUCIDE_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter((k) => /^[A-Z]/.test(k) && !k.startsWith('Lucide') && !k.endsWith('Icon'))
  .sort();

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export default function Icon({ name, size = 24, color = '#EAF2FF', style }: IconProps) {
  const lucideName = ICON_MAP[name] ?? name;
  const LucideIcon = ((LucideIcons as any)[lucideName] ?? LucideIcons.CircleQuestionMark) as React.ComponentType<LucideProps>;
  return <LucideIcon size={size} color={color} style={style as any} />;
}
