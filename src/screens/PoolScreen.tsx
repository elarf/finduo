/**
 * PoolScreen
 *
 * Standalone screen for managing pools (shared expense splitting).
 * Uses the existing PoolListModal component for UI.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../hooks/useFriends';
import { usePool } from '../hooks/usePool';
import PoolListModal from '../components/dashboard/PoolListModal';

export default function PoolScreen() {
  const { user } = useAuth();
  const friendsHook = useFriends(user);
  const poolHook = usePool(user);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (user) {
      void friendsHook.loadFriends();
      void poolHook.loadPools();
      void poolHook.loadAllDebts();
    }
  }, [user]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Not authenticated</Text>
      </View>
    );
  }

  if (poolHook.loading && poolHook.pools.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#53E3A6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pools</Text>
        <Text style={styles.subtitle}>Shared expense management</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active pools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Pools</Text>
          {poolHook.pools.filter((p) => p.status === 'active').length === 0 ? (
            <Text style={styles.emptyText}>No active pools yet.</Text>
          ) : (
            poolHook.pools
              .filter((p) => p.status === 'active')
              .map((p) => (
                <View key={p.id} style={styles.poolCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poolName}>{p.name}</Text>
                    <View style={styles.poolMeta}>
                      <Text style={styles.metaBadge}>
                        {p.type === 'event' ? 'Event' : 'Continuous'}
                      </Text>
                      <Text style={styles.metaText}>{p.members.length} members</Text>
                      <Text style={styles.metaText}>
                        {p.currency} {p.totalSpent.toFixed(2)}
                      </Text>
                    </View>
                    {p.unsettledExpenseCount > 0 && (
                      <Text style={styles.unsettledText}>
                        {p.unsettledExpenseCount} unsettled expense{p.unsettledExpenseCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </View>
              ))
          )}
        </View>

        {/* Debts */}
        {poolHook.poolDebts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Debts</Text>
            {poolHook.poolDebts.slice(0, 5).map((d) => {
              const otherName = d.otherUser.display_name ?? d.otherUser.email ?? 'Unknown';
              return (
                <View key={d.id} style={styles.debtCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.debtText}>
                      {d.direction === 'owe' ? `You owe ${otherName}` : `${otherName} owes you`}
                    </Text>
                    <Text style={styles.debtAmount}>
                      {d.currency} {d.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.debtPoolName}>{d.poolName}</Text>
                  </View>
                  <Text
                    style={[
                      styles.statusBadge,
                      d.status === 'paid' && { color: '#4ade80' },
                      d.status === 'confirmed' && { color: '#60a5fa' },
                      d.status === 'disputed' && { color: '#f87171' },
                    ]}
                  >
                    {d.status}
                  </Text>
                </View>
              );
            })}
            {poolHook.poolDebts.length > 5 && (
              <Text style={styles.moreText}>
                +{poolHook.poolDebts.length - 5} more
              </Text>
            )}
          </View>
        )}

        {/* Settled pools */}
        {poolHook.pools.filter((p) => p.status !== 'active').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settled Pools</Text>
            {poolHook.pools
              .filter((p) => p.status !== 'active')
              .slice(0, 3)
              .map((p) => (
                <View key={p.id} style={[styles.poolCard, { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poolName}>{p.name}</Text>
                    <Text style={styles.metaText}>
                      {p.currency} {p.totalSpent.toFixed(2)} total
                    </Text>
                  </View>
                  <Text style={styles.settledBadge}>Settled</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Open full modal button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.primaryButtonText}>Manage Pools</Text>
        </TouchableOpacity>
      </View>

      {/* Full pool management modal */}
      <PoolListModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        friends={friendsHook.friends}
        {...poolHook}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060A14',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#000000',
  },
  title: {
    color: '#EAF3FF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8FA8C9',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#DCEBFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
  },
  poolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  poolName: {
    color: '#EAF3FF',
    fontSize: 15,
    fontWeight: '700',
  },
  poolMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaBadge: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1E3552',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  metaText: {
    color: '#8FA8C9',
    fontSize: 12,
  },
  unsettledText: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 2,
  },
  settledBadge: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142235',
    borderColor: '#1E3552',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  debtText: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  debtAmount: {
    color: '#DCEBFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  debtPoolName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  statusBadge: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  moreText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#000000',
  },
  primaryButton: {
    backgroundColor: '#53E3A6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#060A14',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
});
