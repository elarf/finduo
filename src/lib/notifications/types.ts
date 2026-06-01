export type NotificationSource =
  | 'finmed_intake_reminder'
  | 'finmed_low_stock'
  | 'fingo_service_due'
  | 'finven_expiry'
  | 'finven_low_stock';

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
