import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import {
  computePartHealth, computeIntervalHealthFromLogs,
  formatRemaining, formatIntervalRemaining, healthColor,
} from '../../lib/fingo/health';
import type {
  FinGoAsset, AssetPart, Component, ComponentServiceInterval,
  FinGoSortOrder, UsageLog,
} from '../../types/fingo';
import { uiPath, uiProps, logUI } from '../../lib/devtools';

type DisplayItem = {
  id: string;
  assetName: string;
  label: string;
  remaining: string;
  healthRatio: number;
  isOverdue: boolean;
  onService: () => void;
};

type Props = {
  assets: FinGoAsset[];
  partsByAsset: Record<string, AssetPart[]>;
  componentsByAsset?: Record<string, Component[]>;
  intervals?: Record<string, ComponentServiceInterval[]>;
  usageLogsByAsset?: Record<string, UsageLog[]>;
  sortOrder: FinGoSortOrder;
  onSortChange: (order: FinGoSortOrder) => void;
  onServicePart: (part: AssetPart, asset: FinGoAsset) => void;
  onLogServiceInterval?: (interval: ComponentServiceInterval, component: Component, asset: FinGoAsset) => void;
};

export default function ServiceDashboard({
  assets,
  partsByAsset,
  componentsByAsset,
  intervals,
  usageLogsByAsset,
  sortOrder,
  onSortChange,
  onServicePart,
  onLogServiceInterval,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const items = useMemo<DisplayItem[]>(() => {
    const all: DisplayItem[] = [];

    // Legacy asset parts
    for (const asset of assets) {
      const parts = partsByAsset[asset.id] ?? [];
      for (const part of parts) {
        const health = computePartHealth(part, asset.current_usage);
        all.push({
          id: `part-${part.id}`,
          assetName: asset.name,
          label: part.name,
          remaining: formatRemaining(health.remaining, part.usage_unit),
          healthRatio: Math.max(0, health.healthRatio),
          isOverdue: health.isOverdue,
          onService: () => onServicePart(part, asset),
        });
      }
    }

    // Component service intervals
    if (componentsByAsset && intervals) {
      for (const asset of assets) {
        const comps = componentsByAsset[asset.id] ?? [];
        for (const comp of comps) {
          if (comp.status !== 'installed') continue;
          const compIntervals = intervals[comp.id] ?? [];
          for (const interval of compIntervals) {
            const assetLogs = usageLogsByAsset?.[asset.id] ?? [];
            const health = computeIntervalHealthFromLogs(interval, comp, assetLogs, interval.last_serviced_at ?? null);
            all.push({
              id: `interval-${interval.id}`,
              assetName: asset.name,
              label: `${comp.name} · ${interval.name}`,
              remaining: formatIntervalRemaining(health),
              healthRatio: health.isOverdue ? 0 : Math.max(0, 1 - health.totalSinceService / interval.interval_value),
              isOverdue: health.isOverdue,
              onService: () => onLogServiceInterval?.(interval, comp, asset),
            });
          }
        }
      }
    }

    switch (sortOrder) {
      case 'deadline':
        return [...all].sort((a, b) => a.healthRatio - b.healthRatio);
      case 'name':
        return [...all].sort((a, b) => a.label.localeCompare(b.label));
      case 'priority':
        return [...all].sort((a, b) => {
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          return a.healthRatio - b.healthRatio;
        });
    }
  }, [assets, partsByAsset, componentsByAsset, intervals, usageLogsByAsset, sortOrder, onServicePart, onLogServiceInterval]);

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
          <Text style={styles.emptyText}>No service intervals configured yet.</Text>
          <Text style={styles.emptyHint}>Add components with service intervals to track maintenance.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={showAll ? items : items.slice(0, 3)}
            keyExtractor={(i) => i.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
            const color = healthColor(item.healthRatio);
            return (
              <View
                {...uiProps(uiPath('fingo', 'service_dashboard', 'row', item.id))}
                style={styles.row}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.assetLabel}>{item.assetName}</Text>
                    <Text style={styles.partLabel}>{item.label}</Text>
                    {item.isOverdue && (
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.remaining, { color }]}>
                      {item.remaining}
                    </Text>
                    <TouchableOpacity
                      {...uiProps(uiPath('fingo', 'service_dashboard', 'service_button', item.id))}
                      style={styles.serviceButton}
                      onPress={() => {
                        logUI(uiPath('fingo', 'service_dashboard', 'service_button', item.id), 'press');
                        item.onService();
                      }}
                    >
                      <Text style={styles.serviceButtonText}>✓</Text>
                    </TouchableOpacity>
                  </View>
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
          {items.length > 3 && (
            <TouchableOpacity
              {...uiProps(uiPath('fingo', 'service_dashboard', 'show_all_button'))}
              style={styles.showAllButton}
              onPress={() => {
                logUI(uiPath('fingo', 'service_dashboard', 'show_all_button'), 'press');
                setShowAll((v) => !v);
              }}
            >
              <Text style={styles.showAllText}>
                {showAll ? 'Show less' : `Show all (${items.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </>
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
    textAlign: 'center',
  },
  row: {
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 10,
    paddingTop: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
    alignItems: 'center',
    gap: 8,
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
  showAllButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  showAllText: {
    color: '#3B6A9E',
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    height: 4,
    backgroundColor: '#1F3A59',
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: -10,
    marginBottom: 0,
  },
  barFill: {
    height: 4,
  },
});
