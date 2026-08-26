/**
 * Shape of the single JSON blob the whole app is persisted into, as described
 * in the README's "Technical implementation details" section.
 */

export type ThemePreference = 'system' | 'dark' | 'light';

export interface NotificationSettings {
  /** Cron expression for the daily overdue-items check, or null to disable. */
  cron: string | null;
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
  /**
   * When true (the default), a tracked item that has never had a matching service visit logged
   * is reported as "unknown" instead of overdue/due-soon — there's no evidence it's actually due,
   * just no record of it ever being done. When false, never-serviced items are judged the same as
   * serviced ones (i.e. immediately overdue against their interval), matching the app's original,
   * more aggressive behavior. Drives both in-app status badges and the daily notification.
   */
  useUnknownServiceStatus: boolean;
}

export interface TrackedServiceItem {
  /** Also its identifier — must be unique within a car's tracked list; `ServiceVisit.itemsDone` references it by name. */
  name: string;
  /** Recommended interval in days, or null if this item isn't time-based. */
  timeIntervalDays: number | null;
  /** Recommended interval in km, or null if this item isn't distance-based. */
  kmInterval: number | null;
  /** Whether this item is currently tracked for due/overdue purposes. Toggling this off keeps the item (and its history) instead of removing it. */
  isActive: boolean;
}

export interface ServiceVisit {
  uuid: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
  odometerKm: number;
  shopName: string;
  spend: number;
  /** Names of the tracked service items performed during this visit. */
  itemsDone: string[];
  /** Freeform notes about the visit, or null if none were entered. */
  comments: string | null;
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
  /** All items tracked or previously tracked for this car — see `TrackedServiceItem.isActive`. */
  trackedServiceItems: TrackedServiceItem[];
  serviceVisits: ServiceVisit[];
  obd: ObdConfig | null;
}

export interface AppData {
  settings: Settings;
  data: {
    cars: Car[];
  };
}
