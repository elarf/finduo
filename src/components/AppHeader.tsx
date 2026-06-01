import React, { useState } from 'react';
import {
  Image,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNotificationCenter } from '../context/NotificationCenterContext';
import { uiPath, uiProps } from '../lib/devtools';
import { topInset } from '../lib/safeArea';

interface Props {
  onBack?: () => void;
  /** Optional element rendered in the right slot (replaces default spinner on mobile) */
  rightElement?: React.ReactNode;
}

export default function AppHeader({ onBack, rightElement }: Props) {
  const navigation = useNavigation();
  const { user, avatarUrl } = useAuth();
  const { isPanelOpen, closePanel } = useNotificationCenter();
  const { width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const isMobile = Platform.OS !== 'web' || width < 1024;
  const [avatarImgError, setAvatarImgError] = useState(false);
  const handleBack = onBack ?? (() => navigation.goBack());

  const rightSlot = rightElement ?? (
    isMobile ? (
      <Image
        source={require('../../assets/spinner.gif')}
        style={s.spinner}
        resizeMode="contain"
        {...uiProps(uiPath('app_header', 'spinner', 'image'))}
      />
    ) : null
  );

  return (
    <View style={[s.headerRow, { paddingTop: topInset(14, top) }]} {...uiProps(uiPath('app_header', 'container', 'view'))}>
      {onBack ? (
        <TouchableOpacity
          style={s.backBtn}
          onPress={handleBack}
          {...uiProps(uiPath('app_header', 'back_button', 'touchable'))}
        >
          <Image source={require('../../assets/fingo/back.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={s.avatarBtn}
          onPress={handleBack}
          {...uiProps(uiPath('app_header', 'avatar_button', 'touchable'))}
        >
          {avatarUrl && !avatarImgError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={s.avatarImg}
              onError={() => setAvatarImgError(true)}
              {...uiProps(uiPath('app_header', 'avatar_button', 'image'))}
            />
          ) : (
            <View style={s.avatarFallback} {...uiProps(uiPath('app_header', 'avatar_fallback', 'view'))}>
              <Text style={s.avatarFallbackText} {...uiProps(uiPath('app_header', 'avatar_fallback', 'text'))}>
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Logo: absolutely centred */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={s.headerLogoCenter} pointerEvents="box-none">
          <Image
            source={require('../../assets/logo.png')}
            style={s.headerLogo}
            resizeMode="contain"
            {...uiProps(uiPath('app_header', 'logo', 'image'))}
          />
        </View>
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} pointerEvents="none" />

      {rightSlot}

      {isPanelOpen && (
        <Pressable
          style={s.closeOverlay}
          onPress={closePanel}
          {...uiProps(uiPath('app_header', 'close_overlay', 'pressable'))}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#000000',
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1F3A59',
    zIndex: 2,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0E1A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#8FA8C9',
    fontSize: 16,
    fontWeight: '700',
  },
  headerLogoCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 66,
  },
  headerLogo: {
    width: 214,
    height: 66,
    minHeight: 66,
  },
  spinner: {
    width: 36,
    height: 36,
    zIndex: 2,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  backArrow: {
    color: '#8FA8C9',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 36,
  },
});
