/**
 * One-off "does this request work?" runs behind the Test buttons on the
 * OBD setup screen: connect with the car's custom init commands, run the
 * hand-configured request once, and report both the raw payload (so the
 * user can see what actually came back and adjust the byte field) and the
 * decoded value.
 */

import type { Device } from 'react-native-ble-plx';

import { withAdapterLock } from '@/obd/adapterLock';
import { ElmConnection, openElmConnection, parseMonitorFrames, type CanFrame } from '@/obd/elm327';
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

export interface RawCommandResult {
  command: string;
  /** The adapter's reply text, or the error message when the command failed. */
  response: string;
}

/**
 * The setup screen's console: sends arbitrary commands (AT or hex requests)
 * in order through a fresh session and returns each raw reply, so the user
 * can poke at the car directly and read the bytes off the screen.
 */
export function runRawCommands(device: Device, initCommands: string[], commands: string[]): Promise<RawCommandResult[] | null> {
  return withSession(
    device,
    initCommands,
    async (connection) => {
      const results: RawCommandResult[] = [];
      for (const command of commands) {
        try {
          const response = await connection.sendCommand(command);
          results.push({ command, response: response.trim() });
        } catch (error) {
          results.push({ command, response: error instanceof Error ? error.message : String(error) });
        }
      }
      return results;
    },
    null
  );
}

export interface BusCaptureResult {
  frames: CanFrame[];
  /** Every raw monitor line, for adapters/protocols whose output doesn't parse as CAN frames. */
  lines: string[];
}

/** Listens passively to the bus for `durationMs` (optionally one CAN ID only) and returns what went by. */
export function captureBus(device: Device, initCommands: string[], durationMs: number, canId?: string): Promise<BusCaptureResult | null> {
  return withSession(
    device,
    initCommands,
    async (connection) => {
      const lines = await connection.monitorBus(durationMs, canId || undefined);
      return { frames: parseMonitorFrames(lines), lines };
    },
    null
  );
}
