import { isOdometerSource, isVinSource } from '@/obd/odometer/source';
import type { AppData } from '@/storage/types';

/**
 * Fills in fields persisted data may predate:
 * - `isActive: true` on tracked items from before that field existed.
 * - `comments: null` on service visits from before that field existed.
 * - `useUnknownServiceStatus: true` on settings from before that field existed.
 * - `obd.odometerSource`/`obd.vinSource: null` and `obd.initCommands: []` on paired
 *   adapters from before those existed (or anything malformed that came in through an import).
 */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      useUnknownServiceStatus: data.settings.useUnknownServiceStatus ?? true,
    },
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
        obd: car.obd
          ? {
              ...car.obd,
              initCommands: Array.isArray(car.obd.initCommands)
                ? car.obd.initCommands.filter((c): c is string => typeof c === 'string')
                : [],
              vinSource: isVinSource(car.obd.vinSource) ? car.obd.vinSource : null,
              odometerSource: isOdometerSource(car.obd.odometerSource) ? car.obd.odometerSource : null,
            }
          : null,
      })),
    },
  };
}
