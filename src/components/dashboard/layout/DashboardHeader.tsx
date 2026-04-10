import React, { useEffect, useRef } from 'react';
import { Image, PanResponder, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

interface DashboardHeaderProps {
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export default function DashboardHeader({ onBack, rightElement }: DashboardHeaderProps) {
  const navigation = useNavigation<any>();
  const {
    avatarUrl,
    user,
    isDesktopBrowser,
    desktopView,
    setViewModeOverride,
    setMenuAccountsExpanded,
    setMenuIncomeCatExpanded,
    setMenuExpenseCatExpanded,
    setMenuTagsExpanded,
    setMenuAccountsEditMode,
    setMenuIncomeCatEditMode,
    setMenuExpenseCatEditMode,
    setMenuTagsEditMode,
    avatarImgError,
    setAvatarImgError,
    reloading,
    reloadDashboard,
    width,
  } = useDashboard();

  // Keep a stable ref so PanResponder doesn't capture stale closures
  const reloadRef = useRef({ reloading, reloadDashboard });
  useEffect(() => { reloadRef.current = { reloading, reloadDashboard }; }, [reloading, reloadDashboard]);

  const spinnerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 30,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -20 && !reloadRef.current.reloading) {
          void reloadRef.current.reloadDashboard();
        }
      },
    })
  ).current;

  // Avatar-to-spinner swipe gesture for entering FinBiome (mobile-web only)
  const avatarToSpinnerThreshold = Math.max(150, width * 0.5); // 50% of screen width or 150px minimum
  const avatarToSpinnerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Detect rightward swipe from avatar (mobile-web only)
        return !isDesktopBrowser && gs.dx > 30 && Math.abs(gs.dy) < 40;
      },
      onPanResponderGrant: () => {
        // Visual feedback: haptic
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      },
      onPanResponderRelease: (_, gs) => {
        // If swipe reached threshold, navigate to FinBiome
        if (gs.dx > avatarToSpinnerThreshold) {
          logUI(uiPath('dashboard', 'header', 'avatar_swipe_to_finbiome'), 'gesture');
          navigation.navigate('FinBiome');
        }
      },
    })
  ).current;

  return (
    <View style={styles.headerRow} {...uiProps(uiPath('dashboard', 'header', 'container'))}>
      {onBack ? (
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => {
            logUI(uiPath('dashboard', 'header', 'back_button'), 'press');
            onBack();
          }}
          {...uiProps(uiPath('dashboard', 'header', 'back_button'))}
        >
          <Icon name="arrow-left" size={24} color="#00F5D4" />
        </TouchableOpacity>
      ) : (
        <View {...avatarToSpinnerPan.panHandlers}>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => {
              logUI(uiPath('dashboard', 'header', 'avatar_button'), 'press');
              setMenuAccountsExpanded(false);
              setMenuIncomeCatExpanded(false);
              setMenuExpenseCatExpanded(false);
              setMenuTagsExpanded(false);
              setMenuAccountsEditMode(false);
              setMenuIncomeCatEditMode(false);
              setMenuExpenseCatEditMode(false);
              setMenuTagsEditMode(false);
              navigation.navigate('QuickNav');
            }}
            {...uiProps(uiPath('dashboard', 'header', 'avatar_button'))}
          >
            {avatarUrl && !avatarImgError ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImg}
                onError={() => {
                  logUI(uiPath('dashboard', 'header', 'avatar_image'), 'avatar_error');
                  setAvatarImgError(true);
                }}
                {...uiProps(uiPath('dashboard', 'header', 'avatar_image'))}
              />
            ) : (
              <View style={styles.avatarFallback} {...uiProps(uiPath('dashboard', 'header', 'avatar_fallback'))}>
                <Text style={styles.avatarFallbackText} {...uiProps(uiPath('dashboard', 'header', 'avatar_initial'))}>
                  {(user?.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
      {/* Logo: absolutely centred */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.headerLogoCenter} pointerEvents="box-none">
          <Image
            source={require('../../../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            {...uiProps(uiPath('dashboard', 'header', 'logo'))}
          />
        </View>
      </View>
      {/* Spacer so avatar and toggle don't overlap the logo */}
      <View style={{ flex: 1 }} pointerEvents="none" />
      {rightElement ? (
        rightElement
      ) : isDesktopBrowser ? (
        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => {
            logUI(uiPath('dashboard', 'header', 'finbiome_button'), 'press');
            navigation.navigate('FinBiome');
          }}
          accessibilityLabel="Enter FinBiome"
          {...uiProps(uiPath('dashboard', 'header', 'finbiome_button'))}
        >
          <Icon
            name="tree-deciduous"
            size={20}
            color="#00F5D4"
          />
        </TouchableOpacity>
      ) : (
        <View {...spinnerPan.panHandlers}>
          <TouchableOpacity
            onPress={() => { void reloadDashboard(); }}
            disabled={reloading}
            {...uiProps(uiPath('dashboard', 'header', 'spinner'))}
          >
            <Image
              source={reloading
                ? require('../../../../assets/fdstar.gif')
                : require('../../../../assets/spinner.gif')}
              style={{ width: 36, height: 36 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
