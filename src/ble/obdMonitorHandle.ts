/**
 * Tiny module-scope bridge so UI far from the root (the home screen's
 * "OBD sync now" button, and each car screen's own sync button) can trigger
 * the live monitor's immediate, throttle-bypassing sync attempt without
 * threading a callback through props/context. Set by `ObdMonitorController`
 * whenever its scan is running (and cleared back to null when it stops,
 * e.g. the last paired adapter is removed).
 */
let forceSyncNowFn: ((vin?: string) => void) | null = null;

export function setObdForceSyncNow(fn: ((vin?: string) => void) | null): void {
  forceSyncNowFn = fn;
}

/**
 * Requests an immediate sync attempt - for every paired car, or just `vin` if given. Returns
 * false if no scan is currently running.
 */
export function triggerObdSyncNow(vin?: string): boolean {
  if (!forceSyncNowFn) return false;
  forceSyncNowFn(vin);
  return true;
}
