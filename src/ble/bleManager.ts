import { Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';

/**
 * Single app-wide `BleManager` instance. Constructing it touches native
 * modules that don't exist on web, so it's created lazily and only once.
 */
let manager: BleManager | null = null;

export function getBleManager(): BleManager | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

/** How long to wait for the adapter to power on before giving up. */
const POWER_ON_TIMEOUT_MS = 10000;

/**
 * Resolves once the manager's Bluetooth state is `PoweredOn`, or false if it
 * settles into a state that will never scan (denied/off/unsupported) or the
 * timeout elapses.
 *
 * This matters most the very first time the app runs on iOS: creating the
 * `BleManager` triggers the native permission prompt asynchronously, and the
 * adapter state stays `Unknown` until the user answers it. Starting a scan
 * before that transition completes fails immediately, even though the user
 * is about to grant access - hence "works the first time, error, then works
 * every time after". Waiting here avoids that race.
 */
export async function waitForPoweredOn(bleManager: BleManager, timeoutMs = POWER_ON_TIMEOUT_MS): Promise<boolean> {
  const state = await bleManager.state();
  if (state === State.PoweredOn) return true;
  if (state === State.Unauthorized || state === State.Unsupported) return false;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      resolve(result);
    };

    const subscription = bleManager.onStateChange((next) => {
      if (next === State.PoweredOn) {
        finish(true);
      } else if (next === State.Unauthorized || next === State.Unsupported || next === State.PoweredOff) {
        finish(false);
      }
    }, true);

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}
