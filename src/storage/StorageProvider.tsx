import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { syncLanguageFromSettings } from '@/configs/i18n';
import { createDefaultAppData, DEFAULT_TRACKED_SERVICE_ITEMS } from '@/storage/defaultData';
import { readAppData, writeAppData } from '@/storage/persistence';
import type { AppData, Car, NotificationSettings, ObdConfig, ServiceVisit, Settings, TrackedServiceItem } from '@/storage/types';
import { generateId } from '@/storage/uuid';

export type NewCarInput = Pick<Car, 'vin' | 'displayName' | 'make' | 'model' | 'year' | 'odometerKm'> &
  Partial<Pick<Car, 'trackedServiceItems' | 'obd'>>;

export type NewServiceVisitInput = Omit<ServiceVisit, 'uuid'> & { uuid?: string };

export interface StorageApi {
  /** True until the persisted data has been loaded (or defaulted) once. */
  loading: boolean;
  settings: Settings;
  cars: Car[];

  getCar: (vin: string) => Car | undefined;

  addCar: (input: NewCarInput) => void;
  /** `vin` may be included in `patch` to rename the car (its serviceVisits/trackedServiceItems move with it). */
  updateCar: (vin: string, patch: Partial<Omit<Car, 'serviceVisits' | 'trackedServiceItems'>>) => void;
  removeCar: (vin: string) => void;
  setCarOdometer: (vin: string, odometerKm: number) => void;
  setCarObd: (vin: string, obd: ObdConfig | null) => void;

  setTrackedServiceItems: (vin: string, items: TrackedServiceItem[]) => void;
  addTrackedServiceItem: (vin: string, item: TrackedServiceItem) => void;
  updateTrackedServiceItem: (vin: string, name: string, patch: Partial<Omit<TrackedServiceItem, 'name'>>) => void;
  removeTrackedServiceItem: (vin: string, name: string) => void;

  addServiceVisit: (vin: string, visit: NewServiceVisitInput) => string;
  updateServiceVisit: (vin: string, uuid: string, patch: Partial<Omit<ServiceVisit, 'uuid'>>) => void;
  removeServiceVisit: (vin: string, uuid: string) => void;

  updateSettings: (patch: Partial<Omit<Settings, 'notifications'>>) => void;
  updateNotificationSettings: (patch: Partial<NotificationSettings>) => void;

  /** Wipes all persisted data back to defaults. Used by Settings > Reset. */
  resetAllData: () => void;
}

const StorageContext = createContext<StorageApi | null>(null);

function mapCar(data: AppData, vin: string, fn: (car: Car) => Car): AppData {
  return {
    ...data,
    data: {
      ...data.data,
      cars: data.data.cars.map((car) => (car.vin === vin ? fn(car) : car)),
    },
  };
}

