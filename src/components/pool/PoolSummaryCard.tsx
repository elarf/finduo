import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  total: number;
  memberCount: number;
  perPerson: number;
}

export function PoolSummaryCard({ total, memberCount, perPerson }: Props) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.label}>Total</Text>
        <Text style={s.value}>{total.toFixed(2)}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Members</Text>
        <Text style={s.value}>{memberCount}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Per person</Text>
        <Text style={s.value}>{perPerson.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#64748B',
    fontSize: 13,
  },
  value: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
});
