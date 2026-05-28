import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAPI, webAlert } from '../lib/devtools';
import { isMissingTableError } from '../types/dashboard';
import type { User } from '@supabase/supabase-js';
import type {
  FinvenLocation, FinvenProduct, FinvenStockItem,
  FinvenTransactionItem, FinvenShoppingListItem,
} from '../types/finven';

export const finvenLocationsQueryKey = (userId: string | undefined) =>
  ['finven_locations', userId] as const;
export const finvenProductsQueryKey = (userId: string | undefined) =>
  ['finven_products', userId] as const;
export const finvenStockQueryKey = (userId: string | undefined) =>
  ['finven_stock_items', userId] as const;
export const finvenShoppingQueryKey = (userId: string | undefined) =>
  ['finven_shopping_list', userId] as const;

export function useFinven(user: User | null) {
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: finvenLocationsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('finven_locations').select('*').order('name');
      if (error) { if (isMissingTableError(error)) return []; throw error; }
      return (data ?? []) as FinvenLocation[];
    },
    enabled: !!userId,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: finvenProductsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('finven_products').select('*').order('name');
      if (error) { if (isMissingTableError(error)) return []; throw error; }
      return (data ?? []) as FinvenProduct[];
    },
    enabled: !!userId,
  });

  const { data: stockItems = [], isLoading: stockLoading } = useQuery({
    queryKey: finvenStockQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finven_stock_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { if (isMissingTableError(error)) return []; throw error; }
      return (data ?? []) as FinvenStockItem[];
    },
    enabled: !!userId,
  });

  const { data: shoppingList = [], isLoading: shoppingLoading } = useQuery({
    queryKey: finvenShoppingQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finven_shopping_list')
        .select('*')
        .order('checked', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) { if (isMissingTableError(error)) return []; throw error; }
      return (data ?? []) as FinvenShoppingListItem[];
    },
    enabled: !!userId,
  });

  const loading = locationsLoading || productsLoading || stockLoading || shoppingLoading;

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: finvenLocationsQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: finvenProductsQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: finvenStockQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: finvenShoppingQueryKey(userId) }),
    ]);
  }, [queryClient, userId]);

  const createLocation = useCallback(async (name: string, icon: string | null): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finven_locations', { source: 'finven.inventory', action: 'createLocation' });
      const { error } = await supabase.from('finven_locations').insert({ user_id: user.id, name, icon });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenLocationsQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create location');
      return false;
    }
  }, [user, userId, queryClient]);

  const updateLocation = useCallback(async (
    locationId: string,
    patch: Partial<Pick<FinvenLocation, 'name' | 'icon'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://finven_locations', { source: 'finven.location_sheet', action: 'updateLocation' });
      const { error } = await supabase.from('finven_locations').update(patch).eq('id', locationId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenLocationsQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update location');
      return false;
    }
  }, [userId, queryClient]);

  const deleteLocation = useCallback(async (locationId: string): Promise<boolean> => {
    try {
      logAPI('supabase://finven_locations', { source: 'finven.location_sheet', action: 'deleteLocation' });
      const { error } = await supabase.from('finven_locations').delete().eq('id', locationId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenLocationsQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete location');
      return false;
    }
  }, [userId, queryClient]);

  const createProduct = useCallback(async (
    name: string,
    default_unit: string,
    category_hint: string | null,
    barcode: string | null,
  ): Promise<FinvenProduct | null> => {
    if (!user) return null;
    try {
      logAPI('supabase://finven_products', { source: 'finven.product_modal', action: 'createProduct' });
      const { data, error } = await supabase
        .from('finven_products')
        .insert({ user_id: user.id, name, default_unit, category_hint, barcode })
        .select()
        .single();
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenProductsQueryKey(userId) });
      return data as FinvenProduct;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to create product');
      return null;
    }
  }, [user, userId, queryClient]);

  const updateProduct = useCallback(async (
    productId: string,
    patch: Partial<Pick<FinvenProduct, 'name' | 'default_unit' | 'category_hint' | 'barcode'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://finven_products', { source: 'finven.product_modal', action: 'updateProduct' });
      const { error } = await supabase.from('finven_products').update(patch).eq('id', productId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenProductsQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update product');
      return false;
    }
  }, [userId, queryClient]);

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    try {
      logAPI('supabase://finven_products', { source: 'finven.product_modal', action: 'deleteProduct' });
      const { error } = await supabase.from('finven_products').delete().eq('id', productId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenProductsQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete product');
      return false;
    }
  }, [userId, queryClient]);

  const updateStockItem = useCallback(async (
    stockItemId: string,
    patch: Partial<Pick<FinvenStockItem, 'quantity' | 'expiry_date' | 'low_stock_threshold' | 'location_id'>>,
  ): Promise<boolean> => {
    try {
      logAPI('supabase://finven_stock_items', { source: 'finven.location_sheet', action: 'updateStockItem' });
      const { error } = await supabase.from('finven_stock_items').update(patch).eq('id', stockItemId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenStockQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update stock item');
      return false;
    }
  }, [userId, queryClient]);

  const saveTransactionBreakdown = useCallback(async (
    transactionId: string,
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
      priceAllocated: number;
      expiryDate: string | null;
      locationId: string | null;
    }>,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finven_transaction_items', { source: 'finven.breakdown_sheet', action: 'saveBreakdown' });
      const insertData = items.map((item) => ({
        user_id: user.id,
        transaction_id: transactionId,
        product_id: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        price_allocated: item.priceAllocated,
        expiry_date: item.expiryDate,
        location_id: item.locationId,
      }));
      const { data: inserted, error: txError } = await supabase
        .from('finven_transaction_items')
        .insert(insertData)
        .select();
      if (txError) throw txError;

      for (const txItem of (inserted ?? []) as FinvenTransactionItem[]) {
        const existing = stockItems.find(
          (s) => s.product_id === txItem.product_id
            && s.location_id === txItem.location_id
            && s.expiry_date === txItem.expiry_date,
        );
        if (existing) {
          await supabase
            .from('finven_stock_items')
            .update({ quantity: existing.quantity + txItem.quantity, transaction_item_id: txItem.id })
            .eq('id', existing.id);
        } else {
          await supabase.from('finven_stock_items').insert({
            user_id: user.id,
            product_id: txItem.product_id,
            location_id: txItem.location_id,
            quantity: txItem.quantity,
            unit: txItem.unit,
            expiry_date: txItem.expiry_date,
            transaction_item_id: txItem.id,
          });
        }
      }
      await invalidateAll();
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to save breakdown');
      return false;
    }
  }, [user, stockItems, invalidateAll]);

  const addShoppingItem = useCallback(async (
    name: string,
    productId: string | null,
    quantity: number | null,
    unit: string | null,
    addedReason: 'manual' | 'low_stock' | 'expiry',
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      logAPI('supabase://finven_shopping_list', { source: 'finven.shopping', action: 'addShoppingItem' });
      const { error } = await supabase.from('finven_shopping_list').insert({
        user_id: user.id, name, product_id: productId, quantity, unit,
        added_reason: addedReason, checked: false,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenShoppingQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to add item');
      return false;
    }
  }, [user, userId, queryClient]);

  const checkShoppingItem = useCallback(async (itemId: string, checked: boolean): Promise<boolean> => {
    try {
      logAPI('supabase://finven_shopping_list', { source: 'finven.shopping', action: 'checkShoppingItem' });
      const { error } = await supabase.from('finven_shopping_list').update({ checked }).eq('id', itemId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenShoppingQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to update item');
      return false;
    }
  }, [userId, queryClient]);

  const deleteShoppingItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      logAPI('supabase://finven_shopping_list', { source: 'finven.shopping', action: 'deleteShoppingItem' });
      const { error } = await supabase.from('finven_shopping_list').delete().eq('id', itemId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: finvenShoppingQueryKey(userId) });
      return true;
    } catch (err) {
      webAlert('Error', err instanceof Error ? err.message : 'Failed to delete item');
      return false;
    }
  }, [userId, queryClient]);

  const autoPopulateShoppingList = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const lowStockItems = stockItems.filter(
        (s) => s.low_stock_threshold !== null && s.quantity <= (s.low_stock_threshold as number),
      );
      const existingProductIds = new Set(
        shoppingList
          .filter((s) => !s.checked && s.product_id && s.added_reason === 'low_stock')
          .map((s) => s.product_id),
      );
      const inserts = lowStockItems
        .filter((item) => item.product_id && !existingProductIds.has(item.product_id))
        .map((item) => {
          const product = products.find((p) => p.id === item.product_id);
          return product
            ? { user_id: user.id, product_id: item.product_id, name: product.name, quantity: null, unit: item.unit, added_reason: 'low_stock' as const, checked: false }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (inserts.length > 0) {
        await supabase.from('finven_shopping_list').insert(inserts);
        await queryClient.invalidateQueries({ queryKey: finvenShoppingQueryKey(userId) });
      }
    } catch {
      // silent
    }
  }, [user, userId, stockItems, shoppingList, products, queryClient]);

  return {
    locations,
    products,
    stockItems,
    shoppingList,
    loading,
    createLocation,
    updateLocation,
    deleteLocation,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStockItem,
    saveTransactionBreakdown,
    addShoppingItem,
    checkShoppingItem,
    deleteShoppingItem,
    autoPopulateShoppingList,
  };
}
