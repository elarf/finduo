import React, { useEffect, useRef } from 'react';
import { Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logUI, uiPath, uiProps } from '../../../lib/devtools';
import { useDashboard } from '../../../context/DashboardContext';
import Icon from '../../Icon';
import { styles } from '../../../screens/DashboardScreen.styles';

export default function DashboardHeader() {
  const {
    avatarUrl,
    user,
    isDesktopBrowser,
    desktopView,
    setViewModeOverride,
    setMenuOpen,
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

  return (
    <View style={styles.headerRow} {...uiProps(uiPath('dashboard', 'header', 'container'))}>
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
          setMenuOpen(true);
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
      {isDesktopBrowser ? (
        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => {
            logUI(uiPath('dashboard', 'header', 'view_toggle_button'), 'press');
            setViewModeOverride(desktopView ? 'mobile' : 'desktop');
          }}
          accessibilityLabel={desktopView ? 'Switch to mobile view' : 'Switch to desktop view'}
          {...uiProps(uiPath('dashboard', 'header', 'view_toggle_button'))}
        >
          <Icon
            name={desktopView ? 'smartphone' : 'laptop'}
            size={18}
            color="#8FA8C9"
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
                ? require('../../../../assets/spinnerFAST.gif')
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
