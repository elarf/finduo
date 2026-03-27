/**
 * LoginScreen.
 *
 * Full-screen logo.png as background, dark overlay at the bottom,
 * "Sign in with Google" button centred at the foot of the image.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Sign-in failed', 'Unable to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/logo.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Dark gradient-style footer so button stays readable */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={loading}
          accessibilityLabel="Sign in with Google"
        >
          {loading ? (
            <ActivityIndicator color="#060A14" />
          ) : (
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          )}
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#060A14',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 56,
    paddingTop: 80,
    paddingHorizontal: 32,
    // dark fade so the button is always readable regardless of logo colours
    backgroundColor: 'rgba(6, 10, 20, 0.72)',
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