/** Fills in `isActive: true` on tracked items persisted before that field existed. */
function normalizeAppData(data: AppData): AppData {
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

export function StorageProvider({ children }: { children: ReactNode }) {
  const [appData, setAppData] = useState<AppData>(createDefaultAppData);
  const [loading, setLoading] = useState(true);
  // Mirrors `appData` synchronously so mutation callbacks never read a stale
  // closure value, without forcing every method to depend on state.
  const dataRef = useRef(appData);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await readAppData();
      if (cancelled) return;
      const initial = loaded ? normalizeAppData(loaded) : createDefaultAppData();
      dataRef.current = initial;
      setAppData(initial);
      setLoading(false);
      void syncLanguageFromSettings(initial.settings.language);
      if (!loaded) {
        void writeAppData(initial);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((updater: (prev: AppData) => AppData) => {
    const next = updater(dataRef.current);
    dataRef.current = next;
    setAppData(next);
    void writeAppData(next).catch((error: unknown) => {
      console.warn('[storage] Failed to persist app data.', error);
    });
  }, []);

  const getCar = useCallback((vin: string) => dataRef.current.data.cars.find((car) => car.vin === vin), []);

  const addCar = useCallback<StorageApi['addCar']>(
    (input) => {
      commit((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          cars: [
            ...prev.data.cars,
            {
              vin: input.vin,
              displayName: input.displayName,
              make: input.make,
              model: input.model,
              year: input.year,
              odometerKm: input.odometerKm,
              trackedServiceItems: input.trackedServiceItems ?? [...DEFAULT_TRACKED_SERVICE_ITEMS],
              serviceVisits: [],
              obd: input.obd ?? null,
            },
          ],
        },
      }));
    },
    [commit]
  );

  const updateCar = useCallback<StorageApi['updateCar']>(
    (vin, patch) => {
      commit((prev) => mapCar(prev, vin, (car) => ({ ...car, ...patch })));
    },
    [commit]
  );

  const removeCar = useCallback<StorageApi['removeCar']>(
    (vin) => {
      commit((prev) => ({
        ...prev,
        data: { ...prev.data, cars: prev.data.cars.filter((car) => car.vin !== vin) },
      }));
    },
    [commit]
  );

  const setCarOdometer = useCallback<StorageApi['setCarOdometer']>(
    (vin, odometerKm) => updateCar(vin, { odometerKm }),
    [updateCar]
  );

  const setCarObd = useCallback<StorageApi['setCarObd']>((vin, obd) => updateCar(vin, { obd }), [updateCar]);

  const setTrackedServiceItems = useCallback<StorageApi['setTrackedServiceItems']>(
    (vin, items) => {
      commit((prev) => mapCar(prev, vin, (car) => ({ ...car, trackedServiceItems: items })));
    },
    [commit]
  );

  const addTrackedServiceItem = useCallback<StorageApi['addTrackedServiceItem']>(
    (vin, item) => {
      commit((prev) =>
        mapCar(prev, vin, (car) =>
          car.trackedServiceItems.some((existing) => existing.name === item.name)
            ? car
            : { ...car, trackedServiceItems: [...car.trackedServiceItems, item] }
        )
      );
    },
    [commit]
  );

  const updateTrackedServiceItem = useCallback<StorageApi['updateTrackedServiceItem']>(
    (vin, name, patch) => {
      commit((prev) =>
        mapCar(prev, vin, (car) => ({
          ...car,
          trackedServiceItems: car.trackedServiceItems.map((item) =>
            item.name === name ? { ...item, ...patch } : item
          ),
        }))
      );
    },
    [commit]
  );

  const removeTrackedServiceItem = useCallback<StorageApi['removeTrackedServiceItem']>(
    (vin, name) => {
      commit((prev) =>
        mapCar(prev, vin, (car) => ({
          ...car,
          trackedServiceItems: car.trackedServiceItems.filter((existing) => existing.name !== name),
        }))
      );
    },
    [commit]
  );

  const addServiceVisit = useCallback<StorageApi['addServiceVisit']>(
    (vin, visit) => {
      const uuid = visit.uuid ?? generateId();
      commit((prev) =>
        mapCar(prev, vin, (car) => ({
          ...car,
          serviceVisits: [...car.serviceVisits, { ...visit, uuid }],
        }))
      );
      return uuid;
    },
    [commit]
  );

  const updateServiceVisit = useCallback<StorageApi['updateServiceVisit']>(
    (vin, uuid, patch) => {
      commit((prev) =>
        mapCar(prev, vin, (car) => ({
          ...car,
          serviceVisits: car.serviceVisits.map((visit) => (visit.uuid === uuid ? { ...visit, ...patch } : visit)),
        }))
      );
    },
    [commit]
  );

  const removeServiceVisit = useCallback<StorageApi['removeServiceVisit']>(
    (vin, uuid) => {
      commit((prev) =>
        mapCar(prev, vin, (car) => ({
          ...car,
          serviceVisits: car.serviceVisits.filter((visit) => visit.uuid !== uuid),
        }))
      );
    },
    [commit]
  );

  const updateSettings = useCallback<StorageApi['updateSettings']>(
    (patch) => {
      commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    },
    [commit]
  );

  const updateNotificationSettings = useCallback<StorageApi['updateNotificationSettings']>(
    (patch) => {
      commit((prev) => ({
        ...prev,
        settings: { ...prev.settings, notifications: { ...prev.settings.notifications, ...patch } },
      }));
    },
    [commit]
  );

  const resetAllData = useCallback(() => {
    commit(() => createDefaultAppData());
  }, [commit]);

  const value = useMemo<StorageApi>(
    () => ({
      loading,
      settings: appData.settings,
      cars: appData.data.cars,
      getCar,
      addCar,
      updateCar,
      removeCar,
      setCarOdometer,
      setCarObd,
      setTrackedServiceItems,
      addTrackedServiceItem,
      updateTrackedServiceItem,
      removeTrackedServiceItem,
      addServiceVisit,
      updateServiceVisit,
      removeServiceVisit,
      updateSettings,
      updateNotificationSettings,
      resetAllData,
    }),
    [
      loading,
      appData,
      getCar,
      addCar,
      updateCar,
      removeCar,
      setCarOdometer,
      setCarObd,
      setTrackedServiceItems,
      addTrackedServiceItem,
      updateTrackedServiceItem,
      removeTrackedServiceItem,
      addServiceVisit,
      updateServiceVisit,
      removeServiceVisit,
      updateSettings,
      updateNotificationSettings,
      resetAllData,
    ]
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

/** Single entry point for reading and mutating the app's persisted data. */
export function useStorage(): StorageApi {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
}
