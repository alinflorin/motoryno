import * as Notifications from 'expo-notifications';

import { ensureAndroidChannel } from '@/notifications/androidChannel';
import { getLastCheckedDate, localDateKey, setLastCheckedDate } from '@/notifications/lastCheckStore';
import { buildOverdueNotificationContent } from '@/notifications/notificationContent';
import { readAppData } from '@/storage/persistence';
import { parseCronTime } from '@/utils/notificationCron';
import { getOverdueSummaryForAllCars } from '@/utils/serviceStatus';

/**
 * Runs the "is it time for today's overdue-items reminder yet?" check and, if so, posts it.
 * Safe to call as often as you like — a real device/simulated clock only ever fires the actual
 * notification once per local calendar day:
 *  - Called by the registered background task (best-effort periodic wake-ups; iOS in particular
 *    doesn't guarantee exact timing), which covers the app being closed/backgrounded.
 *  - Called on cold start and app-foreground as a catch-up, which covers the background task
 *    having been skipped or deferred past the scheduled time.
 */
export async function checkAndNotifyOverdueItems(now = new Date()): Promise<void> {
  const appData = await readAppData();
  if (!appData) return;

  const { cron } = appData.settings.notifications;
  if (cron === null) return;

  const todayKey = localDateKey(now);
  const lastChecked = await getLastCheckedDate();
  if (lastChecked === todayKey) return; // Already handled today.

  const { hour, minute } = parseCronTime(cron);
  const scheduledMinutesOfDay = hour * 60 + minute;
  const nowMinutesOfDay = now.getHours() * 60 + now.getMinutes();
  if (nowMinutesOfDay < scheduledMinutesOfDay) return; // Not due yet today — try again later today.

  // Past today's scheduled time and not yet checked: this is the one check for today, whether
  // or not it ends up finding anything overdue.
  await setLastCheckedDate(todayKey);

  const summary = getOverdueSummaryForAllCars(appData.data.cars, now.getTime());
  if (summary.length === 0) return;

  await ensureAndroidChannel();
  const { title, body } = buildOverdueNotificationContent(summary);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { url: '/' },
    },
    trigger: null,
  });
}
