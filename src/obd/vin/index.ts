/**
 * VIN decoding: make/model/year from a VIN, backed by the vendored vPIC
 * dataset (github.com/cardog-ai/corgi's own data source - see `README.md` in
 * this folder for how the pieces fit together). Not available on web:
 * expo-sqlite doesn't support a custom database directory there, and BLE
 * (the only thing that currently calls this) doesn't run on web either.
 *
 * `setVinDecoder`/`resetVinDecoder` exist as an extension point (tests, or a
 * different backend down the line) - everything else should just call
 * `decodeVin`.
 */

import { Platform } from 'react-native';

import type { DatabaseAdapter } from '@/obd/vin/corgi/db/adapter';
import { decodeVIN as corgiDecodeVIN } from '@/obd/vin/corgi/decode';
import { openVpicDatabase } from '@/obd/vin/database';
import { ExpoSqliteAdapter } from '@/obd/vin/expoSqliteAdapter';
import { isValidVin } from '@/utils/validation';

export interface DecodedVin {
  make: string | null;
  model: string | null;
  year: number | null;
}

export type VinDecoder = (vin: string) => Promise<DecodedVin | null>;

let sharedAdapter: DatabaseAdapter | null = null;

async function getAdapter(): Promise<DatabaseAdapter> {
  if (!sharedAdapter) {
    const db = await openVpicDatabase();
    sharedAdapter = new ExpoSqliteAdapter(db);
  }
  return sharedAdapter;
}

async function corgiDecoder(vin: string): Promise<DecodedVin | null> {
  if (Platform.OS === 'web') return null;

  try {
    const adapter = await getAdapter();
    const result = await corgiDecodeVIN(vin, adapter, {});
    const vehicle = result.components.vehicle;
    if (!vehicle) return null;

    return {
      make: vehicle.make || null,
      model: vehicle.model || null,
      year: typeof vehicle.year === 'number' && Number.isFinite(vehicle.year) ? vehicle.year : null,
    };
  } catch (error) {
    console.warn('[obd/vin] VIN decode failed', error);
    return null;
  }
}

let activeDecoder: VinDecoder = corgiDecoder;

/** Swaps in a different VIN decoder - mainly for tests. */
export function setVinDecoder(decoder: VinDecoder): void {
  activeDecoder = decoder;
}

/** Restores the built-in vPIC-backed decoder. */
export function resetVinDecoder(): void {
  activeDecoder = corgiDecoder;
}

export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  if (!isValidVin(vin)) return null;
  return activeDecoder(vin.toUpperCase());
}
