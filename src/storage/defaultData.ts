import type { AppData, TrackedServiceItem } from '@/storage/types';

/** The default set of service items activated for tracking on every new car. */
export const DEFAULT_TRACKED_SERVICE_ITEMS: TrackedServiceItem[] = [
  { name: 'Engine oil', timeIntervalDays: 365, kmInterval: 10_000 },
  { name: 'Oil filter', timeIntervalDays: 365, kmInterval: 10_000 },
  { name: 'Air filter', timeIntervalDays: 730, kmInterval: 30_000 },
  { name: 'Cabin air filter', timeIntervalDays: 365, kmInterval: 15_000 },
  { name: 'Brake fluid', timeIntervalDays: 730, kmInterval: null },
  { name: 'Spark plugs', timeIntervalDays: 1460, kmInterval: 60_000 },
  { name: 'Battery', timeIntervalDays: 1825, kmInterval: null },
  { name: 'Coolant flush', timeIntervalDays: 1095, kmInterval: null },
];

export function createDefaultAppData(): AppData {
  return {
    settings: {
      onboardingDone: false,
      theme: 'system',
      language: 'en',
      useImperialUnits: false,
      currency: 'EUR',
      notifications: {
        cron: '0 8 * * *',
        ring: true,
        vibrate: true,
      },
    },
    data: {
      cars: [],
    },
  };
}
