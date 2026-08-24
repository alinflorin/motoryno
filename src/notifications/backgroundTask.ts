import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { OVERDUE_CHECK_TASK_NAME } from '@/notifications/constants';
import { checkAndNotifyOverdueItems } from '@/notifications/checkOverdueNotifications';

// Must run at module scope (not inside a component) so the task is defined on every JS bundle
// load, including the headless launch Android/iOS use to run it while the app isn't open.
// expo-background-task is native-only — defining/registering it on web would throw.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(OVERDUE_CHECK_TASK_NAME, async () => {
    try {
      await checkAndNotifyOverdueItems();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn('[notifications] Background overdue-items check failed.', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Registers or unregisters the periodic background check so it always matches the current
 * notification setting — called once on load and again immediately whenever the user flips the
 * "Daily reminder" switch, so disabling it stops future background wake-ups right away.
 */
export async function syncBackgroundNotificationTask(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(OVERDUE_CHECK_TASK_NAME);
    if (enabled && !isRegistered) {
      // The OS treats this as a minimum/best-effort interval, not a guaranteed fire time — the
      // foreground catch-up in checkAndNotifyOverdueItems is what makes the reminder reliable.
      await BackgroundTask.registerTaskAsync(OVERDUE_CHECK_TASK_NAME, { minimumInterval: 15 });
    } else if (!enabled && isRegistered) {
      await BackgroundTask.unregisterTaskAsync(OVERDUE_CHECK_TASK_NAME);
    }
  } catch (error) {
    console.warn('[notifications] Failed to sync background task registration.', error);
  }
}
