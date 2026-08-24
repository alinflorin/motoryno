import type { AppData, Car, TrackedServiceItem } from '@/storage/types';

/** Loose structural check on a parsed JSON blob before we trust it as `AppData` (README > Technical implementation details). */
export function isValidAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  const settings = obj.settings;
  if (!settings || typeof settings !== 'object') return false;

  const data = obj.data;
  if (!data || typeof data !== 'object') return false;
  const cars = (data as Record<string, unknown>).cars;
  if (!Array.isArray(cars)) return false;

  return cars.every(isValidCar);
}

function isValidCar(value: unknown): value is Car {
  if (!value || typeof value !== 'object') return false;
  const car = value as Record<string, unknown>;
  return (
    typeof car.vin === 'string' &&
    typeof car.displayName === 'string' &&
    typeof car.make === 'string' &&
    typeof car.model === 'string' &&
    typeof car.year === 'number' &&
    typeof car.odometerKm === 'number' &&
    Array.isArray(car.trackedServiceItems) &&
    car.trackedServiceItems.every(isValidTrackedServiceItem) &&
    Array.isArray(car.serviceVisits)
  );
}

function isValidTrackedServiceItem(value: unknown): value is TrackedServiceItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === 'string';
}
