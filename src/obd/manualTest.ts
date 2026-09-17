/**
 * One-off "does this request work?" runs behind the Test buttons on the
 * OBD setup screen: connect with the car's custom init commands, run the
 * hand-configured request once, and report both the raw payload (so the
 * user can see what actually came back and adjust the byte field) and the
 * decoded value.
 */

import type { Device } from 'react-native-ble-plx';

import { withAdapterLock } from '@/obd/adapterLock';
import { ElmConnection, openElmConnection } from '@/obd/elm327';
import { readOdometerSource } from '@/obd/odometer/read';
import type { OdometerSource, VinSource } from '@/obd/odometer/source';
import { readVinSource } from '@/obd/scanVehicle';

export interface ManualTestResult {
  /** Hex dump of the reply payload (service/parameter echo stripped), or null if nothing usable came back. */
  payloadHex: string | null;
  /** The decoded VIN or km, or null if the payload didn't decode. */
  value: string | number | null;
  /** Set when the adapter couldn't be connected to at all. */
  connectionFailed: boolean;
}

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

async function withSession<T>(
  device: Device,
  initCommands: string[],
  run: (connection: ElmConnection) => Promise<T>,
  onConnectionFailed: T
): Promise<T> {
  return withAdapterLock(device.id, async () => {
    let connection: ElmConnection | null = null;
    try {
      connection = await openElmConnection(device, { initCommands });
      return await run(connection);
    } catch {
      return onConnectionFailed;
    } finally {
      if (connection) {
        try {
          await connection.setAddressing(null);
        } catch {
          // Best-effort; the link is being dropped anyway.
        }
        connection.close();
      }
      try {
        await device.cancelConnection();
      } catch {
        // Already disconnected, or never connected - nothing to clean up.
      }
    }
  });
}

const FAILED: ManualTestResult = { payloadHex: null, value: null, connectionFailed: true };

export function testVinSource(device: Device, initCommands: string[], source: VinSource): Promise<ManualTestResult> {
  return withSession(
    device,
    initCommands,
    async (connection) => {
      const { vin, payload } = await readVinSource(connection, source);
      return { payloadHex: payload ? toHex(payload) : null, value: vin, connectionFailed: false };
    },
    FAILED
  );
}

export function testOdometerSource(device: Device, initCommands: string[], source: OdometerSource): Promise<ManualTestResult> {
  return withSession(
    device,
    initCommands,
    async (connection) => {
      const { km, payload } = await readOdometerSource(connection, source);
      return { payloadHex: payload ? toHex(payload) : null, value: km, connectionFailed: false };
    },
    FAILED
  );
}
