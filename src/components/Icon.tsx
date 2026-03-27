/**
 * Icon – unified Lucide icon component for both native and web.
 * Maps Material Symbol names (stored in DB) to Lucide React Native components.
 */
import React from 'react';
import type { LucideProps } from 'lucide-react-native';
import {
  // UI icons
  Plus, Minus, ArrowLeftRight, Smartphone, Laptop,
  CirclePlus, Tag, Ban, ChevronUp, ChevronDown,
  X, ArrowUp, Calendar, CalendarDays,
  // Category icons
  UtensilsCrossed, ShoppingCart, Car, CarTaxiFront, Hospital,
  Film, Coffee, Zap, House, Wallet, Gift,
  Dumbbell, GraduationCap, Shield, BottleWine, Monitor, Rss,
  Smile, PawPrint, TrendingUp, PiggyBank, Fuel,
  Gamepad2, Plane, Music, Briefcase, DollarSign, Receipt,
  Sandwich, Trophy, Tv, Leaf, Baby, Pill, ShoppingBasket, Theater,
  // Fallback
  CircleQuestionMark,
} from 'lucide-react-native';

type LucideIcon = React.ComponentType<LucideProps>;

const ICON_MAP: Record<string, LucideIcon> = {
  // UI icons
  'add': Plus,
  'remove': Minus,
  'swap_horiz': ArrowLeftRight,
  'smartphone': Smartphone,
  'laptop': Laptop,
  'add_circle': CirclePlus,
  'label': Tag,
  'block': Ban,
  'expand_less': ChevronUp,
  'expand_more': ChevronDown,
  'keyboard_arrow_up': ChevronUp,
  'close': X,
  'arrow_up': ArrowUp,
  'calendar': Calendar,
  'calendar_today': CalendarDays,

  // Category icons (Material Symbol names stored in DB → Lucide)
  'restaurant': UtensilsCrossed,
  'shopping_cart': ShoppingCart,
  'directions_car': Car,
  'local_hospital': Hospital,
  'movie': Film,
  'coffee': Coffee,
  'bolt': Zap,
  'home': House,
  'account_balance_wallet': Wallet,
  'card_giftcard': Gift,
  'fitness_center': Dumbbell,
  'school': GraduationCap,
  'security': Shield,
  'local_bar': BottleWine,
  'devices': Monitor,
  'subscriptions': Rss,
  'face': Smile,
  'pets': PawPrint,
  'trending_up': TrendingUp,
  'savings': PiggyBank,
  'local_taxi': CarTaxiFront,
  'local_gas_station': Fuel,
  'sports_esports': Gamepad2,
  'flight': Plane,
  'music_note': Music,
  'work': Briefcase,
  'attach_money': DollarSign,
  'receipt': Receipt,
  'fastfood': Sandwich,
  'sports': Trophy,
  'tv': Tv,
  'spa': Leaf,
  'child_care': Baby,
  'local_pharmacy': Pill,
  'local_grocery_store': ShoppingBasket,
  'theater_comedy': Theater,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export default function Icon({ name, size = 24, color = '#EAF2FF', style }: IconProps) {
  const LucideIcon = ICON_MAP[name] ?? CircleQuestionMark;
  return <LucideIcon size={size} color={color} style={style as any} />;
}
