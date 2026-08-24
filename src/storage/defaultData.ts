import { detectDeviceLanguage } from '@/configs/i18n/resources';
import type { AppData, TrackedServiceItem } from '@/storage/types';

/** The default set of service items copied onto every new car, active for tracking from the start. */
export const DEFAULT_TRACKED_SERVICE_ITEMS: TrackedServiceItem[] = [
  { name: 'Engine oil', timeIntervalDays: 365, kmInterval: 7_500, isActive: true },
  { name: 'Oil filter', timeIntervalDays: 365, kmInterval: 7_500, isActive: true },
  { name: 'Fuel filter', timeIntervalDays: 365, kmInterval: 15_000, isActive: true },
  { name: 'Air filter', timeIntervalDays: 365, kmInterval: 7_500, isActive: true },
  { name: 'Cabin filter', timeIntervalDays: 365, kmInterval: 15_000, isActive: true },
  { name: 'Front brake discs', timeIntervalDays: 730, kmInterval: 100_000, isActive: true },
  { name: 'Front brake pads', timeIntervalDays: 730, kmInterval: 100_000, isActive: true },
  { name: 'Rear brake discs', timeIntervalDays: 730, kmInterval: 100_000, isActive: true },
  { name: 'Rear brake pads', timeIntervalDays: 730, kmInterval: 100_000, isActive: true },
  { name: 'Coolant', timeIntervalDays: 3650, kmInterval: 200_000, isActive: true },
  { name: 'ATF', timeIntervalDays: 1825, kmInterval: 60_000, isActive: true },
  { name: 'Brake fluid', timeIntervalDays: 730, kmInterval: null, isActive: true },
  { name: 'Front differential fluid', timeIntervalDays: 730, kmInterval: 60_000, isActive: true },
  { name: 'Rear differential fluid', timeIntervalDays: 730, kmInterval: 60_000, isActive: true },
  { name: 'Summer tires', timeIntervalDays: 1825, kmInterval: 120_000, isActive: true },
  { name: 'Winter tires', timeIntervalDays: 1825, kmInterval: 120_000, isActive: true },
  { name: 'Front comfort bushings', timeIntervalDays: 1825, kmInterval: 120_000, isActive: true },
  { name: 'Front anti-roll bars', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Rear anti-roll bars', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Front dampers', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Rear dampers', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Front damper flanges', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Rear damper flanges', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Front sway bar ends', timeIntervalDays: 730, kmInterval: 60_000, isActive: true },
  { name: 'Water pump', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Freon', timeIntervalDays: 1825, kmInterval: null, isActive: true },
  { name: 'Xenon bulbs', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Halogen bulbs', timeIntervalDays: 1095, kmInterval: 100_000, isActive: true },
  { name: 'V-belt & rolls', timeIntervalDays: 730, kmInterval: 60_000, isActive: true },
  { name: 'Windshield wipers', timeIntervalDays: 730, kmInterval: null, isActive: true },
  { name: 'Windshield', timeIntervalDays: 3650, kmInterval: 200_000, isActive: true },
  { name: 'Power steering fluid', timeIntervalDays: 730, kmInterval: 80_000, isActive: true },
  { name: 'Battery', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Handbrake pads', timeIntervalDays: 1825, kmInterval: 200_000, isActive: true },
  { name: 'Alternator', timeIntervalDays: 3650, kmInterval: 200_000, isActive: true },
  { name: 'Electromotor', timeIntervalDays: 3650, kmInterval: 200_000, isActive: true },
  { name: 'DPF', timeIntervalDays: 3650, kmInterval: 350_000, isActive: true },
];

export function createDefaultAppData(): AppData {
  return {
    settings: {
      onboardingDone: false,
      theme: 'system',
      language: detectDeviceLanguage(),
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
