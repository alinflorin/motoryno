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

interface PidCandidate {
  mode: string;
  pid: string;
  /** CAN header/ECU address to aim the request at, or undefined for default/auto addressing. */
  ecuHeader?: string;
}

/**
 * Tries each `candidate` in turn - aiming the request at its ECU header first
 * if it has one, resetting to default/auto addressing before any candidate
 * that doesn't - and returns the first one `decode` turns into a non-null
 * value. Shared by `readVin` and `readOdometer`, which only differ in what
 * candidates they try and how a response is decoded.
 */
async function tryPidCandidates<C extends PidCandidate, R>(
  connection: ElmConnection,
  candidates: C[],
  decode: (bytes: number[], candidate: C) => R | null
): Promise<R | null> {
  let headerOverridden = false;
  for (const candidate of candidates) {
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
      const value = decode(bytes, candidate);
      if (value !== null) return value;
    } catch {
      // Try the next candidate - most won't apply to this particular vehicle/module.
    }
  }
  return null;
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

  return tryPidCandidates(connection, vinDidCandidates(), (bytes) => decodeVinDidBytes(bytes));
}

async function readOdometer(connection: ElmConnection, vin: string | null, make: string | null): Promise<number | null> {
  const candidates = await odometerCandidatesForVehicle(vin, make);
  return tryPidCandidates(connection, candidates, (bytes, candidate) => {
    const km = candidate.decode(bytes);
    return km !== null && Number.isFinite(km) && km >= 0 ? Math.round(km) : null;
  });
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
