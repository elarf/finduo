import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '../Icon';
import type { Pool } from '../../types/pools';

interface Props {
  pools: Pool[];
  loading: boolean;
  onOpenPool: (pool: Pool) => void;
}

export function PoolListContent({ pools, loading, onOpenPool }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      {loading && <ActivityIndicator color="#53E3A6" style={{ marginTop: 24 }} />}
      {!loading && pools.length === 0 && (
        <View style={s.emptyContainer}>
          <Icon name="Users" size={40} color="#1F3A59" />
          <Text style={s.emptyText}>No pools yet</Text>
          <Text style={s.emptyHint}>Create a pool to split expenses with friends</Text>
        </View>
      )}
      {pools.map((pool) => (
        <TouchableOpacity key={pool.id} style={s.card} onPress={() => onOpenPool(pool)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.poolIcon, pool.status === 'closed' && { opacity: 0.4 }]}>
              <Icon
                name={pool.type === 'event' ? 'CalendarDays' : 'Repeat'}
                size={18}
                color="#53E3A6"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.poolName, pool.status === 'closed' && { color: '#475569' }]}>
                {pool.name}
              </Text>
              <Text style={s.poolMeta}>
                {pool.type === 'event' ? 'Event' : 'Continuous'}
                {pool.status === 'closed' ? ' \u00b7 Closed' : ''}
              </Text>
            </View>
            <Icon name="ChevronRight" size={16} color="#475569" />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#0E1A2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 14,
  },
  poolIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0D2818',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolName: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '600',
  },
  poolMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyHint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
});
