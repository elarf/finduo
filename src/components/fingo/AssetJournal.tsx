import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import type { UsageLog, ComponentServiceRecord } from '../../types/fingo';
import { FINGO_ASSETS } from '../../lib/fingo/fingoAssets';
import { uiPath, uiProps } from '../../lib/devtools';

type JournalEntry =
  | { type: 'ride'; log: UsageLog }
  | { type: 'service_group'; services: ComponentServiceRecord[]; hourKey: string };

function formatMovingTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getHourKey(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).slice(0, -3);
}

interface Props {
  usageLogs: UsageLog[];
  serviceRecords: ComponentServiceRecord[];
  assetType: string;
  onRidePress?: (log: UsageLog) => void;
}

export default function AssetJournal({ usageLogs, serviceRecords, assetType, onRidePress }: Props) {
  const [displayedCount, setDisplayedCount] = useState(6);
  const [loadMoreClicks, setLoadMoreClicks] = useState(0);

  const journal: JournalEntry[] = useMemo(() => {
    const entries: JournalEntry[] = [];

    for (const log of usageLogs) {
      entries.push({ type: 'ride', log });
    }

    const servicesByHour = new Map<string, ComponentServiceRecord[]>();
    for (const service of serviceRecords) {
      const hour = getHourKey(service.serviced_at);
      if (!servicesByHour.has(hour)) servicesByHour.set(hour, []);
      servicesByHour.get(hour)!.push(service);
    }

    for (const [hourKey, services] of servicesByHour) {
      entries.push({ type: 'service_group', services, hourKey });
    }

    entries.sort((a, b) => {
      const aTime = a.type === 'ride' ? new Date(a.log.recorded_at).getTime() : new Date(a.services[0]!.serviced_at).getTime();
      const bTime = b.type === 'ride' ? new Date(b.log.recorded_at).getTime() : new Date(b.services[0]!.serviced_at).getTime();
      return bTime - aTime;
    });

    return entries;
  }, [usageLogs, serviceRecords]);

  const visibleEntries = journal.slice(0, displayedCount);
  const hasMore = visibleEntries.length < journal.length;

  const handleLoadMore = () => {
    setDisplayedCount((prev) => prev + 6);
    setLoadMoreClicks((prev) => prev + 1);
  };

  const handleShowMore = () => {
    setDisplayedCount((prev) => prev + 6);
  };

  const handleShowAll = () => {
    setDisplayedCount(journal.length);
  };

  const showOptions = loadMoreClicks >= 2;

  if (journal.length === 0) {
    return <Text style={styles.emptyText}>No rides or services logged yet.</Text>;
  }

  return (
    <View>
      {visibleEntries.map((entry) => {
        if (entry.type === 'ride') {
          return (
            <TouchableOpacity
              key={`ride-${entry.log.id}`}
              style={styles.rideRow}
              {...uiProps(uiPath('fingo', 'asset_accordion', 'ride_log_row', entry.log.id))}
              onPress={() => onRidePress?.(entry.log)}
              activeOpacity={0.7}
            >
              <Image source={FINGO_ASSETS.ride} style={styles.logRideImage} resizeMode="contain" />
              <View style={styles.logRowContent}>
                <View style={styles.logLeft}>
                  <Text style={styles.logDate}>
                    {new Date(entry.log.recorded_at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </Text>
                  {entry.log.notes ? (
                    <Text style={styles.logNotes} numberOfLines={1}>{entry.log.notes}</Text>
                  ) : null}
                </View>
                <View style={styles.logRight}>
                  {assetType === 'shoe' ? (
                    <Text style={styles.logDelta}>+{entry.log.usage_delta.toLocaleString()} steps</Text>
                  ) : (
                    <>
                      <Text style={styles.logDelta}>+{entry.log.usage_delta.toLocaleString()} km</Text>
                      {entry.log.moving_time_delta != null && (
                        <Text style={styles.logMeta}>{formatMovingTime(entry.log.moving_time_delta)}</Text>
                      )}
                      {assetType === 'bike' && entry.log.elevation_delta != null && (
                        <Text style={styles.logMeta}>+{entry.log.elevation_delta.toLocaleString()} m</Text>
                      )}
                    </>
                  )}
                  <Text style={styles.logEditHint}>tap to edit</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <ServiceGroupRow
            key={`service-group-${entry.hourKey}`}
            entry={entry}
          />
        );
      })}

      {hasMore && !showOptions && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      )}

      {hasMore && showOptions && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.optionBtn, styles.optionBtnFirst]} onPress={handleShowMore}>
            <Text style={styles.optionBtnText}>Show More</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionBtn, styles.optionBtnSecond]} onPress={handleShowAll}>
            <Text style={styles.optionBtnText}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ServiceGroupRow({ entry }: { entry: Extract<JournalEntry, { type: 'service_group' }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={styles.serviceGroupHeader}
        onPress={() => setExpanded(!expanded)}
        {...uiProps(uiPath('fingo', 'asset_accordion', 'service_group_toggle', entry.hourKey))}
      >
        <View style={styles.serviceGroupLeft}>
          <Text style={styles.serviceGroupCount}>{entry.services.length} service{entry.services.length > 1 ? 's' : ''}</Text>
          <Text style={styles.serviceGroupTime}>{entry.hourKey}</Text>
        </View>
        <Text style={styles.serviceGroupChevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {expanded && entry.services.map((service) => (
        <View key={service.id} style={styles.serviceRow}>
          <Image source={FINGO_ASSETS.fix} style={styles.serviceTypeIcon} resizeMode="contain" />
          <View style={styles.serviceBody}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceMeta}>
              {new Date(service.serviced_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </Text>
            {service.notes ? <Text style={styles.serviceNotes} numberOfLines={2}>{service.notes}</Text> : null}
          </View>
          {service.cost != null && (
            <Text style={styles.serviceCost}>
              {service.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: '#3fe3f2',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
  // Ride rows
  rideRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
  },
  logRideImage: {
    width: 44,
    alignSelf: 'stretch',
    backgroundColor: '#000000',
  },
  logRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    gap: 8,
  },
  logLeft: { flex: 1 },
  logDate: { color: '#64748B', fontSize: 12 },
  logNotes: { color: '#475569', fontSize: 11, marginTop: 1 },
  logRight: { alignItems: 'flex-end' },
  logDelta: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  logMeta: { color: '#64748B', fontSize: 11, marginTop: 1 },
  logEditHint: { color: '#334155', fontSize: 9, marginTop: 2 },
  // Service group
  serviceGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E1A2B',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
  },
  serviceGroupLeft: {
    flex: 1,
  },
  serviceGroupCount: {
    color: '#3fe3f2',
    fontSize: 12,
    fontWeight: '600',
  },
  serviceGroupTime: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  serviceGroupChevron: {
    color: '#3B6A9E',
    fontSize: 14,
    marginLeft: 8,
  },
  // Service rows (expanded)
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderColor: '#0E1A2B',
    paddingRight: 8,
    marginBottom: 4,
  },
  serviceTypeIcon: {
    width: 44,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  serviceBody: {
    flex: 1,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  serviceName: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  serviceMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  serviceNotes: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  serviceCost: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
    paddingRight: 4,
  },
  // Pagination
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    color: '#3B6A9E',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    alignItems: 'center',
  },
  optionBtnFirst: {
    backgroundColor: '#0E1A2B',
  },
  optionBtnSecond: {
    backgroundColor: '#053d1e',
    borderColor: '#4ade80',
  },
  optionBtnText: {
    color: '#3B6A9E',
    fontSize: 12,
    fontWeight: '600',
  },
});
