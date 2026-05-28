import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { uiPath, uiProps } from '../../lib/devtools';

const PANEL_HEIGHT = 52;

type Props = {
  isActive: boolean;
  isPaused: boolean;
  liveElapsed: number;
  liveDistance: number;
  onPause?: () => void;
  onResume?: () => void;
};

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatDistance(km: number): string {
  if (km < 0.01) return '0 m';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function formatSpeed(km: number, secs: number): string {
  if (!km || secs < 5) return '—';
  return `${((km / secs) * 3600).toFixed(1)} km/h`;
}

export default function TrackingPanel({ isActive, isPaused, liveElapsed, liveDistance, onPause, onResume }: Props) {
  const containerHeight = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(containerHeight, {
      toValue: isActive ? PANEL_HEIGHT : 0,
      useNativeDriver: false,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start();
  }, [isActive, containerHeight]);

  useEffect(() => {
    if (!isActive || isPaused) {
      pulse.setValue(isPaused ? 1 : 0.3);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, isPaused, pulse]);

  return (
    <Animated.View
      {...uiProps(uiPath('fingo', 'tracking_panel', 'container'))}
      style={[styles.wrapper, { height: containerHeight }]}
    >
      <View style={styles.panel}>
        <Animated.View style={[styles.dot, isPaused ? styles.dotPaused : styles.dotActive, { opacity: pulse }]} />
        <Text style={styles.elapsed}>{formatElapsed(liveElapsed)}</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.distance}>{formatDistance(liveDistance)}</Text>
        <Text style={styles.separator}>·</Text>
        {isPaused ? (
          <Text style={styles.pausedLabel}>PAUSED</Text>
        ) : (
          <Text style={styles.speed}>{formatSpeed(liveDistance, liveElapsed)}</Text>
        )}
        <View style={styles.spacer} />
        {isPaused ? (
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'tracking_panel', 'resume_button'))}
            style={styles.controlButton}
            onPress={onResume}
          >
            <Text style={styles.controlButtonText}>▶</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            {...uiProps(uiPath('fingo', 'tracking_panel', 'pause_button'))}
            style={styles.controlButton}
            onPress={onPause}
          >
            <Text style={styles.controlButtonText}>⏸</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  panel: {
    height: PANEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#050D1A',
    borderTopWidth: 1,
    borderTopColor: '#1a2d1a',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#e53e3e',
  },
  dotPaused: {
    backgroundColor: '#f59e0b',
  },
  elapsed: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 48,
  },
  separator: {
    color: '#2A4163',
    fontSize: 14,
  },
  distance: {
    color: '#53E3A6',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 60,
  },
  speed: {
    color: '#aaa',
    fontSize: 13,
  },
  pausedLabel: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  spacer: {
    flex: 1,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a2d1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    color: '#53E3A6',
    fontSize: 14,
  },
});
