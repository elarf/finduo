export type TransactionType = 'income' | 'expense';
export type IntervalKey = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

export type AppAccount = {
  id: string;
  name: string;
  currency: string;
  icon?: string | null;
  created_at?: string;
  created_by?: string;
  tag_ids?: string[] | null;
};

export type AppCategory = {
  id: string;
  user_id: string | null;
  account_id?: string | null;
  name: string;
  type: TransactionType;
  color?: string | null;
  icon?: string | null;
  tag_ids?: string[] | null;
  /** User IDs for whom this is a "Temp" category (access revoked but still in use). */
  temp_for?: string[] | null;
  /** True for system-level categories (e.g. Transfer) that belong to no user. */
  is_default?: boolean | null;
};

export type AppTag = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
};

export type AppTransaction = {
  id: string;
  account_id: string;
  category_id?: string | null;
  amount: number;
  note?: string | null;
  type: TransactionType;
  date: string;
  created_at?: string;
  tag_ids: string[];
};

export type AccountInvite = {
  id: string;
  account_id: string;
  token: string;
  name?: string | null;
  invited_by: string;
  expires_at: string;
  used_at?: string | null;
};

export type AccountSetting = {
  account_id: string;
  included_in_balance: boolean;
  carry_over_balance: boolean;
  initial_balance: number;
  initial_balance_date?: string | null;
};

export type ManagedInvite = {
  id: string;
  account_id: string;
  token: string;
  name: string;
  expires_at: string;
  used_at?: string | null;
};

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'HUF'];

// Material icon name → use for category auto-suggestion by name keyword
export const CATEGORY_ICON_MAP: Record<string, string> = {
  food: 'restaurant', grocery: 'shopping_cart', groceries: 'shopping_cart',
  shopping: 'shopping_cart', transport: 'directions_car', car: 'directions_car',
  travel: 'flight', health: 'local_hospital', medical: 'local_hospital',
  entertainment: 'movie', coffee: 'coffee', utility: 'bolt', utilities: 'bolt',
  electricity: 'bolt', housing: 'home', rent: 'home',
  salary: 'account_balance_wallet', income: 'account_balance_wallet',
  gift: 'card_giftcard', fitness: 'fitness_center', sport: 'sports',
  education: 'school', transfer: 'swap_horiz', insurance: 'security',
  restaurant: 'restaurant', drink: 'local_bar', bar: 'local_bar',
  tech: 'devices', phone: 'smartphone', subscription: 'subscriptions',
  beauty: 'face', pet: 'pets', investment: 'trending_up', savings: 'savings',
  taxi: 'local_taxi', fuel: 'local_gas_station', game: 'sports_esports',
  music: 'music_note', sport_activity: 'sports', work: 'work',
};

export const COLOR_PRESETS = [
  '#53E3A6', '#FB7185', '#60A5FA', '#FBBF24', '#A78BFA',
  '#34D399', '#F97316', '#22D3EE', '#F472B6', '#A3E635',
  '#E879F9', '#38BDF8', '#F87171', '#4ADE80', '#94A3B8',
];

export function suggestIcon(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseAmount(value: string): number {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  return Number(normalized);
}

export function formatShortDate(date?: string): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  const maybeMessage = (error as { message?: unknown }).message;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';
  return code === 'PGRST205' || code === '42P01' || message.includes('could not find the table');
}

export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  const maybeMessage = (error as { message?: unknown }).message;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || (message.includes('column') && message.includes('does not exist'));
}
