import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { logUI, uiPath, uiProps } from '../../lib/devtools';
import Icon from '../Icon';
import type { PoolMember, PoolTransaction } from '../../types/pools';

interface Props {
  transactions: PoolTransaction[];
  loading: boolean;
  members: PoolMember[];
  currentUserId: string;
  poolCreatedBy: string;
  onEdit: (tx: PoolTransaction) => void;
  onDelete: (txId: string, poolId: string) => void;
}

export function TransactionList({
  transactions,
  loading,
  members,
  currentUserId,
  poolCreatedBy,
  onEdit,
  onDelete,
}: Props) {
  useEffect(() => {
    logUI(uiPath('pool', 'tx_list', 'scroll_view'), 'mounted');
  }, []);

  return (
    <>
      <Text style={s.sectionTitle} {...uiProps(uiPath('pool', 'tx_list', 'title'))}>Transactions</Text>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        {...uiProps(uiPath('pool', 'tx_list', 'scroll_view'))}
      >
        {loading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 12 }} />}
        {!loading && transactions.length === 0 && (
          <Text style={s.emptyText} {...uiProps(uiPath('pool', 'tx_list', 'empty_text'))}>
            No transactions yet
          </Text>
        )}
        {transactions.map((tx) => {
          const payer = members.find((m) => m.user_id === tx.paid_by || m.id === tx.paid_by);
          const payerLabel =
            payer?.display_name ??
            (tx.paid_by === currentUserId ? 'You' : tx.paid_by?.slice(0, 8));
          const canDelete = tx.paid_by === currentUserId || poolCreatedBy === currentUserId;
          const rowPath = uiPath('pool', 'tx_list', 'row', tx.id);
          return (
            <TouchableOpacity
              key={tx.id}
              style={s.row}
              onPress={() => {
                logUI(rowPath, 'press');
                onEdit(tx);
              }}
              activeOpacity={0.7}
              {...uiProps(rowPath)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.description} {...uiProps(uiPath('pool', 'tx_list', 'description', tx.id))}>
                  {tx.description || 'Expense'}
                </Text>
                <Text style={s.meta} {...uiProps(uiPath('pool', 'tx_list', 'meta', tx.id))}>
                  {tx.date} &middot; {payerLabel}
                </Text>
              </View>
              <Text style={s.amount} {...uiProps(uiPath('pool', 'tx_list', 'amount', tx.id))}>
                {Number(tx.amount).toFixed(2)}
              </Text>
              {canDelete && (
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => {
                    logUI(uiPath('pool', 'tx_list', 'delete_button', tx.id), 'press');
                    Alert.alert('Delete', 'Remove this expense?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => onDelete(tx.id, tx.pool_id),
                      },
                    ]);
                  }}
                  {...uiProps(uiPath('pool', 'tx_list', 'delete_button', tx.id))}
                >
                  <Icon name="Trash2" size={14} color="#f87171" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#101A2A',
    gap: 10,
  },
  description: {
    color: '#EAF3FF',
    fontSize: 14,
  },
  meta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  amount: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
  },
});
