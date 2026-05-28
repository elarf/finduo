import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { logAPI, logUI, uiPath, uiProps } from '../../lib/devtools';
import Icon from '../Icon';
import type { AppTransaction, AppCategory } from '../../types/dashboard';

type TxWithCategory = AppTransaction & {
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
};

interface FindashTransactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tx: AppTransaction) => void;
}

type DateFilter = '7d' | '30d' | '90d' | 'all';

export default function FindashTransactionPicker({ visible, onClose, onSelect }: FindashTransactionPickerProps) {
  const [transactions, setTransactions] = useState<TxWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<AppCategory[]>([]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      logAPI('supabase://transactions', { source: 'findash_tx_picker', action: 'loadTransactions' });
      let query = supabase
        .from('transactions')
        .select('*, categories!category_id(id, name, icon, color)')
        .order('date', { ascending: false })
        .limit(200);

      if (dateFilter !== 'all') {
        const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        query = query.gte('date', cutoff.toISOString().slice(0, 10));
      }

      if (selectedCategoryId) {
        query = query.eq('category_id', selectedCategoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: TxWithCategory[] = (data ?? []).map((row: any) => ({
        id: row.id,
        account_id: row.account_id,
        category_id: row.category_id ?? null,
        amount: row.amount,
        note: row.note ?? null,
        type: row.type,
        date: row.date,
        created_at: row.created_at,
        tag_ids: row.tag_ids ?? [],
        category_name: row.categories?.name ?? null,
        category_icon: row.categories?.icon ?? null,
        category_color: row.categories?.color ?? null,
      }));
      setTransactions(mapped);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [dateFilter, selectedCategoryId]);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await supabase.from('categories').select('id, name, icon, color, type, user_id').order('name');
      setCategories((data ?? []) as AppCategory[]);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadCategories();
      void loadTransactions();
    }
  }, [visible, loadTransactions, loadCategories]);

  const DATE_FILTERS: { key: DateFilter; label: string }[] = [
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
    { key: 'all', label: 'All' },
  ];

  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.name !== 'Transfer');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Transaction</Text>

          {/* Date filter */}
          <View style={styles.filterRow}>
            {DATE_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, dateFilter === f.key && styles.filterChipActive]}
                onPress={() => {
                  logUI(uiPath('tx_picker', 'date_filter', f.key), 'press');
                  setDateFilter(f.key);
                }}
              >
                <Text style={[styles.filterChipText, dateFilter === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category filter */}
          {expenseCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
              <TouchableOpacity
                style={[styles.catChip, !selectedCategoryId && styles.catChipActive]}
                onPress={() => setSelectedCategoryId(null)}
              >
                <Text style={[styles.catChipText, !selectedCategoryId && styles.catChipTextActive]}>All</Text>
              </TouchableOpacity>
              {expenseCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, selectedCategoryId === cat.id && styles.catChipActive]}
                  onPress={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                >
                  {cat.icon ? <Icon name={cat.icon as any} size={12} color={cat.color ?? '#8FA8C9'} /> : null}
                  <Text style={[styles.catChipText, selectedCategoryId === cat.id && styles.catChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {loading ? (
            <Text style={styles.loadingText}>Loading…</Text>
          ) : transactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions found</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {transactions.map((tx) => {
                const color = tx.category_color ?? (tx.type === 'income' ? '#4ade80' : '#f87171');
                return (
                  <TouchableOpacity
                    {...uiProps(uiPath('tx_picker', 'tx_list', 'row', tx.id))}
                    key={tx.id}
                    style={styles.txRow}
                    onPress={() => {
                      logUI(uiPath('tx_picker', 'tx_list', 'row', tx.id), 'press');
                      const { category_name: _cn, category_icon: _ci, category_color: _cc, ...rest } = tx;
                      onSelect(rest as AppTransaction);
                      onClose();
                    }}
                  >
                    <View style={[styles.txIconBox, { backgroundColor: color + '22' }]}>
                      {tx.category_icon
                        ? <Icon name={tx.category_icon as any} size={16} color={color} />
                        : <Text style={{ color, fontSize: 14 }}>{tx.type === 'income' ? '+' : '−'}</Text>
                      }
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txNote} numberOfLines={1}>
                        {tx.note || tx.category_name || (tx.type === 'income' ? 'Income' : 'Expense')}
                      </Text>
                      <Text style={styles.txMeta}>
                        {tx.date}{tx.category_name ? ` · ${tx.category_name}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color }]}>
                      {tx.type === 'income' ? '+' : '−'}{Math.abs(tx.amount).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2C4669',
    marginBottom: 12,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  filterChipActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#0D2137',
  },
  filterChipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#60A5FA' },
  catRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
    marginRight: 6,
  },
  catChipActive: {
    borderColor: '#8FA8C9',
    backgroundColor: '#0D2137',
  },
  catChipText: { color: '#475569', fontSize: 11 },
  catChipTextActive: { color: '#CBD5E1' },
  list: { flex: 1 },
  loadingText: { color: '#475569', textAlign: 'center', marginTop: 24 },
  emptyText: { color: '#475569', textAlign: 'center', marginTop: 24 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1 },
  txNote: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  txMeta: { color: '#475569', fontSize: 11, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: '700' },
});
