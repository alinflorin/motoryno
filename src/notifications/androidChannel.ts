import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationSettings } from '@/storage/types';
import { OVERDUE_CHANNEL_ID } from '@/notifications/constants';

/**
 * Android channel settings (sound/vibration) are fixed at creation time, so the ring/vibrate
 * toggles are applied by recreating the channel — cheap and idempotent, safe to call whenever
 * the notification settings change or right before posting a notification.
 */
export async function syncAndroidChannel(settings: NotificationSettings): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(OVERDUE_CHANNEL_ID, {
    name: 'Overdue service items',
    importance: Notifications.AndroidImportance.HIGH,
    sound: settings.ring ? 'default' : null,
    enableVibrate: settings.vibrate,
    vibrationPattern: settings.vibrate ? [0, 250, 250, 250] : undefined,
  });
}
