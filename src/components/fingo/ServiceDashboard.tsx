import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { computePartHealth, healthColor, formatRemaining } from '../../lib/fingo/health';
import type { FinGoAsset, AssetPart, FinGoSortOrder, PartHealth } from '../../types/fingo';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type ServiceItem = PartHealth & { asset: FinGoAsset };

type Props = {
  assets: FinGoAsset[];
  partsByAsset: Record<string, AssetPart[]>;
  sortOrder: FinGoSortOrder;
  onSortChange: (order: FinGoSortOrder) => void;
  onServicePart: (part: AssetPart, asset: FinGoAsset) => void;
};

export default function ServiceDashboard({
  assets,
  partsByAsset,
  sortOrder,
  onSortChange,
  onServicePart,
}: Props) {
  const items = useMemo<ServiceItem[]>(() => {
    const all: ServiceItem[] = [];
    for (const asset of assets) {
      const parts = partsByAsset[asset.id] ?? [];
      for (const part of parts) {
        all.push({ ...computePartHealth(part, asset.current_usage), asset });
      }
    }

    switch (sortOrder) {
      case 'deadline':
        return [...all].sort((a, b) => a.remaining - b.remaining);
      case 'name':
        return [...all].sort((a, b) => a.part.name.localeCompare(b.part.name));
      case 'priority':
        return [...all].sort((a, b) => b.part.priority - a.part.priority);
    }
  }, [assets, partsByAsset, sortOrder]);

  return (
    <View {...uiProps(uiPath('fingo', 'service_dashboard', 'container'))} style={styles.container}>
      {/* Header + sort controls */}
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Services</Text>
        <View style={styles.sortRow}>
          {(['deadline', 'name', 'priority'] as FinGoSortOrder[]).map((order) => (
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'service_dashboard', 'sort_button', order))}
              key={order}
              style={[styles.sortButton, sortOrder === order && styles.sortButtonActive]}
              onPress={() => {
                logUI(uiPath('fingo', 'service_dashboard', 'sort_button', order), 'press');
                onSortChange(order);
              }}
            >
              <Text style={[styles.sortText, sortOrder === order && styles.sortTextActive]}>
                {order === 'deadline' ? '⏱ Deadline' : order === 'name' ? 'A–Z' : '↑ Priority'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No parts configured yet.</Text>
          <Text style={styles.emptyHint}>Add parts to your assets to track service intervals.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.part.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const color = healthColor(item.healthRatio);
            return (
              <View
                {...uiProps(uiPath('fingo', 'service_dashboard', 'row', item.part.id))}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.assetLabel}>{item.asset.name}</Text>
                  <Text style={styles.partLabel}>{item.part.name}</Text>
                  {item.isOverdue && (
                    <View style={styles.overdueBadge}>
                      <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.remaining, { color }]}>
                    {formatRemaining(item.remaining, item.part.usage_unit)}
                  </Text>
                  <TouchableOpacity
                    {...uiProps(uiPath('fingo', 'service_dashboard', 'service_button', item.part.id))}
                    style={styles.serviceButton}
                    onPress={() => {
                      logUI(uiPath('fingo', 'service_dashboard', 'service_button', item.part.id), 'press');
                      onServicePart(item.part, item.asset);
                    }}
                  >
                    <Text style={styles.serviceButtonText}>✓</Text>
                  </TouchableOpacity>
                </View>
                {/* Bottom bar indicator */}
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    { width: `${Math.max(0, Math.min(1, item.healthRatio)) * 100}%` as any, backgroundColor: color },
                  ]} />
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  sortButtonActive: {
    borderColor: '#3B6A9E',
    backgroundColor: '#0D2137',
  },
  sortText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  sortTextActive: {
    color: '#8FA8C9',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
  },
  emptyHint: {
    color: '#334155',
    fontSize: 11,
    marginTop: 4,
  },
  row: {
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    padding: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  assetLabel: {
    color: '#475569',
    fontSize: 11,
  },
  partLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  overdueBadge: {
    backgroundColor: '#7f1d1d',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  overdueBadgeText: {
    color: '#fca5a5',
    fontSize: 9,
    fontWeight: '700',
  },
  rowRight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  remaining: {
    fontSize: 13,
    fontWeight: '700',
  },
  serviceButton: {
    backgroundColor: '#053d1e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4ade80',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    backgroundColor: '#1F3A59',
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: -10,
    marginBottom: -10,
  },
  barFill: {
    height: 4,
  },
});
