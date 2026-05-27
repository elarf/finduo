import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import type { RootStackParamList } from '../navigation';
import { useAuth } from '../context/AuthContext';
import { useGpsTracking } from '../hooks/useGpsTracking';
import AppHeader from '../components/AppHeader';
import type { TrackingSession, RoutePoint } from '../types/fingo';

type RouteType = RouteProp<RootStackParamList, 'JourneyDetail'>;

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

function formatAvgSpeed(km: number | null, secs: number | null): string {
  if (!km || !secs || secs === 0) return '—';
  const hours = secs / 3600;
  return `${(km / hours).toFixed(1)} km/h`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const SVG_W = 320;
const SVG_H = 200;

function normalizePoints(points: RoutePoint[]): string {
  if (points.length < 2) return '';

  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const pad = 16;

  return points
    .map(p => {
      const x = pad + ((p.lng - minLng) / lngRange) * (SVG_W - pad * 2);
      // Invert y: higher lat = lower y value on screen
      const y = pad + ((maxLat - p.lat) / latRange) * (SVG_H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function JourneyDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { bottom } = useSafeAreaInsets();
  const { fetchSession } = useGpsTracking(userId);
  const [session_data, setSessionData] = useState<TrackingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession(route.params.sessionId).then(data => {
      setSessionData(data);
      setLoading(false);
    });
  }, [fetchSession, route.params.sessionId]);

  const polylinePoints = session_data?.route?.length
    ? normalizePoints(session_data.route)
    : '';

  return (
    <View style={styles.container}>
      <AppHeader onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#53E3A6" />
        </View>
      ) : !session_data ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Session not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom + 24 }}>
          <Text style={styles.dateLabel}>{formatDateTime(session_data.started_at)}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDistance(session_data.distance_km)}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(session_data.elapsed_seconds)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {formatAvgSpeed(session_data.distance_km, session_data.elapsed_seconds)}
              </Text>
              <Text style={styles.statLabel}>Avg Speed</Text>
            </View>
          </View>

          {/* Route SVG */}
          <View style={styles.mapContainer}>
            {polylinePoints ? (
              <Svg width={SVG_W} height={SVG_H}>
                <Polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#53E3A6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : (
              <View style={styles.noRoute}>
                <Text style={styles.noRouteText}>No route data recorded</Text>
              </View>
            )}
          </View>

          <Text style={styles.routeNote}>
            {session_data.route?.length
              ? `${session_data.route.length} GPS points recorded`
              : 'GPS points are only collected while the app is in the foreground.'}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A14' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#888', fontSize: 14 },
  dateLabel: {
    color: '#888',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  mapContainer: {
    margin: 20,
    backgroundColor: '#0e1220',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    height: SVG_H,
  },
  noRoute: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  noRouteText: { color: '#444', fontSize: 13 },
  routeNote: {
    color: '#555',
    fontSize: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
});
