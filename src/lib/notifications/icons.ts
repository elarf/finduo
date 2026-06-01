import type { NotificationSource } from './types';

export function getNotificationIcon(source: NotificationSource): string {
  switch (source) {
    case 'finmed_intake_reminder':
      return '💊';
    case 'finmed_low_stock':
      return '⚠️';
    case 'fingo_service_due':
      return '🔧';
    case 'finven_expiry':
      return '📅';
    case 'finven_low_stock':
      return '📦';
    default:
      return '🔔';
  }
}

export function getNotificationColor(source: NotificationSource): string {
  switch (source) {
    case 'finmed_intake_reminder':
    case 'finmed_low_stock':
      return '#F472B6'; // Pink (FinMed theme)
    case 'fingo_service_due':
      return '#00F5D4'; // Cyan (FinGo theme)
    case 'finven_expiry':
    case 'finven_low_stock':
      return '#FBBF24'; // Yellow (FinVen theme)
    default:
      return '#CBD5E1'; // Default gray
  }
}
