export interface FinvenLocation {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

export interface FinvenProduct {
  id: string;
  user_id: string;
  name: string;
  barcode: string | null;
  default_unit: string;
  category_hint: string | null;
  created_at: string;
}

export interface FinvenTransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  user_id: string;
  quantity: number;
  unit: string;
  price_allocated: number;
  expiry_date: string | null;
  location_id: string | null;
  created_at: string;
}

export interface FinvenStockItem {
  id: string;
  product_id: string;
  user_id: string;
  location_id: string | null;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  low_stock_threshold: number | null;
  transaction_item_id: string | null;
  created_at: string;
}

export type FinvenShoppingAddedReason = 'manual' | 'low_stock' | 'expiry';

export interface FinvenShoppingListItem {
  id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  added_reason: FinvenShoppingAddedReason;
  checked: boolean;
  created_at: string;
}
