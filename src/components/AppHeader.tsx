import React, { useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { uiPath, uiProps } from '../lib/devtools';

interface Props {
  onBack?: () => void;
  /** Optional element rendered in the right slot (replaces default spinner on mobile) */
  rightElement?: React.ReactNode;
}

export default function AppHeader({ onBack, rightElement }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 1024;
  const [avatarImgError, setAvatarImgError] = useState(false);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
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
    <View style={s.headerRow} {...uiProps(uiPath('app_header', 'container', 'view'))}>
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
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    paddingTop: Platform.OS === 'web' ? 14 : 48,
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
  },
  headerLogo: {
    width: 168,
    height: 52,
  },
  spinner: {
    width: 36,
    height: 36,
    zIndex: 2,
  },
});
