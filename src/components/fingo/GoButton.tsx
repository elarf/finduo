import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { Capacitor } from '@capacitor/core';
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import { FINGO_ASSETS } from '../../lib/fingo/fingoAssets';

type Props = {
  assetId: string | null;
  isTracking: boolean;
  gpsReady: boolean;
  onPress: () => void;
};

const isNative = Capacitor.isNativePlatform();

export default function GoButton({ assetId, isTracking, gpsReady, onPress }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isTracking) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTracking, pulse]);

  const canStart = isNative && gpsReady;
  const disabled = isTracking ? false : !canStart;

  const borderColor = isTracking ? '#e53e3e' : canStart ? '#4ade80' : '#1F3A59';
  const bgColor = isTracking ? '#3d0f0f' : canStart ? '#053d1e' : '#0E1A2B';

  const handlePress = () => {
    logUI(uiPath('fingo', 'bottom_bar', 'go_button'), 'press');
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        {...uiProps(uiPath('fingo', 'bottom_bar', 'go_button'))}
        style={[styles.button, { borderColor, backgroundColor: bgColor }]}
        onPress={handlePress}
        disabled={disabled}
      >
        <ImageBackground
          source={FINGO_ASSETS.gps}
          style={styles.background}
          imageStyle={styles.backgroundImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 32,
    borderWidth: 2,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  backgroundImage: {
    borderRadius: 30,
  },
});
