import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  } = useDashboard();

  return (
    <View style={styles.headerRow}>
      <TouchableOpacity
        style={styles.avatarBtn}
        onPress={() => {
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
      >
        {avatarUrl && !avatarImgError ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarImg}
            onError={() => setAvatarImgError(true)}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>
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
          />
        </View>
      </View>
      {/* Spacer so avatar and toggle don't overlap the logo */}
      <View style={{ flex: 1 }} pointerEvents="none" />
      {isDesktopBrowser && (
        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => setViewModeOverride(desktopView ? 'mobile' : 'desktop')}
          accessibilityLabel={desktopView ? 'Switch to mobile view' : 'Switch to desktop view'}
        >
          <Icon
            name={desktopView ? 'smartphone' : 'laptop'}
            size={18}
            color="#8FA8C9"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
