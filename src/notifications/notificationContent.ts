import i18n from '@/configs/i18n';
import type { CarOverdueSummary } from '@/utils/serviceStatus';

/**
 * Builds the daily reminder's title/body from the cross-car overdue summary. Runs both in the
 * background task (no React tree mounted) and the foreground catch-up, so it calls `i18n.t`
 * directly rather than the `useTranslation` hook.
 */
export function buildOverdueNotificationContent(summary: CarOverdueSummary[]): { title: string; body: string } {
  const totalCount = summary.reduce((sum, entry) => sum + entry.overdueItems.length, 0);

  const title = i18n.t('overdueNotification.title', { count: totalCount });
  const body = summary
    .map(({ car, overdueItems }) => `${car.displayName}: ${overdueItems.map((entry) => entry.item.name).join(', ')}`)
    .join(' · ');

  return { title, body };
}
