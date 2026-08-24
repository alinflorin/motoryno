import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { ensureAndroidChannel } from '@/notifications/androidChannel';
// Importing this also defines the background task at module scope — see there for why.
import { syncBackgroundNotificationTask } from '@/notifications/backgroundTask';
import { checkAndNotifyOverdueItems } from '@/notifications/checkOverdueNotifications';
import { useStorage } from '@/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Wires the daily overdue-items reminder into the app's lifecycle. Renders nothing — mount once
 * near the root, inside `StorageProvider`. See `checkAndNotifyOverdueItems` for the actual
 * decide-and-send logic and `backgroundTask` for how it runs while the app isn't open.
 */
export function NotificationsController() {
  const router = useRouter();
  const { loading, settings } = useStorage();
  const { cron } = settings.notifications;

  // Tapping the notification should always land on the app's home screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/');
    });
    return () => subscription.remove();
  }, [router]);

  // Foreground catch-up: covers the background task being skipped/deferred past the scheduled
  // time (common on iOS), by re-checking whenever the app becomes active, plus once on mount.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void checkAndNotifyOverdueItems();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        void checkAndNotifyOverdueItems();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  // Keep the background job immediately in sync with the notification setting, whichever screen
  // changed it.
  useEffect(() => {
    if (loading || Platform.OS === 'web') return;

    const enabled = cron !== null;
    void (async () => {
      await ensureAndroidChannel();
      if (enabled) {
        await Notifications.requestPermissionsAsync();
      }
      await syncBackgroundNotificationTask(enabled);
    })();
  }, [loading, cron]);

  return null;
}
