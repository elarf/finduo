import React, { useEffect, useReducer, useRef } from 'react';
import { Image, TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { useNotificationCenter } from '../../context/NotificationCenterContext';
import { getNotificationIcon } from '../../lib/notifications/icons';

type LogoState =
  | 'IDLE_LOGO'
  | 'ANIMATING_TO_FRAME'
  | 'IDLE_FRAME'
  | 'SHOWING'
  | 'ANIMATING_TO_LOGO';

type LogoAction =
  | { type: 'NEW_NOTIFICATION' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'TAP_LOGO' }
  | { type: 'CLOSE_PANEL' };

function logoReducer(state: LogoState, action: LogoAction): LogoState {
  switch (action.type) {
    case 'NEW_NOTIFICATION':
      return state === 'IDLE_LOGO' ? 'ANIMATING_TO_FRAME' : state;

    case 'ANIMATION_COMPLETE':
      if (state === 'ANIMATING_TO_FRAME') return 'IDLE_FRAME';
      if (state === 'ANIMATING_TO_LOGO') return 'IDLE_LOGO';
      return state;

    case 'TAP_LOGO':
      return state;

    case 'CLOSE_PANEL':
      if (state === 'SHOWING' || state === 'IDLE_FRAME') {
        // Only animate back to logo if no unread notifications remain
        return 'ANIMATING_TO_LOGO';
      }
      return state;

    default:
      return state;
  }
}

export default function AnimatedHeaderLogo() {
  const { unreadCount, isPanelOpen, openPanel, closePanel, notifications } = useNotificationCenter();
  const [logoState, dispatch] = useReducer(logoReducer, unreadCount > 0 ? 'IDLE_FRAME' : 'IDLE_LOGO');

  const lottieRef = useRef<LottieView>(null);
  const prevUnreadCount = useRef(unreadCount);
  const cycleIndexRef = useRef(0);

  // Detect new notifications
  useEffect(() => {
    if (unreadCount > prevUnreadCount.current && logoState === 'IDLE_LOGO') {
      dispatch({ type: 'NEW_NOTIFICATION' });
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount, logoState]);

  // Handle panel close
  useEffect(() => {
    if (!isPanelOpen && (logoState === 'SHOWING' || logoState === 'IDLE_FRAME')) {
      if (unreadCount === 0) {
        dispatch({ type: 'CLOSE_PANEL' });
      }
    }
  }, [isPanelOpen, logoState, unreadCount]);

  const handleTap = () => {
    openPanel();
    dispatch({ type: 'TAP_LOGO' });
  };

  const handleAnimationFinish = () => {
    dispatch({ type: 'ANIMATION_COMPLETE' });
  };

  // Get cycling icon for IDLE_FRAME state
  const getFrameIcon = () => {
    const unreadNotifs = notifications.filter((n) => !n.isRead);
    if (unreadNotifs.length === 0) return '🔔';

    // Simple cycling through unread notification types
    const index = cycleIndexRef.current % unreadNotifs.length;
    return getNotificationIcon(unreadNotifs[index].source);
  };

  // Cycle icons every 2 seconds
  useEffect(() => {
    if (logoState === 'IDLE_FRAME' || logoState === 'SHOWING') {
      const interval = setInterval(() => {
        cycleIndexRef.current += 1;
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [logoState]);

  return (
    <TouchableOpacity onPress={handleTap} style={styles.container}>
      {logoState === 'IDLE_LOGO' && (
        <Image
          source={require('../../../assets/thelogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      )}

      {logoState === 'ANIMATING_TO_FRAME' && (
        <LottieView
          ref={lottieRef}
          source={require('../../../assets/toframe.json')}
          autoPlay
          loop={false}
          style={styles.logo}
          onAnimationFinish={handleAnimationFinish}
        />
      )}

      {(logoState === 'IDLE_FRAME' || logoState === 'SHOWING') && (
        <View style={styles.frameContainer}>
          <Image
            source={require('../../../assets/theframe.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.iconOverlay}>
            <Text style={styles.iconText}>{getFrameIcon()}</Text>
            {unreadCount > 0 && (
              <Text style={styles.countText}>{unreadCount}</Text>
            )}
          </View>
        </View>
      )}

      {logoState === 'ANIMATING_TO_LOGO' && (
        <LottieView
          ref={lottieRef}
          source={require('../../../assets/tologo.json')}
          autoPlay
          loop={false}
          style={styles.logo}
          onAnimationFinish={handleAnimationFinish}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 168,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 168,
    height: 52,
  },
  frameContainer: {
    width: 168,
    height: 52,
    position: 'relative',
  },
  iconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  countText: {
    color: '#F472B6',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
