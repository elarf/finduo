import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { GpsTrackingProvider } from '../lib/fingo/tracking/GpsTrackingProvider';
import {
  showTrackingNotification,
  cancelTrackingNotification,
} from '../lib/fingo/trackingNotification';
import type { TrackingSession } from '../types/fingo';

const ACTIVE_SESSION_KEY = 'FINGO_ACTIVE_TRACKING_SESSION';

// Module-level provider survives re-renders; GPS watch runs until explicit stop.
const provider = new GpsTrackingProvider();

export type ActiveSessionInfo = {
  sessionId: string;
  assetId: string | null;
  startedAt: string;
  pausedAt: string | null;  // ISO timestamp when current pause started, null when running
  pausedMs: number;          // total accumulated pause duration in ms
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

  // Tick every second. Elapsed excludes all paused time.
  // When paused: currentPauseMs grows at the same rate as (now - startMs), so
  // liveElapsed stays frozen at the value it had at pause time.
  useEffect(() => {
    if (!activeSession) {
      setLiveDistance(0);
      setLiveElapsed(0);
      return;
    }
    const startMs = new Date(activeSession.startedAt).getTime();
    const tick = () => {
      const pausedMs = activeSession.pausedMs;
      const currentPauseMs = activeSession.pausedAt
        ? (Date.now() - new Date(activeSession.pausedAt).getTime())
        : 0;
      setLiveElapsed(Math.round((Date.now() - startMs - pausedMs - currentPauseMs) / 1000));
      if (!activeSession.pausedAt) {
        setLiveDistance(provider.getCurrentDistance());
      }
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
      pausedAt: null,
      pausedMs: 0,
    };

    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(info));
    setActiveSession(info);
    await provider.startSession();
    void showTrackingNotification('active', 0);
  }, [userId]);

  const pauseTracking = useCallback(async () => {
    if (!activeSession || activeSession.pausedAt) return;
    await provider.pauseSession();
    const updated: ActiveSessionInfo = {
      ...activeSession,
      pausedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updated));
    setActiveSession(updated);
    const elapsedMs =
      Date.now() - new Date(activeSession.startedAt).getTime() - activeSession.pausedMs;
    void showTrackingNotification('paused', elapsedMs);
  }, [activeSession]);

  const resumeTracking = useCallback(async () => {
    if (!activeSession?.pausedAt) return;
    const additionalPauseMs = Date.now() - new Date(activeSession.pausedAt).getTime();
    const updated: ActiveSessionInfo = {
      ...activeSession,
      pausedAt: null,
      pausedMs: activeSession.pausedMs + additionalPauseMs,
    };
    await provider.resumeSession();
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updated));
    setActiveSession(updated);
    // Elapsed at the moment pause began (chronometer resumes from this offset)
    const elapsedAtPauseMs =
      new Date(activeSession.pausedAt).getTime() -
      new Date(activeSession.startedAt).getTime() -
      activeSession.pausedMs;
    void showTrackingNotification('active', elapsedAtPauseMs);
  }, [activeSession]);

  const stopTracking = useCallback(async () => {
    const info = activeSession;
    if (!info) return null;

    const { distanceKm, route } = await provider.stopSession();
    const pausedMs = info.pausedMs;
    const currentPauseMs = info.pausedAt
      ? (Date.now() - new Date(info.pausedAt).getTime())
      : 0;
    const elapsedSeconds = Math.round(
      (Date.now() - new Date(info.startedAt).getTime() - pausedMs - currentPauseMs) / 1000,
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
    void cancelTrackingNotification();

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
    isPaused: activeSession?.pausedAt != null,
    liveDistance,
    liveElapsed,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    fetchSessions,
    fetchSession,
  };
}
