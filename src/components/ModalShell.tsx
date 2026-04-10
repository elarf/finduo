import React from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

type ModalShellProps = {
  children: React.ReactNode;
  onDismiss?: () => void;
  maxWidth?: number;
  fullscreen?: boolean;
};

/**
 * Reusable modal shell for route-based modal screens.
 * Provides backdrop with dismiss gesture and responsive card layout.
 */
export function ModalShell({ children, onDismiss, maxWidth = 390, fullscreen = false }: ModalShellProps) {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1024;

  return (
    <View style={[styles.backdrop, isWide && styles.backdropDesktop]}>
      {/* Backdrop dismiss (desktop only) */}
      {isWide && onDismiss && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      )}

      {/* Modal card */}
      <View
        style={[
          fullscreen ? styles.cardFullscreen : styles.card,
          isWide && !fullscreen && { width: maxWidth, maxHeight: '90%', borderRadius: 16, overflow: 'hidden' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropDesktop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#060A14',
  },
  cardFullscreen: {
    flex: 1,
    backgroundColor: '#060A14',
  },
});
