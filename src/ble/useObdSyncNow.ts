import { useEffect, useRef, useState } from 'react';

import { triggerObdSyncNow } from '@/ble/obdMonitorHandle';
import { useStorage } from '@/storage';

/** Give up on the spinner if the adapter never comes into range at all. */
const SYNC_UI_TIMEOUT_MS = 20000;

/**
 * Drives an "OBD sync now" button for one car (`vin`) or every paired car
 * (no `vin`): kicks the live monitor's throttle-bypassing sync and reports
 * `syncing` until the car's `lastSyncedAt` moves - which it does on every
 * completed attempt, success or not (see `ObdMonitorController`), so an
 * in-range-but-unreadable adapter also settles the spinner.
 */
export function useObdSyncNow(vin?: string): { syncing: boolean; syncNow: () => void } {
  const { cars } = useStorage();
  const [syncing, setSyncing] = useState(false);
  // Each targeted car's `lastSyncedAt` as it was when the button was pressed.
  const baselineRef = useRef<Map<string, number | null> | null>(null);

  const syncNow = () => {
    if (!triggerObdSyncNow(vin)) return;
    const targets = cars.filter((car) => car.obd && (vin === undefined || car.vin === vin));
    baselineRef.current = new Map(targets.map((car) => [car.vin, car.obd?.lastSyncedAt ?? null]));
    setSyncing(true);
  };

  useEffect(() => {
    const baseline = baselineRef.current;
    if (!syncing || !baseline) return;
    const settled = cars.some((car) => car.obd && baseline.has(car.vin) && baseline.get(car.vin) !== car.obd.lastSyncedAt);
    if (settled) {
      setSyncing(false);
      baselineRef.current = null;
    }
  }, [cars, syncing]);

  useEffect(() => {
    if (!syncing) return;
    const timer = setTimeout(() => setSyncing(false), SYNC_UI_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [syncing]);

  return { syncing, syncNow };
}
