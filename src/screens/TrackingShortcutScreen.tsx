import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useGpsTracking } from '../hooks/useGpsTracking';
import TrackingAnimationOverlay from '../components/fingo/TrackingAnimationOverlay';

type Phase = 'loading' | 'starting' | 'stopping';

export default function TrackingShortcutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { activeSession, checking, startTracking, stopTracking } = useGpsTracking(userId);
  const [phase, setPhase] = useState<Phase>('loading');
  const actionTaken = useRef(false);
  // Both the animation and the async op must finish before we minimize.
  const animDone = useRef(false);
  const opDone = useRef(false);

  const tryMinimize = () => {
    if (!animDone.current || !opDone.current) return;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.minimizeApp();
    }
  };

  useEffect(() => {
    if (checking || actionTaken.current) return;
    actionTaken.current = true;

    if (activeSession) {
      setPhase('stopping');
      void stopTracking()
        .catch(e => console.warn('GPS stop error:', e))
        .finally(() => {
          opDone.current = true;
          tryMinimize();
        });
    } else {
      setPhase('starting');
      void startTracking(null)
        .catch(e => console.warn('GPS start error:', e))
        .finally(() => {
          opDone.current = true;
          tryMinimize();
        });
    }
  }, [checking, activeSession, startTracking, stopTracking]);

  const handleAnimComplete = () => {
    animDone.current = true;
    tryMinimize();
  };

  return (
    <View style={styles.container}>
      {phase === 'loading' && (
        <Image
          source={require('../../assets/fdstar.gif')}
          style={styles.image}
          resizeMode="contain"
        />
      )}

      {phase === 'starting' && (
        <TrackingAnimationOverlay
          source={require('../../assets/burnout.gif')}
          onComplete={handleAnimComplete}
        />
      )}

      {phase === 'stopping' && (
        <TrackingAnimationOverlay
          source={require('../../assets/driftstop.webp')}
          onComplete={handleAnimComplete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
