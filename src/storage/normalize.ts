import type { AppData } from '@/storage/types';

/**
 * Fills in fields persisted data may predate:
 * - `isActive: true` on tracked items from before that field existed.
 * - `comments: null` on service visits from before that field existed.
 */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    data: {
      ...data.data,
      cars: data.data.cars.map((car) => ({
        ...car,
        trackedServiceItems: car.trackedServiceItems.map((item) => ({
          ...item,
          isActive: item.isActive ?? true,
        })),
        serviceVisits: car.serviceVisits.map((visit) => ({
          ...visit,
          comments: visit.comments ?? null,
        })),
      })),
    },
  };
}
