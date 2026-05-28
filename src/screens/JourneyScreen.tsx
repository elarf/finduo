import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';
import { useAuth } from '../context/AuthContext';
import { useGpsTracking } from '../hooks/useGpsTracking';
import AppHeader from '../components/AppHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import type { TrackingSession } from '../types/fingo';

function formatDistance(km: number | null): string {
  if (km == null || km === 0) return '0 m';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function formatDuration(secs: number | null): string {
  if (secs == null) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function JourneyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { bottom } = useSafeAreaInsets();
  const { fetchSessions } = useGpsTracking(userId);
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSessions().then(data => {
        setSessions(data);
        setLoading(false);
      });
    }, [fetchSessions]),
  );

  return (
    <View style={styles.container}>
      <AppHeader onBack={() => navigation.goBack()} />

      {sessions.length === 0 && !loading ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No rides recorded yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: bottom + 16, paddingTop: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('JourneyDetail', { sessionId: item.id })}
              activeOpacity={0.7}
            >
              <Text style={styles.distance}>{formatDistance(item.distance_km)}</Text>
              <View style={styles.meta}>
                <Text style={styles.date}>{formatDateTime(item.started_at)}</Text>
                <Text style={styles.duration}>{formatDuration(item.elapsed_seconds)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <LoadingOverlay visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A14' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#888', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  distance: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    width: 90,
  },
  meta: { flex: 1, marginLeft: 12 },
  date: { color: '#aaa', fontSize: 13 },
  duration: { color: '#53E3A6', fontSize: 13, marginTop: 2 },
});
