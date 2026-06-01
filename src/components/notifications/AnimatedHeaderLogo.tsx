import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Image, TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { useNotificationCenter } from '../../context/NotificationCenterContext';
import { getNotificationIcon } from '../../lib/notifications/icons';
import type { NotificationSource } from '../../lib/notifications/types';

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
      if (state === 'IDLE_LOGO') return 'ANIMATING_TO_FRAME';
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
  const [displayIndex, setDisplayIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  const lottieRef = useRef<LottieView>(null);
  const prevUnreadCount = useRef(unreadCount);
  const crossfade = useRef(new Animated.Value(1)).current;

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

  const typeItems = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) {
      return [{ key: 'none', icon: '🔔', count: 0 }];
    }

    const bySource = new Map<NotificationSource, number>();
    for (const n of unread) {
      bySource.set(n.source, (bySource.get(n.source) ?? 0) + 1);
    }

    return Array.from(bySource.entries()).map(([source, count]) => ({
      key: source,
      icon: getNotificationIcon(source),
      count,
    }));
  }, [notifications]);

  useEffect(() => {
    if (displayIndex >= typeItems.length) {
      setDisplayIndex(0);
      setPreviousIndex(null);
      crossfade.setValue(1);
    }
  }, [displayIndex, typeItems.length, crossfade]);

  useEffect(() => {
    const canLoop =
      isPanelOpen &&
      (logoState === 'IDLE_FRAME' || logoState === 'SHOWING') &&
      typeItems.length > 1;

    if (!canLoop) {
      setPreviousIndex(null);
      crossfade.setValue(1);
      return;
    }

    const interval = setInterval(() => {
      setDisplayIndex((curr) => {
        const next = (curr + 1) % typeItems.length;
        setPreviousIndex(curr);
        crossfade.setValue(0);
        Animated.timing(crossfade, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setPreviousIndex(null);
        });
        return next;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      crossfade.stopAnimation();
    };
  }, [isPanelOpen, logoState, typeItems.length, crossfade]);

  const currentItem = typeItems[displayIndex] ?? typeItems[0];
  const prevItem = previousIndex !== null ? (typeItems[previousIndex] ?? null) : null;

  const renderTypeItem = (item: { icon: string; count: number }) => (
    <View style={styles.iconContent}>
      <Text style={styles.iconText}>{item.icon}</Text>
      {item.count > 0 && <Text style={styles.countText}>{item.count}</Text>}
    </View>
  );

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
            <View style={styles.iconLane}>
              {prevItem && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.iconFadeLayer,
                    {
                      opacity: crossfade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                    },
                  ]}
                >
                  {renderTypeItem(prevItem)}
                </Animated.View>
              )}

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.iconFadeLayer,
                  {
                    opacity: prevItem ? crossfade : 1,
                  },
                ]}
              >
                {renderTypeItem(currentItem)}
              </Animated.View>
            </View>
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
  iconLane: {
    width: 80,
    height: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconFadeLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  iconText: {
    fontSize: 20,
  },
  countText: {
    color: '#F472B6',
    fontSize: 12,
    fontWeight: '700',
  },
});
