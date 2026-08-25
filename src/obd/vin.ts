/**
 * VIN decoding: make/year from a VIN, backed by `universal-vin-decoder`
 * (offline, pure-data WMI lookup - no database, no native module, works the
 * same on every platform including web). It doesn't decode model, only
 * make/region/country/model-year, so `model` here is always null.
 *
 * `setVinDecoder`/`resetVinDecoder` exist as an extension point (tests, or a
 * different backend down the line) - everything else should just call
 * `decodeVin`.
 */

import { decodeVIN as universalDecodeVIN } from 'universal-vin-decoder';

import { isValidVin } from '@/utils/validation';

export interface DecodedVin {
  make: string | null;
  model: string | null;
  year: number | null;
}

export type VinDecoder = (vin: string) => Promise<DecodedVin | null>;

function baseDecoder(vin: string): DecodedVin | null {
  const result = universalDecodeVIN(vin);
  if (!result.isValid || !result.info) return null;

  const year = Number(result.info.modelYear);
  return {
    make: result.info.manufacturer || null,
    model: null,
    year: Number.isFinite(year) ? year : null,
  };
}

let activeDecoder: VinDecoder = async (vin) => baseDecoder(vin);

/** Swaps in a different VIN decoder - mainly for tests. */
export function setVinDecoder(decoder: VinDecoder): void {
  activeDecoder = decoder;
}

/** Restores the built-in universal-vin-decoder-backed decoder. */
export function resetVinDecoder(): void {
  activeDecoder = async (vin) => baseDecoder(vin);
}

export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  if (!isValidVin(vin)) return null;
  return activeDecoder(vin.toUpperCase());
}
