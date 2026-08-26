import { KNOWN_UART_PROFILES } from '@/obd/elm327';
import type { ObdConfig } from '@/storage/types';

/**
 * Shared knobs/helpers for the silent "adapter came into range" odometer
 * sync, used by both the always-alive foreground/backgrounded scan
 * (`obdMonitor.ts`) and the periodic headless background task
 * (`obdBackgroundTask.ts`) - see both for how each drives this.
 */

/** expo-task-manager task name for the periodic BLE OBD odometer re-sync. */
export const OBD_SYNC_TASK_NAME = 'motoryno-obd-odometer-sync';

/**
 * Service UUIDs a background-capable scan must filter on: iOS only delivers
 * discovery callbacks while backgrounded for scans filtered to specific
 * service UUIDs, not unfiltered ones (unlike the foreground pairing scan in
 * `ObdConfigCard`, which intentionally scans for everything so any adapter
 * shows up in the list). Adapters that only match `findUartProfile`'s
 * generic fallback (i.e. don't advertise any of these) can still be paired
 * by hand, but won't be silently detected.
 */
export const OBD_SCAN_SERVICE_UUIDS = KNOWN_UART_PROFILES.map((profile) => profile.serviceUUID);

/**
 * Minimum time between two silent odometer re-syncs of the same car. A
 * continuous scan re-discovers an in-range adapter every few seconds, and
 * this is a "once you're near the car" update, not a live telemetry feed -
 * so most re-discoveries should be no-ops.
 */
const SYNC_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

/** Whether `obd` is due for a silent re-sync right now. */
export function isDueForSync(obd: ObdConfig, now = Date.now()): boolean {
  return obd.lastSyncedAt === null || now - obd.lastSyncedAt >= SYNC_THROTTLE_MS;
}
