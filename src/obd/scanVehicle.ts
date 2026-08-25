/**
 * Orchestrates the "self-detect" scan run right after a BLE OBD2 adapter is
 * paired on the car form: connect, read the VIN (standard OBD-II), decode
 * make/model/year from it, then try to read the odometer (make-specific PIDs
 * first, standard PID as fallback). Best-effort throughout - a car can be
 * saved with whatever subset of fields came back, and the rest filled in by
 * hand.
 */

import type { Device } from 'react-native-ble-plx';

import { ElmConnection, openElmConnection, requestPid, requestVin } from '@/obd/elm327';
import { odometerCandidatesForMake } from '@/obd/pids';
import { decodeVin } from '@/obd/vin';

export type ScanStep = 'connecting' | 'reading-vin' | 'reading-odometer';

export interface VehicleScanResult {
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  odometerKm: number | null;
  /** True if the connection/handshake itself failed - nothing could be read. */
  connectionFailed: boolean;
}

async function readOdometer(connection: ElmConnection, make: string | null): Promise<number | null> {
  for (const candidate of odometerCandidatesForMake(make)) {
    try {
      const bytes = await requestPid(connection, candidate.mode, candidate.pid);
      if (!bytes) continue;
      const km = candidate.decode(bytes);
      if (km !== null && Number.isFinite(km) && km >= 0) {
        return Math.round(km);
      }
    } catch {
      // Try the next candidate PID - a make-specific one that doesn't apply
      // to this particular module/model year is expected, not fatal.
    }
  }
  return null;
}

/**
 * Connects to `device`, reads what it can, and disconnects again - pairing
 * only stores the adapter's address, it doesn't keep a live connection open.
 */
export async function scanVehicleInfo(device: Device, onStep?: (step: ScanStep) => void): Promise<VehicleScanResult> {
  const result: VehicleScanResult = { vin: null, make: null, model: null, year: null, odometerKm: null, connectionFailed: false };

  let connection: ElmConnection | null = null;
  try {
    onStep?.('connecting');
    connection = await openElmConnection(device);

    onStep?.('reading-vin');
    try {
      result.vin = await requestVin(connection);
    } catch {
      result.vin = null;
    }

    if (result.vin) {
      const decoded = decodeVin(result.vin);
      result.make = decoded?.make ?? null;
      result.model = decoded?.model ?? null;
      result.year = decoded?.year ?? null;
    }

    onStep?.('reading-odometer');
    try {
      result.odometerKm = await readOdometer(connection, result.make);
    } catch {
      result.odometerKm = null;
    }
  } catch {
    result.connectionFailed = true;
  } finally {
    connection?.close();
    try {
      await device.cancelConnection();
    } catch {
      // Already disconnected, or never connected - nothing to clean up.
    }
  }

  return result;
}
