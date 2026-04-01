/**
 * LoginScreen.
 *
 * Layout:
 *  - logo.png fills the top portion, full-width, contained (no crop)
 *  - "Sign in with Google" button sits in a dark strip at the bottom
 *
 * Responsiveness:
 *  - Mobile / narrow: fills all available width
 *  - Desktop (web ≥ 600 px): a centred 430 px column with black side fillers,
 *    so it looks like a phone on a dark desk
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { logUI, uiPath, uiProps } from '../lib/devtools';
import { useAuth } from '../context/AuthContext';

const MOBILE_MAX_WIDTH = 430;
const DESKTOP_BREAKPOINT = 600;

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  useEffect(() => {
    logUI(uiPath('login', 'screen', 'container'), 'mounted');
  }, []);

  const handleGoogleSignIn = async () => {
    logUI(uiPath('login', 'footer', 'google_button'), 'press');
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch {
      Alert.alert('Sign-in failed', 'Unable to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Outer: full screen black — acts as side filler on desktop */
    <View style={styles.outer} {...uiProps(uiPath('login', 'screen', 'outer'))}>
      {/* Phone column — centred and capped at MOBILE_MAX_WIDTH on desktop */}
      <View
        style={[styles.phone, isDesktop && styles.phoneDesktop]}
        {...uiProps(uiPath('login', 'screen', 'container'))}
      >

        {/* Logo area: takes all vertical space above the footer */}
        <View style={styles.logoArea} {...uiProps(uiPath('login', 'logo', 'container'))}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
            {...uiProps(uiPath('login', 'logo', 'image'))}
          />
        </View>

        {/* Footer strip with the CTA button */}
        <View style={styles.footer} {...uiProps(uiPath('login', 'footer', 'container'))}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
            accessibilityLabel="Sign in with Google"
            {...uiProps(uiPath('login', 'footer', 'google_button'))}
          >
            {loading ? (
              <ActivityIndicator color="#060A14" />
            ) : (
              <Text style={styles.googleButtonText} {...uiProps(uiPath('login', 'footer', 'google_button_label'))}>
                Sign in with Google
              </Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#060A14',
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    backgroundColor: '#060A14',
  },
  /** Desktop: cap width and add subtle side borders so it pops from the black background */
  phoneDesktop: {
    maxWidth: MOBILE_MAX_WIDTH,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1A2B40',
  },
  logoArea: {
    flex: 1,
    width: '100%',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingBottom: 56,
    paddingTop: 40,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(6, 10, 20, 0.90)',
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#53E3A6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#53E3A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  googleButtonText: {
    color: '#060A14',
    fontSize: 16,
    fontWeight: '700',
  },
});
