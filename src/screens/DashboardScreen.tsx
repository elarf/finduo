/**
 * DashboardScreen.
 *
 * Shown when the user is authenticated.
 * Displays a welcome message and a sign-out button.
 * This is the entry point for all future finance features.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function DashboardScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
      </Text>
      <Text style={styles.subtitle}>Your finances at a glance</Text>

      {/* Placeholder for future transaction list / summary */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total balance</Text>
        <Text style={styles.cardValue}>$0.00</Text>
      </View>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={signOut}
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
    padding: 24,
    paddingTop: 64,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 'auto',
  },
  cardLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
  },
  signOutButton: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '600',
  },
});
