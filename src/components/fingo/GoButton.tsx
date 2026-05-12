import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Image } from 'react-native';
import { uiPath, uiProps, logUI } from '../../lib/devtools';
import { TrackingService } from '../../lib/fingo/tracking/TrackingService';
import { FINGO_ASSETS } from '../../lib/fingo/fingoAssets';

type Props = {
  assetId: string | null;
};

export default function GoButton({ assetId }: Props) {
  const mode = TrackingService.provider.mode;

  const handlePress = () => {
    logUI(uiPath('fingo', 'bottom_bar', 'go_button'), 'press');
    // Phase 2: TrackingService.provider.startSession(assetId, currentUsage)
  };

  return (
    <TouchableOpacity
      {...uiProps(uiPath('fingo', 'bottom_bar', 'go_button'))}
      style={[styles.button, !assetId && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={!assetId}
    >
      <Image source={FINGO_ASSETS.gps} style={styles.gpsIcon} resizeMode="contain" />
      <Text style={styles.modeLabel}>{mode}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#053d1e',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#4ade80',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  gpsIcon: {
    width: 36,
    height: 36,
  },
  modeLabel: {
    color: '#4ade80',
    fontSize: 8,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: 1,
  },
});
