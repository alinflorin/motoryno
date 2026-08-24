import type { AppData } from '@/storage/types';

/** The default set of tracked service items activated for every new car. */
export const DEFAULT_TRACKED_SERVICE_ITEMS = [
  'Engine oil',
  'Oil filter',
  'Air filter',
  'Cabin air filter',
  'Brake fluid',
  'Spark plugs',
  'Battery',
  'Coolant flush',
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
