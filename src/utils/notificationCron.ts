/**
 * The Settings.notifications.cron field only ever stores a daily "at HH:MM"
 * schedule (`0 8 * * *`-shaped), so we don't need a general cron parser —
 * just enough to read/write the minute and hour fields.
 */

export interface DailyTime {
  hour: number;
  minute: number;
}

export const DEFAULT_NOTIFICATION_TIME: DailyTime = { hour: 8, minute: 0 };

export function parseCronTime(cron: string | null): DailyTime {
  if (!cron) return DEFAULT_NOTIFICATION_TIME;

  const [minuteField, hourField] = cron.trim().split(/\s+/);
  const minute = Number(minuteField);
  const hour = Number(hourField);
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return DEFAULT_NOTIFICATION_TIME;
  }
  return { hour, minute };
}

export function formatCronTime({ hour, minute }: DailyTime): string {
  return `${minute} ${hour} * * *`;
}

export function formatTimeLabel({ hour, minute }: DailyTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
