export type NotificationSource =
  | 'finmed_intake_reminder'
  | 'finmed_low_stock'
  | 'finmed_symptom_check'
  | 'finmed_measurement'
  | 'finmed_appointment'
  | 'fingo_service_due'
  | 'finven_expiry'
  | 'finven_low_stock'
  | 'finven_notification'
  | 'custom_reminder';

export interface InAppNotification {
  id: string;
  source: NotificationSource;
  title: string;
  body: string;
  timestamp: string; // ISO string
  isRead: boolean;
  isDone: boolean;

  metadata?: {
    // FinMed
    reminderId?: string;
    medicationId?: string;
    scheduleId?: string;
    slotIndex?: number;

    // FinGo
    intervalId?: string;
    componentId?: string;
    assetId?: string;

    // FinVen
    channelId?: string;
    venItemId?: string;
  };
}

export interface NotificationStore {
  notifications: InAppNotification[];
  unreadCount: number;
  lastUpdated: string; // ISO string
}
