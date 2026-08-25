/**
 * Orchestrates the "self-detect" scan run right after a BLE OBD2 adapter is
 * paired on the car form: connect, read the VIN (standard OBD-II), decode
 * make/model/year from it, then try to read the odometer (make-specific PIDs,
 * matched off the VIN's WMI, first; standard PID as fallback). Best-effort
 * throughout - a car can be saved with whatever subset of fields came back,
 * and the rest filled in by hand.
 */

import type { Device } from 'react-native-ble-plx';

import { odometerCandidatesForVehicle } from '@/obd/catalogs/odometerDids';
import { decodeVinDidBytes, vinDidCandidates } from '@/obd/catalogs/vinDids';
import { ElmConnection, openElmConnection, requestPid, requestVin } from '@/obd/elm327';
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

/**
 * Reads the VIN via the standard Mode 09 request, falling back to
 * manufacturer UDS DIDs (Mode 22, F190) aimed at each known ECU header in
 * turn - some makes don't answer the standard request at all. The make isn't
 * known yet at this point (decoding the VIN is what tells us the make), so
 * this can't narrow down to one manufacturer's catalog the way the odometer
 * read does; it just works through every header the bundled catalogs use.
 */
async function readVin(connection: ElmConnection): Promise<string | null> {
  try {
    const vin = await requestVin(connection);
    if (vin) return vin;
  } catch {
    // Fall through to the catalog-derived UDS fallback below.
  }

  let headerOverridden = false;
  for (const candidate of vinDidCandidates()) {
    try {
      if (candidate.ecuHeader) {
        await connection.sendCommand(`ATSH${candidate.ecuHeader}`);
        headerOverridden = true;
      } else if (headerOverridden) {
        await connection.sendCommand('ATSP0');
        headerOverridden = false;
      }

      const bytes = await requestPid(connection, candidate.mode, candidate.pid);
      if (!bytes) continue;
      const vin = decodeVinDidBytes(bytes);
      if (vin) return vin;
    } catch {
      // Try the next header - most won't apply to this particular vehicle.
    }
  }
  return null;
}

async function readOdometer(connection: ElmConnection, vin: string | null, make: string | null): Promise<number | null> {
  // Brand-specific candidates may target a non-default CAN header (a
  // specific ECU); track whether one is currently set so it can be reset
  // before falling through to a candidate (typically the standard PID) that
  // expects default/auto addressing instead.
  let headerOverridden = false;

  for (const candidate of await odometerCandidatesForVehicle(vin, make)) {
    try {
      if (candidate.ecuHeader) {
        await connection.sendCommand(`ATSH${candidate.ecuHeader}`);
        headerOverridden = true;
      } else if (headerOverridden) {
        await connection.sendCommand('ATSP0');
        headerOverridden = false;
      }

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
      result.vin = await readVin(connection);
    } catch {
      result.vin = null;
    }
    try {
      // readVin may leave a manufacturer ECU header set (if a catalog fallback
      // candidate answered) - readOdometer tracks/resets headers from its own
      // clean-slate assumption, so restore default addressing before it starts.
      await connection.sendCommand('ATSP0');
    } catch {
      // Best-effort - the odometer read below still tracks/resets headers itself.
    }

    if (result.vin) {
      const decoded = await decodeVin(result.vin);
      result.make = decoded?.make ?? null;
      result.model = decoded?.model ?? null;
      result.year = decoded?.year ?? null;
    }

    onStep?.('reading-odometer');
    try {
      result.odometerKm = await readOdometer(connection, result.vin, result.make);
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
