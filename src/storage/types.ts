/**
 * Shape of the single JSON blob the whole app is persisted into, as described
 * in the README's "Technical implementation details" section.
 */

export type ThemePreference = 'system' | 'dark' | 'light';

export interface NotificationSettings {
  /** Cron expression for the daily overdue-items check, or null to disable. */
  cron: string | null;
  ring: boolean;
  vibrate: boolean;
}

export interface Settings {
  onboardingDone: boolean;
  theme: ThemePreference;
  /** e.g. 'en' | 'ro' */
  language: string;
  useImperialUnits: boolean;
  /** ISO 4217 currency code, e.g. 'EUR'. */
  currency: string;
  notifications: NotificationSettings;
}

export interface ServiceVisit {
  uuid: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
  odometerKm: number;
  shopName: string;
  spend: number;
  /** Ids/names of tracked service items performed during this visit. */
  itemsDone: string[];
}

export interface ObdConfig {
  deviceName: string;
  deviceAddress: string;
  /** Unix epoch milliseconds of the last successful odometer sync, or null. */
  lastSyncedAt: number | null;
}

export interface Car {
  /** VIN — the car's unique identifier. */
  vin: string;
  displayName: string;
  make: string;
  model: string;
  year: number;
  odometerKm: number;
  /** Ids/names of the service items currently tracked for this car. */
  trackedServiceItems: string[];
  serviceVisits: ServiceVisit[];
  obd: ObdConfig | null;
}

export interface AppData {
  settings: Settings;
  data: {
    cars: Car[];
  };
}
