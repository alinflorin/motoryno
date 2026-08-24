import { DEFAULT_TRACKED_SERVICE_ITEMS } from '@/storage/defaultData';
import type { AppData } from '@/storage/types';

const OTHER_ITEM_NAME = 'Other';

/**
 * Fills in fields persisted data may predate:
 * - `isActive: true` on tracked items from before that field existed.
 * - `comments: null` on service visits from before that field existed.
 * - the catch-all "Other" tracked item, for cars created before it became a default.
 */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    data: {
      ...data.data,
      cars: data.data.cars.map((car) => {
        const trackedServiceItems = car.trackedServiceItems.map((item) => ({
          ...item,
          isActive: item.isActive ?? true,
        }));
        const hasOtherItem = trackedServiceItems.some(
          (item) => item.name.trim().toLowerCase() === OTHER_ITEM_NAME.toLowerCase()
        );
        if (!hasOtherItem) {
          const otherDefault = DEFAULT_TRACKED_SERVICE_ITEMS.find((item) => item.name === OTHER_ITEM_NAME);
          if (otherDefault) trackedServiceItems.push({ ...otherDefault });
        }
        return {
          ...car,
          trackedServiceItems,
          serviceVisits: car.serviceVisits.map((visit) => ({
            ...visit,
            comments: visit.comments ?? null,
          })),
        };
      }),
    },
  };
}
