import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { healthColor, formatRemaining } from '../../lib/fingo/health';
import type { PartHealth } from '../../types/fingo';

type Props = {
  partHealth: PartHealth;
  onService: () => void;
};

export default function PartHealthBar({ partHealth, onService }: Props) {
  const { part, healthRatio, remaining, isOverdue } = partHealth;
  const color = healthColor(healthRatio);
  const barWidth = `${Math.max(0, Math.min(1, healthRatio)) * 100}%` as any;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={styles.partName}>{part.name}</Text>
          {isOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>OVERDUE</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.serviceButton} onPress={onService}>
          <Text style={styles.serviceButtonText}>✓ Service</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: barWidth, backgroundColor: color }]} />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.remaining, { color }]}>
          {formatRemaining(remaining, part.usage_unit)}
        </Text>
        <Text style={styles.interval}>
          / {part.reset_interval.toLocaleString()} {part.usage_unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E1A2B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  partName: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
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
  serviceButton: {
    backgroundColor: '#0D2137',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serviceButtonText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
  },
  barTrack: {
    height: 6,
    backgroundColor: '#1F3A59',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  remaining: {
    fontSize: 12,
    fontWeight: '700',
  },
  interval: {
    color: '#475569',
    fontSize: 11,
  },
});
