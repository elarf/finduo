import type { NotificationSource } from './types';
import type { ImageSourcePropType } from 'react-native';

const notificationImageBySource: Record<NotificationSource, ImageSourcePropType> = {
  finmed_intake_reminder: require('../../../assets/meds.webp'),
  finmed_low_stock: require('../../../assets/medstockup.webp'),
  finmed_symptom_check: require('../../../assets/finmeds.webp'),
  finmed_measurement: require('../../../assets/finmeds.webp'),
  finmed_appointment: require('../../../assets/finmeds.webp'),
  fingo_service_due: require('../../../assets/maintenance.webp'),
  finven_expiry: require('../../../assets/finven.webp'),
  finven_low_stock: require('../../../assets/finven.webp'),
  finven_notification: require('../../../assets/finven.webp'),
  custom_reminder: require('../../../assets/notifdef.webp'),
};

const noNotificationImage: ImageSourcePropType = require('../../../assets/nonoti.webp');

export function getNotificationImage(source: NotificationSource): ImageSourcePropType {
  return notificationImageBySource[source];
}

export function getNoNotificationImage(): ImageSourcePropType {
  return noNotificationImage;
}

export function getNotificationIcon(source: NotificationSource): string {
  switch (source) {
    case 'finmed_intake_reminder':
      return '💊';
    case 'finmed_low_stock':
      return '⚠️';
    case 'finmed_symptom_check':
    case 'finmed_measurement':
    case 'finmed_appointment':
      return '🩺';
    case 'fingo_service_due':
      return '🔧';
    case 'finven_expiry':
    case 'finven_low_stock':
    case 'finven_notification':
      return '📦';
    case 'custom_reminder':
      return '🔔';
    default:
      return '🔔';
  }
}

export function getNotificationColor(source: NotificationSource): string {
  switch (source) {
    case 'finmed_intake_reminder':
    case 'finmed_low_stock':
    case 'finmed_symptom_check':
    case 'finmed_measurement':
    case 'finmed_appointment':
      return '#F472B6'; // Pink (FinMed theme)
    case 'fingo_service_due':
      return '#00F5D4'; // Cyan (FinGo theme)
    case 'finven_expiry':
    case 'finven_low_stock':
    case 'finven_notification':
      return '#FBBF24'; // Yellow (FinVen theme)
    case 'custom_reminder':
      return '#CBD5E1'; // Neutral
    default:
      return '#CBD5E1'; // Default gray
  }
}
