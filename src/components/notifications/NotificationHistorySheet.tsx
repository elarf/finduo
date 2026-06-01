import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationCenter } from '../../context/NotificationCenterContext';
import NotificationRow from './NotificationRow';

export default function NotificationHistorySheet() {
  const { bottom } = useSafeAreaInsets();
  const { notifications, isPanelOpen, closePanel, markAllRead, allDone } =
    useNotificationCenter();

  if (!isPanelOpen) return null;

  const hasUnread = notifications.some((n) => !n.isRead);
  const hasActionable = notifications.some(
    (n) =>
      !n.isDone &&
      (n.source === 'finmed_intake_reminder' || n.source === 'fingo_service_due'),
  );

  return (
    <Modal visible={isPanelOpen} transparent animationType="slide" onRequestClose={closePanel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closePanel} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.headerButtons}>
              {hasUnread && (
                <TouchableOpacity style={styles.headerButton} onPress={markAllRead}>
                  <Text style={styles.headerButtonText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {hasActionable && (
                <TouchableOpacity style={styles.headerButton} onPress={allDone}>
                  <Text style={styles.headerButtonText}>All done</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>No notifications</Text>
                <Text style={styles.emptyHint}>You'll see reminders and alerts here</Text>
              </View>
            ) : (
              notifications.map((notif) => <NotificationRow key={notif.id} notification={notif} />)
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0B1728',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1F3A59',
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2C4669',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#CBD5E1',
    fontSize: 18,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#0E1A2B',
  },
  headerButtonText: {
    color: '#8FA8C9',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyHint: {
    color: '#475569',
    fontSize: 12,
  },
});
