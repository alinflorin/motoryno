/**
 * The two adapter sessions the rest of the app runs:
 *
 * - `scanVehicleInfo`: the "self-detect" scan right after a BLE OBD2 adapter
 *   is paired on the car form - connect, read the VIN (standard OBD-II with a
 *   manufacturer UDS fallback), decode make/year from it, then try the known
 *   odometer requests for that make. Best-effort throughout: a car can be
 *   saved with whatever subset came back and the rest filled in by hand,
 *   and the odometer can be pinned down later with the learn flow
 *   (`odometer/learn.ts`) or by hand on the OBD setup screen.
 * - `syncOdometer`: the silent re-read when a paired adapter comes back
 *   into range. Replays the car's persisted `odometerSource` when it has one
 *   (one request, no guessing), otherwise falls back to the known requests.
 *
 * Both honour the adapter's persisted overrides (`ObdConfig.initCommands`,
 * `vinSource`, `odometerSource`): anything the user configured by hand is
 * tried first, the built-in strategies only when that yields nothing.
 */

import type { Device } from 'react-native-ble-plx';

import { withAdapterLock } from '@/obd/adapterLock';
import { vinDidCandidates } from '@/obd/catalogs/vinDids';
import { ElmConnection, openElmConnection } from '@/obd/elm327';
import { obdLog } from '@/obd/log';
import { vehicleOdometerSources } from '@/obd/odometer/candidates';
import { prepareRequest, readOdometerSource } from '@/obd/odometer/read';
import type { OdometerSource, VinSource } from '@/obd/odometer/source';
import { decodeAsciiVin, requestVin, sendRequest } from '@/obd/protocol';
import { decodeVin } from '@/obd/vin';
import type { ObdConfig } from '@/storage/types';

export type ScanStep = 'connecting' | 'reading-vin' | 'reading-odometer';

/** The subset of a car's persisted adapter config the read paths need. */
export type ObdReadConfig = Pick<ObdConfig, 'initCommands' | 'vinSource' | 'odometerSource'>;

export const DEFAULT_OBD_READ_CONFIG: ObdReadConfig = { initCommands: [], vinSource: null, odometerSource: null };

export interface VehicleScanResult {
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  odometerKm: number | null;
  /** The request that produced `odometerKm`, to persist so later syncs can replay it directly. */
  odometerSource: OdometerSource | null;
  /** True if the connection/handshake itself failed - nothing could be read. */
  connectionFailed: boolean;
}

export interface OdometerSyncTarget {
  vin: string;
  make: string;
  obd: ObdReadConfig;
}

export interface OdometerSyncResult {
  odometerKm: number | null;
  /** Set when the reading came from a request other than the persisted source (e.g. the first sync, or the persisted one stopped answering). */
  odometerSource: OdometerSource | null;
  connectionFailed: boolean;
}

/** Runs a hand-configured VIN request and decodes the reply as ASCII. */
export async function readVinSource(
  connection: ElmConnection,
  source: VinSource
): Promise<{ vin: string | null; payload: number[] | null }> {
  await prepareRequest(connection, source);
  const response = await sendRequest(connection, source.request);
  if (response.status !== 'ok') return { vin: null, payload: null };
  return { vin: decodeAsciiVin(response.data), payload: response.data };
}

/**
 * Reads the VIN: the car's own configured request first (if any), then the
 * standard Mode 09 request, then the manufacturer UDS DID (Mode 22, F190)
 * aimed at each known ECU header in turn - some makes don't answer the
 * standard request at all. The make isn't known yet at this point (decoding
 * the VIN is what tells us the make), so this just works through every
 * header the bundled catalogs use.
 */
