import type { AppData, TrackedServiceItem } from '@/storage/types';

/** The default set of service items copied onto every new car, active for tracking from the start. */
export const DEFAULT_TRACKED_SERVICE_ITEMS: TrackedServiceItem[] = [
  { name: 'Engine oil', timeIntervalDays: 365, kmInterval: 10_000, isActive: true },
  { name: 'Oil filter', timeIntervalDays: 365, kmInterval: 10_000, isActive: true },
  { name: 'Air filter', timeIntervalDays: 730, kmInterval: 30_000, isActive: true },
  { name: 'Cabin air filter', timeIntervalDays: 365, kmInterval: 15_000, isActive: true },
  { name: 'Brake fluid', timeIntervalDays: 730, kmInterval: null, isActive: true },
  { name: 'Spark plugs', timeIntervalDays: 1460, kmInterval: 60_000, isActive: true },
  { name: 'Battery', timeIntervalDays: 1825, kmInterval: null, isActive: true },
  { name: 'Coolant flush', timeIntervalDays: 1095, kmInterval: null, isActive: true },
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
