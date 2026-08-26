import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { isDueForSync, OBD_SCAN_SERVICE_UUIDS } from '@/ble/obdSync';
import { requestBlePermissions } from '@/ble/permissions';
import { syncOdometer } from '@/obd';
import type { Car } from '@/storage/types';

export interface ObdSyncAttempt {
  vin: string;
  /** The freshly-read odometer, or null if the connection succeeded but no known PID answered. */
  odometerKm: number | null;
  /** True if the adapter couldn't be connected to/initialized at all. */
  connectionFailed: boolean;
}

/** How long to wait for a direct (non-scan) connect attempt before giving up. */
const FORCE_CONNECT_TIMEOUT_MS = 15000;

/**
 * Keeps a continuous, service-UUID-filtered BLE scan running for as long as
 * the app process is alive (foreground, or backgrounded but not yet killed
 * by the OS) - matching each discovered device against the paired cars'
 * `obd.deviceAddress`, and silently reading the odometer when one comes back
 * into range (throttled per car via `isDueForSync`). This is the
 * "near-instant" half of odometer re-syncing; `obdBackgroundTask.ts` is the
 * fallback for when the OS has killed the process entirely.
 *
 * `getCars` is read fresh on every discovery (not captured once) so the
 * caller can keep it wired to live state without restarting the scan.
 * Returns `{ stop, forceSyncNow }`: `stop` ends the scan; `forceSyncNow`
 * bypasses the throttle and attempts a *direct* connect to every
 * currently-paired car's adapter right away (see below for why it doesn't
 * just wait for the scan) - used to force a read on app open/foreground and
 * from the home screen's "OBD sync now" button.
 */
export function startObdMonitor(
  getCars: () => Car[],
  onSyncAttempt: (attempt: ObdSyncAttempt) => void
): { stop: () => void; forceSyncNow: () => void } {
  let stopped = false;
  const syncing = new Set<string>(); // car VINs currently being read, to avoid overlapping connects

  const runSync = (vin: string, connectAndSync: ReturnType<typeof syncOdometer>) => {
    syncing.add(vin);
    void connectAndSync
      .then((result) => onSyncAttempt({ vin, odometerKm: result.odometerKm, connectionFailed: result.connectionFailed }))
      .catch(() => onSyncAttempt({ vin, odometerKm: null, connectionFailed: true }))
      .finally(() => {
        syncing.delete(vin);
      });
  };

  void (async () => {
    const manager = getBleManager();
    if (!manager) return;

    const granted = await requestBlePermissions();
    if (!granted || stopped) return;

    const poweredOn = await waitForPoweredOn(manager);
    if (!poweredOn || stopped) return;

    manager.startDeviceScan(OBD_SCAN_SERVICE_UUIDS, { allowDuplicates: false }, (error, device) => {
      if (error || !device || stopped) return;
      const car = getCars().find((c) => c.obd?.deviceAddress === device.id);
      if (!car || !car.obd || syncing.has(car.vin) || !isDueForSync(car.obd)) return;

      runSync(car.vin, syncOdometer(device, car.vin, car.make));
    });
  })();

  return {
    stop: () => {
      stopped = true;
      getBleManager()?.stopDeviceScan();
    },
    forceSyncNow: () => {
      const manager = getBleManager();
      if (!manager) return;
      // Connect directly by known address rather than waiting for the scan to (re-)discover the
      // adapter: with `allowDuplicates: false`, the OS only calls the scan listener once per
      // advertising session, so a device already seen earlier this app session (the very common
      // case - e.g. it was in range at launch, or the user is testing right next to it) would
      // otherwise never fire another discovery event to bypass the throttle on.
      for (const car of getCars()) {
        if (!car.obd || syncing.has(car.vin)) continue;
        const { vin, make, obd } = car;
        runSync(
          vin,
          manager.connectToDevice(obd.deviceAddress, { timeout: FORCE_CONNECT_TIMEOUT_MS }).then((device) => syncOdometer(device, vin, make))
        );
      }
    },
  };
}
