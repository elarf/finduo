import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation';
import type { InAppNotification } from '../../lib/notifications/types';
import { getNotificationIcon, getNotificationColor } from '../../lib/notifications/icons';
import { useNotificationCenter } from '../../context/NotificationCenterContext';

interface NotificationRowProps {
  notification: InAppNotification;
}

export default function NotificationRow({ notification }: NotificationRowProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { markRead, markDone, closePanel } = useNotificationCenter();
  const [doneLoading, setDoneLoading] = useState(false);

  const icon = getNotificationIcon(notification.source);
  const color = getNotificationColor(notification.source);

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleTap = async () => {
    await markRead(notification.id);
    closePanel();

    // Navigate based on source
    switch (notification.source) {
      case 'finmed_intake_reminder':
      case 'finmed_low_stock':
        navigation.navigate('FinMed');
        break;

      case 'fingo_service_due':
        if (
          notification.metadata?.intervalId &&
          notification.metadata?.componentId &&
          notification.metadata?.assetId
        ) {
          navigation.navigate('ServiceIntervalDetail', {
            intervalId: notification.metadata.intervalId,
            componentId: notification.metadata.componentId,
            assetId: notification.metadata.assetId,
          });
        } else {
          navigation.navigate('FinGo');
        }
        break;

      case 'finven_expiry':
      case 'finven_low_stock':
        navigation.navigate('FinVen');
        break;
    }
  };

  const handleMarkDone = async () => {
    setDoneLoading(true);
    const result = await markDone(notification.id);
    setDoneLoading(false);

    if (!result.success && result.error) {
      Alert.alert('Error', result.error);
    }
  };

  const showDoneButton =
    !notification.isDone &&
    (notification.source === 'finmed_intake_reminder' || notification.source === 'fingo_service_due');

  return (
    <TouchableOpacity
      style={[styles.row, !notification.isRead && styles.rowUnread]}
      onPress={handleTap}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, !notification.isRead && styles.titleUnread]}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.timestamp}>{formatTimestamp(notification.timestamp)}</Text>
      </View>

      {showDoneButton && (
        <TouchableOpacity
          style={[styles.doneButton, doneLoading && styles.doneButtonDisabled]}
          onPress={handleMarkDone}
          disabled={doneLoading}
        >
          {doneLoading ? (
            <ActivityIndicator size="small" color="#F472B6" />
          ) : (
            <Text style={styles.doneButtonText}>Done</Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0E1A2B',
    alignItems: 'center',
    gap: 12,
  },
  rowUnread: {
    backgroundColor: '#0E1A2B',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    color: '#8FA8C9',
    fontSize: 14,
    fontWeight: '600',
  },
  titleUnread: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  body: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  timestamp: {
    color: '#475569',
    fontSize: 10,
    marginTop: 4,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F472B6',
    backgroundColor: '#2d0a1a',
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    color: '#F472B6',
    fontSize: 12,
    fontWeight: '600',
  },
});
