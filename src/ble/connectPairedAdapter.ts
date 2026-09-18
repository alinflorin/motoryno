import type { Device } from 'react-native-ble-plx';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';

/** How long to wait for a direct connect to a paired adapter before giving up. */
const CONNECT_TIMEOUT_MS = 15000;

export type PairedAdapterConnection =
  { device: Device } | { error: 'unavailable' | 'permission-denied' | 'bluetooth-off' | 'connection-failed' };

/**
 * Connects straight to a paired adapter by address (permissions and power
 * state sorted out first) for the one-off sessions behind the OBD setup
 * screen's Test buttons and console.
 */
export async function connectPairedAdapter(deviceAddress: string): Promise<PairedAdapterConnection> {
  const manager = getBleManager();
  if (!manager) return { error: 'unavailable' };
  if (!(await requestBlePermissions())) return { error: 'permission-denied' };
  if (!(await waitForPoweredOn(manager))) return { error: 'bluetooth-off' };
  try {
    return { device: await manager.connectToDevice(deviceAddress, { timeout: CONNECT_TIMEOUT_MS }) };
  } catch {
    return { error: 'connection-failed' };
  }
}
