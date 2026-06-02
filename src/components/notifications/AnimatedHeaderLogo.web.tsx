import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Animated, Easing, Image, TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { useNotificationCenter } from '../../context/NotificationCenterContext';
import { getNoNotificationImage, getNotificationImage } from '../../lib/notifications/icons';
import type { NotificationSource } from '../../lib/notifications/types';

type LogoState =
  | 'IDLE_LOGO'
  | 'ANIMATING_TO_FRAME'
  | 'ANIMATING_TO_FRAME_OPEN'
  | 'IDLE_FRAME'
  | 'SHOWING'
  | 'ANIMATING_TO_LOGO';

type LogoAction =
  | { type: 'NEW_NOTIFICATION' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'TAP_LOGO'; wasPanelOpen: boolean }
  | { type: 'CLOSE_PANEL'; hasUnread: boolean };

function logoReducer(state: LogoState, action: LogoAction): LogoState {
  switch (action.type) {
    case 'NEW_NOTIFICATION':
      return state === 'IDLE_LOGO' ? 'ANIMATING_TO_FRAME' : state;

    case 'ANIMATION_COMPLETE':
      if (state === 'ANIMATING_TO_FRAME') return 'IDLE_FRAME';
      if (state === 'ANIMATING_TO_FRAME_OPEN') return 'SHOWING';
      if (state === 'ANIMATING_TO_LOGO') return 'IDLE_LOGO';
      return state;

    case 'TAP_LOGO':
      if (action.wasPanelOpen) {
        return state === 'IDLE_LOGO' ? state : 'ANIMATING_TO_LOGO';
      }
      if (state === 'IDLE_LOGO') return 'ANIMATING_TO_FRAME_OPEN';
      if (state === 'IDLE_FRAME') return 'SHOWING';
      return state;

    case 'CLOSE_PANEL':
      if (state === 'SHOWING' || state === 'IDLE_FRAME') return 'ANIMATING_TO_LOGO';
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

  const prevUnreadCount = useRef(unreadCount);
  const prevIsPanelOpen = useRef(isPanelOpen);
  const crossfade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (unreadCount > prevUnreadCount.current && logoState === 'IDLE_LOGO') {
      dispatch({ type: 'NEW_NOTIFICATION' });
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount, logoState]);

  useEffect(() => {
    const wasPanelOpen = prevIsPanelOpen.current;

    if (wasPanelOpen && !isPanelOpen && (logoState === 'SHOWING' || logoState === 'IDLE_FRAME')) {
      dispatch({ type: 'CLOSE_PANEL', hasUnread: unreadCount > 0 });
    }

    prevIsPanelOpen.current = isPanelOpen;
  }, [isPanelOpen, logoState, unreadCount]);

  // Keep visual state in sync if unread drops to zero while panel is closed.
  useEffect(() => {
    if (!isPanelOpen && logoState === 'IDLE_FRAME' && unreadCount === 0) {
      dispatch({ type: 'CLOSE_PANEL', hasUnread: false });
    }
  }, [isPanelOpen, logoState, unreadCount]);

  const handleTap = () => {
    if (!isPanelOpen) {
      openPanel();
    }
    dispatch({ type: 'TAP_LOGO', wasPanelOpen: isPanelOpen });
  };

  const handleAnimationFinish = () => {
    if (logoState === 'ANIMATING_TO_LOGO') {
      closePanel();
    }
    dispatch({ type: 'ANIMATION_COMPLETE' });
  };

  const typeItems = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) {
      return [{ key: 'none', image: getNoNotificationImage(), count: 0 }];
    }

    const bySource = new Map<NotificationSource, number>();
    for (const n of unread) {
      bySource.set(n.source, (bySource.get(n.source) ?? 0) + 1);
    }

    return Array.from(bySource.entries()).map(([source, count]) => ({
      key: source,
      image: getNotificationImage(source),
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

  const renderTypeItem = (item: { image: ReturnType<typeof getNotificationImage>; count: number }) => (
    <View style={styles.iconContent}>
      <Image source={item.image} style={styles.iconImage} resizeMode="contain" />
      {item.count > 0 && <Text style={styles.countText}>{item.count}</Text>}
    </View>
  );

  return (
    <TouchableOpacity
      onPress={handleTap}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notification center, ${unreadCount} unread` : 'Notification center'}
      accessibilityHint="Opens notification center"
    >
      {logoState === 'IDLE_LOGO' && (
        <Image
          source={require('../../../assets/thelogo.webp')}
          style={styles.logo}
          resizeMode="contain"
        />
      )}

      {(logoState === 'ANIMATING_TO_FRAME' || logoState === 'ANIMATING_TO_FRAME_OPEN') && (
        <Lottie
          key={logoState}
          animationData={require('../../../assets/toframe.json')}
          loop={false}
          autoplay
          style={styles.logo}
          onComplete={handleAnimationFinish}
        />
      )}

      {(logoState === 'IDLE_FRAME' || logoState === 'SHOWING') && (
        <View style={styles.frameContainer}>
          <Image
            source={require('../../../assets/theframe.webp')}
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
        <Lottie
          key={logoState}
          animationData={require('../../../assets/tologo.json')}
          loop={false}
          autoplay
          style={styles.logo}
          onComplete={handleAnimationFinish}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 214,
    height: 66,
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 214,
    height: 66,
    minHeight: 66,
  },
  frameContainer: {
    width: 214,
    height: 66,
    minHeight: 66,
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
  iconImage: {
    width: 28,
    height: 28,
  },
  countText: {
    color: '#F472B6',
    fontSize: 12,
    fontWeight: '700',
  },
});