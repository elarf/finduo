import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { GpsTrackingProvider } from '../lib/fingo/tracking/GpsTrackingProvider';
import type { TrackingSession } from '../types/fingo';

const ACTIVE_SESSION_KEY = 'FINGO_ACTIVE_TRACKING_SESSION';

// Module-level provider survives re-renders; GPS watch runs until explicit stop.
const provider = new GpsTrackingProvider();

export type ActiveSessionInfo = {
  sessionId: string;
  assetId: string | null;
  startedAt: string;
};

export function useGpsTracking(userId: string | null) {
  const [activeSession, setActiveSession] = useState<ActiveSessionInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [liveDistance, setLiveDistance] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_SESSION_KEY).then(raw => {
      setActiveSession(raw ? (JSON.parse(raw) as ActiveSessionInfo) : null);
      setChecking(false);
    });
  }, []);

  // Tick every second while a session is active to update elapsed time and
  // current distance from the in-memory GPS point buffer.
  useEffect(() => {
    if (!activeSession) {
      setLiveDistance(0);
      setLiveElapsed(0);
      return;
    }
    const startMs = new Date(activeSession.startedAt).getTime();
    const tick = () => {
      setLiveElapsed(Math.round((Date.now() - startMs) / 1000));
      setLiveDistance(provider.getCurrentDistance());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const startTracking = useCallback(async (assetId: string | null) => {
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('tracking_sessions')
      .insert({ asset_id: assetId, route: [] })
      .select('id, started_at')
      .single();

    if (error || !data) throw error ?? new Error('Failed to create session');

    const info: ActiveSessionInfo = {
      sessionId: data.id as string,
      assetId,
      startedAt: data.started_at as string,
    };

    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(info));
    setActiveSession(info);
    await provider.startSession();
  }, [userId]);

  const stopTracking = useCallback(async () => {
    const info = activeSession;
    if (!info) return null;

    const { distanceKm, route } = await provider.stopSession();
    // Elapsed time is always derived from the persisted start time so it
    // remains correct even when the app was killed between start and stop.
    const elapsedSeconds = Math.round(
      (Date.now() - new Date(info.startedAt).getTime()) / 1000,
    );

    await supabase
      .from('tracking_sessions')
      .update({
        ended_at: new Date().toISOString(),
        distance_km: distanceKm,
        elapsed_seconds: elapsedSeconds,
        route,
      })
      .eq('id', info.sessionId);

    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    setActiveSession(null);

    return { ...info, distanceKm, elapsedSeconds, route };
  }, [activeSession]);

  const fetchSessions = useCallback(async (): Promise<TrackingSession[]> => {
    if (!userId) return [];
    const { data } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('created_by', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false });
    return (data ?? []) as TrackingSession[];
  }, [userId]);

  const fetchSession = useCallback(async (sessionId: string): Promise<TrackingSession | null> => {
    const { data } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    return data as TrackingSession | null;
  }, []);

  return {
    activeSession,
    checking,
    liveDistance,
    liveElapsed,
    startTracking,
    stopTracking,
    fetchSessions,
    fetchSession,
  };
}
