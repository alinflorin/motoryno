import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { OVERDUE_CHANNEL_ID } from '@/notifications/constants';

/** Idempotent — safe to call on every launch. Android requires the channel to exist before a notification can be posted through it. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(OVERDUE_CHANNEL_ID, {
    name: 'Overdue service items',
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
  });
}
