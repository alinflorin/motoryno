import type { AppData } from '@/storage/types';

/** Fills in `isActive: true` on tracked items persisted before that field existed. */
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
      })),
    },
  };
}
