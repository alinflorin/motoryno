import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

// Importing this also defines the background task at module scope - see there for why.
import { syncObdBackgroundTask } from '@/ble/obdBackgroundTask';
import { startObdMonitor } from '@/ble/obdMonitor';
import { setObdForceSyncNow } from '@/ble/obdMonitorHandle';
import { useStorage } from '@/storage';
import type { Car } from '@/storage/types';

/**
 * Wires the silent "adapter came into range" odometer sync into the app's
 * lifecycle. Renders nothing - mount once near the root, inside
 * `StorageProvider`. Only does anything at all once at least one car has a
 * paired OBD adapter (`car.obd`); with none paired, no scan runs and no
 * background task is registered.
 *
 * See `obdMonitor.ts` for the always-on scan (while the app process is
 * alive) and `obdBackgroundTask.ts` for the periodic fallback that covers
 * the OS having killed the process entirely.
 */
export function ObdMonitorController() {
  const { loading, cars, updateCar } = useStorage();

  const carsRef = useRef<Car[]>(cars);
  useEffect(() => {
    carsRef.current = cars;
  }, [cars]);

  const hasPairedObd = cars.some((car) => car.obd !== null);

  // Kept pointed at the active scan's forceSyncNow so the AppState effect below can reach it
  // without depending on (and re-subscribing over) the scan's own start/stop effect.
  const forceSyncNowRef = useRef<((vin?: string) => void) | null>(null);

  // Keep the always-on scan running for as long as any car has a paired adapter. Forces an
  // immediate (throttle-bypassing) sync attempt right as the scan starts, covering cold app open.
  useEffect(() => {
    if (loading || Platform.OS === 'web' || !hasPairedObd) return;

    const { stop, forceSyncNow } = startObdMonitor(
      () => carsRef.current,
      ({ vin, odometerKm }) => {
        const car = carsRef.current.find((c) => c.vin === vin);
        if (!car?.obd) return;
        // `lastSyncedAt` advances on every completed attempt, success or not - it's the throttle
        // clock for isDueForSync, so a persistently unreachable/unreadable adapter also backs off
        // instead of being retried on every single re-discovery.
        updateCar(vin, {
          odometerKm: odometerKm ?? car.odometerKm,
          obd: { ...car.obd, lastSyncedAt: Date.now() },
        });
      }
    );
    forceSyncNowRef.current = forceSyncNow;
    setObdForceSyncNow(forceSyncNow);
    forceSyncNow();
    return () => {
      forceSyncNowRef.current = null;
      setObdForceSyncNow(null);
      stop();
    };
  }, [loading, hasPairedObd, updateCar]);

  // Also force a sync on every foreground transition (not just app launch) - "quit and reopen"
  // should always attempt a fresh read regardless of how recently it last synced.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const appStateRef = { current: AppState.currentState };
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        forceSyncNowRef.current?.();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  // Keep the background fallback task registered in step with whether any adapter is paired.
  useEffect(() => {
    if (loading || Platform.OS === 'web') return;
    void syncObdBackgroundTask(hasPairedObd);
  }, [loading, hasPairedObd]);

  return null;
}
