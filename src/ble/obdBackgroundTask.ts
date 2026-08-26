import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { isDueForSync, OBD_SCAN_SERVICE_UUIDS, OBD_SYNC_TASK_NAME } from '@/ble/obdSync';
import { syncOdometer } from '@/obd';
import { readAppData, writeAppData } from '@/storage/persistence';
import type { Car } from '@/storage/types';

/**
 * Fallback for when the OS has killed the app process entirely, so the
 * always-on scan in `obdMonitor.ts` isn't running anymore: a short,
 * service-UUID-filtered scan on each OS-granted background wake-up, matched
 * against paired cars' `obd.deviceAddress`. Mirrors the registration pattern
 * in `notifications/backgroundTask.ts` - must run at module scope so the
 * task is defined on every JS bundle load, including the headless launch
 * Android/iOS use to run it while the app isn't open.
 */

/** Give up on adapters that don't show up within this long each wake-up. */
const SCAN_WINDOW_MS = 20000;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(OBD_SYNC_TASK_NAME, async () => {
    try {
      await runObdBackgroundSync();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn('[ble] Background OBD odometer sync failed.', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Runs one scan-and-sync pass: finds cars due for a re-sync, scans for their
 * adapters for up to `SCAN_WINDOW_MS`, and persists whatever odometer
 * readings come back. Also used directly by tests/manual triggers.
 * Returns whether any car was actually re-synced.
 */
export async function runObdBackgroundSync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const appData = await readAppData();
  if (!appData) return false;

  const dueCars = appData.data.cars.filter((car): car is Car & { obd: NonNullable<Car['obd']> } => car.obd !== null && isDueForSync(car.obd));
  if (dueCars.length === 0) return false;

  const manager = getBleManager();
  if (!manager) return false;

  const poweredOn = await waitForPoweredOn(manager, 5000);
  if (!poweredOn) return false;

  const results = new Map<string, number | null>();
  const inFlight = new Set<string>();

  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      manager.stopDeviceScan();
      resolve();
    };
    const timer = setTimeout(finish, SCAN_WINDOW_MS);

    manager.startDeviceScan(OBD_SCAN_SERVICE_UUIDS, { allowDuplicates: false }, (error, device) => {
      if (error || !device || finished) return;
      const car = dueCars.find((c) => c.obd.deviceAddress === device.id && !results.has(c.vin) && !inFlight.has(c.vin));
      if (!car) return;

      inFlight.add(car.vin);
      void syncOdometer(device, car.vin, car.make)
        .then((result) => {
          results.set(car.vin, result.odometerKm);
        })
        .catch(() => {
          // Leave it unset - lastSyncedAt still advances below so a persistently unreachable
          // adapter doesn't get retried every single wake-up.
          results.set(car.vin, null);
        })
        .finally(() => {
          inFlight.delete(car.vin);
          if (results.size >= dueCars.length) finish();
        });
    });
  });

  if (results.size === 0) return false;

  // Re-read rather than reusing `appData`: the background task's scan window can take up to
  // SCAN_WINDOW_MS, plenty of time for the foreground app (if it's alive after all) to have
  // written its own change in the meantime.
  const latest = await readAppData();
  if (!latest) return false;

  const now = Date.now();
  let anySynced = false;
  const updatedCars = latest.data.cars.map((car) => {
    if (!results.has(car.vin) || !car.obd) return car;
    const odometerKm = results.get(car.vin) ?? null;
    if (odometerKm !== null) anySynced = true;
    return {
      ...car,
      odometerKm: odometerKm ?? car.odometerKm,
      obd: { ...car.obd, lastSyncedAt: now },
    };
  });

  await writeAppData({ ...latest, data: { ...latest.data, cars: updatedCars } });
  return anySynced;
}

/**
 * Registers or unregisters the periodic background sync so it always matches whether any car has
 * a paired OBD adapter - called whenever that changes, so pairing/unpairing an adapter starts or
 * stops the background wake-ups right away.
 */
export async function syncObdBackgroundTask(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(OBD_SYNC_TASK_NAME);
    if (enabled && !isRegistered) {
      // Best-effort/minimum interval, same caveat as the overdue-items check - the live scan in
      // obdMonitor.ts is what makes this feel real-time while the app process is alive.
      await BackgroundTask.registerTaskAsync(OBD_SYNC_TASK_NAME, { minimumInterval: 15 });
    } else if (!enabled && isRegistered) {
      await BackgroundTask.unregisterTaskAsync(OBD_SYNC_TASK_NAME);
    }
  } catch (error) {
    console.warn('[ble] Failed to sync OBD background task registration.', error);
  }
}
