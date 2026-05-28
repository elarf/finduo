import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
};

export default function LoadingOverlay({ visible }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      Animated.timing(opacity, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true,
      }).start();
    } else if (mountedRef.current) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacity]);

  if (!visible && !mountedRef.current) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Image
        source={require('../../assets/fdstar.gif')}
        style={styles.spinner}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  spinner: {
    width: '100%',
    aspectRatio: 1,
  },
});
