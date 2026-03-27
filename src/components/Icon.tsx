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

/** Curated set of ~280 Lucide icons for the icon picker */
export const LUCIDE_ICON_NAMES: string[] = [
  // Finance & Money
  'Wallet', 'WalletCards', 'WalletMinimal', 'DollarSign', 'CreditCard', 'PiggyBank',
  'TrendingUp', 'TrendingDown', 'TrendingUpDown', 'Banknote', 'BanknoteArrowDown',
  'BanknoteArrowUp', 'Coins', 'Receipt', 'ReceiptText', 'ChartPie', 'ChartLine',
  'ChartBarIncreasing', 'BadgeDollarSign', 'Euro', 'PoundSterling', 'IndianRupee',
  'JapaneseYen', 'Handshake', 'Scale', 'Goal', 'CircleDollarSign', 'HandCoins',
  // Food & Drink
  'UtensilsCrossed', 'Utensils', 'Coffee', 'Beer', 'Wine', 'BottleWine', 'Sandwich',
  'Pizza', 'Cake', 'CakeSlice', 'Apple', 'Banana', 'Beef', 'IceCreamCone',
  'IceCreamBowl', 'Cookie', 'Salad', 'Soup', 'ChefHat', 'CookingPot', 'Croissant',
  'Egg', 'Fish', 'LeafyGreen', 'Carrot', 'Popcorn', 'Candy', 'Grape', 'Cherry',
  'Lollipop', 'Martini', 'CupSoda', 'Milk', 'Ham', 'Hamburger', 'Beef',
  // Transport
  'Car', 'CarFront', 'Bus', 'BusFront', 'TrainFront', 'Plane', 'PlaneLanding',
  'PlaneTakeoff', 'Bike', 'Ship', 'Truck', 'Fuel', 'CarTaxiFront', 'Rocket',
  'Sailboat', 'Ambulance', 'Van', 'Motorbike', 'Scooter', 'EvCharger',
  // Home & Living
  'House', 'HousePlug', 'HouseHeart', 'Sofa', 'Bed', 'BedDouble', 'Bath',
  'Lamp', 'LampDesk', 'Refrigerator', 'WashingMachine', 'Armchair', 'Heater',
  'Fan', 'Microwave', 'Drill', 'Hammer', 'Wrench', 'Toilet', 'ShowerHead',
  'Flame', 'Lightbulb', 'ShelvingUnit', 'TowelRack', 'Wallpaper',
  // Health & Wellness
  'Hospital', 'Stethoscope', 'Pill', 'PillBottle', 'Syringe', 'HeartPulse',
  'Dumbbell', 'Brain', 'Eye', 'Ear', 'Thermometer', 'FlaskConical', 'Microscope',
  'Bandage', 'TestTube', 'BicepsFlexed', 'Weight',
  // Technology
  'Smartphone', 'SmartphoneCharging', 'Laptop', 'LaptopMinimal', 'Monitor',
  'Cpu', 'Wifi', 'Bluetooth', 'Camera', 'Gamepad2', 'Headphones', 'Printer',
  'Router', 'Tv', 'TvMinimal', 'Keyboard', 'Mouse', 'HardDrive', 'Usb',
  'Microchip', 'Code', 'CodeXml', 'RadioReceiver',
  // Work & Education
  'Briefcase', 'BriefcaseBusiness', 'BriefcaseMedical', 'GraduationCap', 'School',
  'BookOpen', 'BookText', 'Pen', 'PenLine', 'Clipboard', 'ClipboardList', 'Trophy',
  'Award', 'Medal', 'Presentation', 'Mail', 'Phone', 'Building', 'Building2',
  'Landmark', 'Library', 'NotebookPen', 'FileText', 'Archive', 'University',
  // Leisure & Entertainment
  'Music', 'Music2', 'Film', 'Theater', 'Ticket', 'TicketsPlane', 'Guitar',
  'Palette', 'Paintbrush', 'Tent', 'Compass', 'Gamepad', 'Dice5', 'FishingRod',
  'Drum', 'Piano', 'Binoculars', 'MicVocal', 'Radio', 'DiscAlbum', 'RollerCoaster',
  'ConciergeBell', 'PartyPopper',
  // Sports & Outdoor
  'Volleyball', 'Bike', 'Dumbbell', 'Mountain', 'MountainSnow', 'Waves',
  'WavesLadder', 'TreePine', 'Tent', 'Compass', 'Footprints', 'Medal',
  // Nature & Environment
  'Leaf', 'LeafyGreen', 'Flower', 'Flower2', 'TreeDeciduous', 'TreePine',
  'Trees', 'Sun', 'Cloud', 'Snowflake', 'Rainbow', 'Globe', 'Wind',
  'Waves', 'Flame', 'Droplet', 'Sprout', 'Recycle', 'SolarPanel',
  // Social & People
  'Gift', 'Heart', 'HeartHandshake', 'Star', 'Share2', 'Users', 'UsersRound',
  'Baby', 'PawPrint', 'Dog', 'Cat', 'Bird', 'Smile', 'Frown', 'Meh',
  'PartyPopper', 'Balloon', 'Ribbon', 'HandHeart',
  // Symbols & General
  'Tag', 'Tags', 'Bell', 'BellRing', 'Calendar', 'CalendarDays', 'Clock',
  'Map', 'MapPin', 'Search', 'Lock', 'LockKeyhole', 'Key', 'KeyRound',
  'Settings', 'Settings2', 'Zap', 'Shield', 'ShieldCheck', 'Anchor', 'Link',
  'QrCode', 'Barcode', 'Flag', 'Info', 'CircleAlert', 'CircleCheck',
  'ShoppingCart', 'ShoppingBag', 'ShoppingBasket', 'Store', 'Package',
  'Rss', 'Bookmark', 'Send', 'Navigation', 'Home', 'User', 'UserRound',
  'CirclePlus', 'Ban', 'ArrowLeftRight', 'Repeat', 'Shuffle', 'Filter',
  'Percent', 'Hash', 'LayoutDashboard', 'Layers', 'Box', 'Boxes',
];

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