async function readVin(connection: ElmConnection, vinSource: VinSource | null): Promise<string | null> {
  if (vinSource) {
    try {
      const { vin } = await readVinSource(connection, vinSource);
      if (vin) {
        obdLog('info', `VIN via configured request ${vinSource.label}`);
        return vin;
      }
      obdLog('info', `configured VIN request ${vinSource.label} gave nothing - falling back to the standard read`);
      await connection.setAddressing(null);
    } catch (error) {
      obdLog('info', `configured VIN request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const vin = await requestVin(connection);
    if (vin) return vin;
  } catch {
    // Fall through to the catalog-derived UDS fallback below.
  }

  for (const candidate of vinDidCandidates()) {
    try {
      await connection.setAddressing(candidate.ecuHeader ? { header: candidate.ecuHeader } : null);
      const response = await sendRequest(connection, `${candidate.mode}${candidate.pid}`);
      if (response.status !== 'ok') continue;
      const vin = decodeAsciiVin(response.data);
      if (vin) return vin;
    } catch {
      // Try the next candidate - most won't apply to this particular vehicle/module.
    }
  }
  return null;
}

/** Tries `sources` in order and returns the first plausible reading along with the source that produced it. */
async function readFirstOdometer(
  connection: ElmConnection,
  sources: OdometerSource[]
): Promise<{ km: number; source: OdometerSource } | null> {
  for (const source of sources) {
    try {
      const result = await readOdometerSource(connection, source);
      if (result.km !== null) {
        obdLog('info', `odometer ${result.km} km via ${source.label}`);
        return { km: result.km, source };
      }
    } catch (error) {
      obdLog('info', `${source.label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

async function disconnect(connection: ElmConnection | null, device: Device): Promise<void> {
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

/**
 * Connects to `device` for a car that's already paired, reads just the
 * odometer, and disconnects again. Used for the silent background/live
 * re-syncs triggered by the adapter coming back into range - see
 * `src/ble/obdMonitor.ts` and `src/ble/obdBackgroundTask.ts`.
 */
export function syncOdometer(device: Device, car: OdometerSyncTarget): Promise<OdometerSyncResult> {
  return withAdapterLock(device.id, () => runOdometerSync(device, car));
}

async function runOdometerSync(device: Device, car: OdometerSyncTarget): Promise<OdometerSyncResult> {
  let connection: ElmConnection | null = null;
  try {
    connection = await openElmConnection(device, { initCommands: car.obd.initCommands });

    if (car.obd.odometerSource) {
      const learned = await readFirstOdometer(connection, [car.obd.odometerSource]);
      if (learned) return { odometerKm: learned.km, odometerSource: null, connectionFailed: false };
      obdLog('info', `persisted source ${car.obd.odometerSource.label} gave no reading - falling back to known requests`);
    }

    const fallback = await readFirstOdometer(connection, vehicleOdometerSources(car.vin, car.make));
    return { odometerKm: fallback?.km ?? null, odometerSource: fallback?.source ?? null, connectionFailed: false };
  } catch {
    return { odometerKm: null, odometerSource: null, connectionFailed: true };
  } finally {
    await disconnect(connection, device);
  }
}

/**
 * Connects to `device`, reads what it can, and disconnects again - pairing
 * only stores the adapter's address, it doesn't keep a live connection open.
 */
export function scanVehicleInfo(
  device: Device,
  obd: ObdReadConfig = DEFAULT_OBD_READ_CONFIG,
  onStep?: (step: ScanStep) => void
): Promise<VehicleScanResult> {
  return withAdapterLock(device.id, () => runVehicleScan(device, obd, onStep));
}

async function runVehicleScan(device: Device, obd: ObdReadConfig, onStep?: (step: ScanStep) => void): Promise<VehicleScanResult> {
  const result: VehicleScanResult = {
    vin: null,
    make: null,
    model: null,
    year: null,
    odometerKm: null,
    odometerSource: null,
    connectionFailed: false,
  };

  let connection: ElmConnection | null = null;
  try {
    onStep?.('connecting');
    connection = await openElmConnection(device, { initCommands: obd.initCommands });

    onStep?.('reading-vin');
    try {
      result.vin = await readVin(connection, obd.vinSource);
    } catch {
      result.vin = null;
    }
    // readVin may leave a manufacturer ECU header set - restore broadcast addressing before the odometer pass.
    await connection.setAddressing(null);

    if (result.vin) {
      const decoded = await decodeVin(result.vin);
      result.make = decoded?.make ?? null;
      result.model = decoded?.model ?? null;
      result.year = decoded?.year ?? null;
    }

    onStep?.('reading-odometer');
    const sources = [...(obd.odometerSource ? [obd.odometerSource] : []), ...vehicleOdometerSources(result.vin, result.make)];
    const odometer = await readFirstOdometer(connection, sources);
    result.odometerKm = odometer?.km ?? null;
    result.odometerSource = odometer?.source ?? null;
  } catch {
    result.connectionFailed = true;
  } finally {
    await disconnect(connection, device);
  }

  return result;
}
